-- =====================================================================
-- 전생여지도 Supabase 스키마 제안 (초안 v0 — 검토용, 아직 적용하지 말 것)
--
-- 적용하려면: bunx supabase migration new init_schema 로 만든 파일에 붙여넣고
--             bunx supabase db push
--
-- 설계 원칙
--  1) 모든 사용자 데이터의 키는 auth.users.id (uuid) 하나만 쓴다.
--     → 게스트(anonymous) → 소셜/이메일 전환 시 uid가 유지되어 데이터 이전이 필요 없다.
--  2) 진행 상태(방문·단서·쿠폰·AI 결과)는 "서버(Edge Function, service_role)만 쓴다".
--     클라이언트는 SELECT만 가능 → QR/GPS 검증을 우회한 단서 위조 방지.
--  3) 기존 SQLite의 session_json 덩어리를 정규화한다.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 0. 공용 함수
-- ---------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- 게스트(익명) 여부: JWT의 is_anonymous 클레임
create or replace function public.is_anonymous()
returns boolean
language sql stable
set search_path = ''
as $$
  select coalesce((select auth.jwt() ->> 'is_anonymous')::boolean, false)
$$;

-- 관리자 여부: app_metadata는 사용자가 수정할 수 없다 (user_metadata는 수정 가능하니 쓰지 말 것)
create or replace function public.is_admin()
returns boolean
language sql stable
set search_path = ''
as $$
  select coalesce((select auth.jwt() -> 'app_metadata' ->> 'role') = 'admin', false)
$$;

-- ---------------------------------------------------------------------
-- 1. 참조 데이터 (정적) — src/data/jeonjuSpots.ts 에서 시드 스크립트로 채운다
-- ---------------------------------------------------------------------
create table public.spots (
  id              text primary key,   -- 'gyeonggijeon' | 'jeollagamyeong' | 'wanpanbon' | 'nambu_market' | 'jeonju_museum'
  order_number    smallint not null unique,
  name            text not null,
  hanja_name      text,
  clue_category   text check (clue_category in ('era','status','story','item')),
  lat             double precision not null,
  lng             double precision not null,
  verify_radius_m integer not null check (verify_radius_m > 0),
  unique (clue_category),
  unique (id, clue_category),         -- clues의 (spot_id, category) 복합 FK용
  -- 박물관만 단서가 없고(AI 생성 장소), 나머지 4곳은 단서 1개씩
  check ((id = 'jeonju_museum') = (clue_category is null))
);

-- QR 원본 URL은 클라이언트에 노출하지 않는다 (RLS ON + 정책 없음 = service_role 전용)
create table public.spot_qr_codes (
  spot_id text primary key references public.spots (id) on delete cascade,
  qr_url  text not null unique
);

create table public.coupon_templates (
  id           text primary key,      -- 'coupon_gyeonggijeon' ...
  spot_id      text not null references public.spots (id),
  category     text not null check (category in ('음식점','카페','전통체험','숙박')),
  title        text not null,
  partner_area text not null,
  benefit      text not null,
  condition    text not null,
  valid_days   smallint not null default 7,
  is_demo      boolean not null default true
);

-- ---------------------------------------------------------------------
-- 2. 사용자 프로필 (이름 · 생년월일)
-- ---------------------------------------------------------------------
create table public.profiles (
  user_id      uuid primary key references auth.users (id) on delete cascade,
  visitor_name text not null check (char_length(btrim(visitor_name)) between 1 and 30),
  birth_date   date not null check (birth_date >= date '1910-01-01'),  -- 상한은 앱에서 검증
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

-- 동의 이력 (append-only 증빙용)
create table public.consent_records (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users (id) on delete cascade,
  kind       text not null check (kind in ('terms','privacy','face_reference','media_wall','overseas_transfer')),
  version    text not null,           -- 동의 문구 버전
  granted    boolean not null,
  created_at timestamptz not null default now()
);
create index consent_records_user_idx on public.consent_records (user_id, kind, created_at desc);

-- ---------------------------------------------------------------------
-- 3. 여정(= 기존 UserSessionState 1건)
-- ---------------------------------------------------------------------
create table public.journeys (
  id                 uuid primary key default gen_random_uuid(),
  user_id            uuid not null references auth.users (id) on delete cascade,
  is_demo            boolean not null default false,          -- AppMode 'demo'
  companion          text not null default 'alone' check (companion in ('alone','together')),
  location_ack       boolean not null default false,
  camera_ack         boolean not null default false,
  -- 첫 단서 획득 시 확정·저장한다. (기존 로직은 birthDate|첫 스팟|sessionId 앞 8자리 해시라서
  -- id가 바뀌면 결과가 달라질 수 있으므로 계산 결과를 저장해 고정)
  archetype_id       text check (archetype_id in
                       ('royal_inspector','gamyeong_official','woodblock_artisan','market_merchant','gate_guardian')),
  current_scene      smallint not null default 3 check (current_scene between 1 and 11),
  current_spot_id    text references public.spots (id),
  last_completed_step text not null default 'registered'
                       check (last_completed_step in
                         ('registered','exploring','all_clues_collected','past_life_generated','wall_decided')),
  media_wall_consent text not null default 'pending' check (media_wall_consent in ('pending','accepted','declined')),
  started_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  ended_at           timestamptz,
  end_reason         text check (end_reason in ('completed','merged','abandoned')),
  check ((ended_at is null) = (end_reason is null)),
  unique (id, user_id)                -- 자식 테이블의 (journey_id, user_id) 복합 FK용
);
-- 사용자당(체험/시연별) 진행 중 여정은 1개
create unique index journeys_one_active
  on public.journeys (user_id, is_demo) where ended_at is null;
create trigger journeys_set_updated_at
  before update on public.journeys
  for each row execute function public.set_updated_at();

-- 스팟 방문 인증 (기존 spot_authentications)
create table public.spot_visits (
  journey_id     uuid not null,
  user_id        uuid not null,
  spot_id        text not null references public.spots (id),
  qr_verified    boolean not null default false,
  gps_verified   boolean not null default false,
  gps_distance_m integer,
  photo_captured boolean not null default false,
  verified_at    timestamptz not null default now(),
  primary key (journey_id, spot_id),
  foreign key (journey_id, user_id) references public.journeys (id, user_id)
    on delete cascade on update cascade
);
create index spot_visits_user_idx on public.spot_visits (user_id);

-- 퍼즐 조각(단서). 방문 인증이 있어야만 획득 가능 + 스팟↔카테고리 일치를 FK로 강제
create table public.clues (
  journey_id  uuid not null,
  user_id     uuid not null,
  category    text not null check (category in ('era','status','story','item')),
  spot_id     text not null,
  value       text not null,
  detail      text not null,
  acquired_at timestamptz not null default now(),
  primary key (journey_id, category),
  unique (journey_id, spot_id),
  foreign key (journey_id, user_id) references public.journeys (id, user_id)
    on delete cascade on update cascade,
  foreign key (journey_id, spot_id) references public.spot_visits (journey_id, spot_id)
    on delete cascade,
  foreign key (spot_id, category) references public.spots (id, clue_category)
);
create index clues_user_idx on public.clues (user_id);

-- 쿠폰: 해금된 것만 행으로 존재한다 (행 존재 = unlocked)
create table public.user_coupons (
  id          uuid primary key default gen_random_uuid(),
  journey_id  uuid not null,
  user_id     uuid not null,
  template_id text not null references public.coupon_templates (id),
  unlocked_at timestamptz not null default now(),
  used_at     timestamptz,
  unique (journey_id, template_id),
  foreign key (journey_id, user_id) references public.journeys (id, user_id)
    on delete cascade on update cascade
);
create index user_coupons_user_idx on public.user_coupons (user_id);

-- ---------------------------------------------------------------------
-- 4. 얼굴 참조 사진(선택) · AI 생성 결과
-- ---------------------------------------------------------------------
-- 원본 사진은 생성 직후 삭제(기존 안내문: "초상 생성 즉시 파기")하고 행만 감사 로그로 남긴다.
create table public.face_reference_photos (
  id                uuid primary key default gen_random_uuid(),
  user_id           uuid not null references auth.users (id) on delete cascade,
  journey_id        uuid references public.journeys (id) on delete set null,
  consent_record_id uuid not null references public.consent_records (id),
  storage_path      text,                                      -- 삭제되면 NULL
  mime_type         text not null check (mime_type in ('image/jpeg','image/png','image/webp')),
  size_bytes        integer not null check (size_bytes between 1 and 5242880),
  expires_at        timestamptz not null default now() + interval '1 hour',  -- 안전망 TTL
  deleted_at        timestamptz,
  created_at        timestamptz not null default now(),
  check ((storage_path is null) = (deleted_at is not null))
);
create index face_ref_expire_idx on public.face_reference_photos (expires_at) where deleted_at is null;

-- AI 생성은 비동기(Edge Function) → 상태 머신으로 관리
create table public.past_life_generations (
  id                  uuid primary key default gen_random_uuid(),
  journey_id          uuid not null,
  user_id             uuid not null,
  status              text not null default 'pending'
                        check (status in ('pending','processing','succeeded','failed')),
  attempt             smallint not null default 1,
  error_code          text,
  -- 생성 당시 입력 스냅샷: 이름·생년월일·원형·단서·동선 (프로필이 나중에 바뀌어도 재현 가능)
  input_snapshot      jsonb not null,
  reference_photo_id  uuid references public.face_reference_photos (id) on delete set null,
  text_model          text,
  image_model         text,
  generation_source   text check (generation_source in ('gemini-ai','curated-demo')),
  story_title         text,
  one_line_summary    text,
  biography           text,
  clue_synthesis_note text,
  portrait_path       text,                                    -- 'past-life-portraits' 버킷 내 경로
  portrait_source     text check (portrait_source in ('ai_image','canvas_painter','curated')),
  disclaimer          text,
  created_at          timestamptz not null default now(),
  completed_at        timestamptz,
  foreign key (journey_id, user_id) references public.journeys (id, user_id)
    on delete cascade on update cascade
);
-- 성공본은 여정당 1개, 진행 중인 요청도 1개 (중복 클릭으로 AI 비용이 두 번 나가는 것 방지)
create unique index generations_one_succeeded
  on public.past_life_generations (journey_id) where status = 'succeeded';
create unique index generations_one_inflight
  on public.past_life_generations (journey_id) where status in ('pending','processing');
create index generations_user_idx on public.past_life_generations (user_id);

-- 미디어월(공개 전시). 공개용 이미지는 별도 public 버킷에 "복사본"으로 둔다.
create table public.wall_entries (
  id                uuid primary key default gen_random_uuid(),
  generation_id     uuid unique references public.past_life_generations (id) on delete cascade,
  user_id           uuid references auth.users (id) on delete cascade,   -- 시연 시드는 NULL
  alias             text not null check (char_length(alias) between 1 and 12),
  archetype_id      text not null,
  one_line_summary  text not null,
  public_image_path text not null,                                         -- 'wall-public' 버킷
  status            text not null default 'visible' check (status in ('visible','hidden')),  -- 운영자 숨김
  is_demo_seed      boolean not null default false,
  published_at      timestamptz not null default now()
);
create index wall_entries_feed_idx on public.wall_entries (published_at desc) where status = 'visible';

-- 게스트 → 기존 계정 병합 감사 로그 (from 계정은 삭제되므로 FK 없음)
create table public.guest_merges (
  id           uuid primary key default gen_random_uuid(),
  from_user_id uuid not null,
  to_user_id   uuid not null,
  summary      jsonb not null default '{}'::jsonb,
  merged_at    timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- 5. RLS
-- ---------------------------------------------------------------------
alter table public.spots                 enable row level security;
alter table public.spot_qr_codes         enable row level security;
alter table public.coupon_templates      enable row level security;
alter table public.profiles              enable row level security;
alter table public.consent_records       enable row level security;
alter table public.journeys              enable row level security;
alter table public.spot_visits           enable row level security;
alter table public.clues                 enable row level security;
alter table public.user_coupons          enable row level security;
alter table public.face_reference_photos enable row level security;
alter table public.past_life_generations enable row level security;
alter table public.wall_entries          enable row level security;
alter table public.guest_merges          enable row level security;

-- 참고: 게스트(익명) 사용자도 DB role은 'authenticated' 이므로 아래 정책이 그대로 적용된다.
--       게스트를 제한하고 싶으면 RESTRICTIVE 정책에 (select public.is_anonymous()) = false 를 추가한다.
--       예) create policy no_guest_wall on public.wall_entries as restrictive for insert to authenticated
--             with check (not (select public.is_anonymous()));

-- 5-1. 참조 데이터: 읽기 전용
create policy spots_read on public.spots for select to anon, authenticated using (true);
create policy coupon_templates_read on public.coupon_templates for select to anon, authenticated using (true);
revoke insert, update, delete on public.spots, public.coupon_templates from anon, authenticated;
revoke all on public.spot_qr_codes from anon, authenticated;      -- 정책도 없음: service_role 전용

-- 5-2. profiles: 본인 행만 CRUD
create policy profiles_select_own on public.profiles for select to authenticated
  using (user_id = (select auth.uid()));
create policy profiles_insert_own on public.profiles for insert to authenticated
  with check (user_id = (select auth.uid()));
create policy profiles_update_own on public.profiles for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy profiles_delete_own on public.profiles for delete to authenticated
  using (user_id = (select auth.uid()));

-- 5-3. consent_records: 본인 조회/추가만 (수정·삭제 불가 = 증빙 보존)
create policy consent_select_own on public.consent_records for select to authenticated
  using (user_id = (select auth.uid()));
create policy consent_insert_own on public.consent_records for insert to authenticated
  with check (user_id = (select auth.uid()));
revoke update, delete on public.consent_records from anon, authenticated;

-- 5-4. journeys: 조회는 본인, 생성/상태 변경은 서버. 화면 이동용 두 컬럼만 클라이언트가 수정 가능
create policy journeys_select_own on public.journeys for select to authenticated
  using (user_id = (select auth.uid()));
create policy journeys_update_nav on public.journeys for update to authenticated
  using (user_id = (select auth.uid()) and ended_at is null)
  with check (user_id = (select auth.uid()));
revoke insert, update, delete on public.journeys from anon, authenticated;
grant update (current_scene, current_spot_id) on public.journeys to authenticated;

-- 5-5. 진행 데이터: 본인 조회만 (쓰기는 Edge Function의 service_role)
create policy spot_visits_select_own on public.spot_visits for select to authenticated
  using (user_id = (select auth.uid()));
create policy clues_select_own on public.clues for select to authenticated
  using (user_id = (select auth.uid()));
create policy user_coupons_select_own on public.user_coupons for select to authenticated
  using (user_id = (select auth.uid()));
create policy face_ref_select_own on public.face_reference_photos for select to authenticated
  using (user_id = (select auth.uid()));
create policy generations_select_own on public.past_life_generations for select to authenticated
  using (user_id = (select auth.uid()));
revoke insert, update, delete on
  public.spot_visits, public.clues, public.user_coupons,
  public.face_reference_photos, public.past_life_generations
  from anon, authenticated;

-- 5-6. 미디어월: 비로그인 포함 누구나 "공개 컬럼만" 조회 (user_id 숨김)
--      클라이언트는 select('*') 대신 컬럼을 명시해야 한다.
create policy wall_public_read on public.wall_entries for select to anon, authenticated
  using (status = 'visible');
revoke all on public.wall_entries from anon, authenticated;
grant select (id, alias, archetype_id, one_line_summary, public_image_path, is_demo_seed, published_at)
  on public.wall_entries to anon, authenticated;

-- 5-7. 병합 로그: 서버 전용
revoke all on public.guest_merges from anon, authenticated;

-- ---------------------------------------------------------------------
-- 6. Storage 버킷 + 정책
--    face-references      (private) 원본 얼굴: 업로드(INSERT)만 가능, 읽기/수정/삭제는 서버 전용
--    past-life-portraits  (private) 생성 이미지: 본인만 읽기(서명 URL), 쓰기는 서버 전용
--    wall-public          (public)  전시 동의한 이미지의 "복사본": 쓰기는 서버 전용
--    경로 규칙: {user_id}/... 로 시작해야 정책이 소유자를 판별한다
-- ---------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types) values
  ('face-references',     'face-references',     false, 5242880, array['image/jpeg','image/png','image/webp']),
  ('past-life-portraits', 'past-life-portraits', false, 5242880, array['image/png','image/webp','image/jpeg']),
  ('wall-public',         'wall-public',         true,  2097152, array['image/webp','image/jpeg'])
on conflict (id) do nothing;

-- 업로드는 본인 폴더에만 (upsert 불가: 매번 새 uuid 파일명 사용)
create policy face_ref_upload_own on storage.objects for insert to authenticated
  with check (
    bucket_id = 'face-references'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

create policy portraits_read_own on storage.objects for select to authenticated
  using (
    bucket_id = 'past-life-portraits'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );
-- wall-public 은 public 버킷이라 URL로 읽히며, 쓰기 정책을 만들지 않았으므로 service_role만 쓴다.

-- ---------------------------------------------------------------------
-- 7. 게스트 → 기존 계정 병합 (linkIdentity가 "이미 가입된 계정"과 충돌할 때만 필요)
--    Edge Function에서 두 JWT를 모두 검증한 뒤 service_role로만 호출한다.
--    일반 전환(linkIdentity/updateUser 성공)은 uid가 그대로라 이 함수가 필요 없다.
-- ---------------------------------------------------------------------
create or replace function public.merge_guest_into(p_from uuid, p_to uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_summary jsonb := '{}'::jsonb;
  v_n integer;
begin
  if p_from is null or p_to is null or p_from = p_to then
    raise exception 'invalid merge arguments';
  end if;

  -- 프로필: 기존 계정(p_to) 것을 우선. 없을 때만 게스트 것을 가져온다.
  insert into public.profiles (user_id, visitor_name, birth_date)
    select p_to, visitor_name, birth_date from public.profiles where user_id = p_from
  on conflict (user_id) do nothing;
  delete from public.profiles where user_id = p_from;

  -- 진행 중 여정 충돌: (user_id, is_demo)당 단서가 더 많은 쪽만 활성 유지, 나머지는 보관 처리
  with ranked as (
    select j.id,
           row_number() over (
             partition by j.is_demo
             order by (select count(*) from public.clues c where c.journey_id = j.id) desc,
                      j.updated_at desc
           ) as rn
    from public.journeys j
    where j.user_id in (p_from, p_to) and j.ended_at is null
  )
  update public.journeys
     set ended_at = now(), end_reason = 'merged'
   where id in (select id from ranked where rn > 1);

  -- 여정 이전: 자식 테이블(spot_visits/clues/user_coupons/generations)은 ON UPDATE CASCADE로 따라간다
  update public.journeys set user_id = p_to where user_id = p_from;
  get diagnostics v_n = row_count;
  v_summary := v_summary || jsonb_build_object('journeys', v_n);

  update public.consent_records       set user_id = p_to where user_id = p_from;
  update public.face_reference_photos set user_id = p_to where user_id = p_from;
  update public.wall_entries          set user_id = p_to where user_id = p_from;

  insert into public.guest_merges (from_user_id, to_user_id, summary) values (p_from, p_to, v_summary);
  return v_summary;
  -- 이후 Edge Function이: (1) Storage 객체의 {user_id}/ 폴더 이동 (2) auth.admin.deleteUser(p_from)
end;
$$;
revoke all on function public.merge_guest_into(uuid, uuid) from public, anon, authenticated;
grant execute on function public.merge_guest_into(uuid, uuid) to service_role;

-- ---------------------------------------------------------------------
-- 8. 운영 작업 (Edge Function 스케줄 또는 pg_cron으로 구성)
--  - 얼굴 사진 TTL 청소: expires_at 지난 face_reference_photos 의 Storage 객체를 API로 삭제한 뒤
--    storage_path = NULL, deleted_at = now() 로 갱신.
--    (storage.objects 행을 SQL로 직접 지우면 실제 파일이 남을 수 있으니 반드시 Storage API 사용)
--  - 오래된 게스트 계정 정리: 마지막 접속 30일 경과(체험) / 1일 경과(시연) 익명 사용자 삭제 정책을 정해서 구현.
-- ---------------------------------------------------------------------
