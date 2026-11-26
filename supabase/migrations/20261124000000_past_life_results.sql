-- 전생여지도: 맞춤형 전생 결과 테이블 + Storage 버킷 (목표 구조)
--
-- 이 파일은 "목표 구조"를 다시 실행해도 안전하게 맞추는 SQL 이다. 데이터·테이블을 지우지 않는다.
-- 이미 만들어 둔 past_life_results 가 있다면:
--   1) CREATE TABLE IF NOT EXISTS 는 아무것도 바꾸지 않는다.
--   2) 아래 ALTER TABLE ... ADD COLUMN IF NOT EXISTS 가 빠진 컬럼만 추가한다.
--   3) 기존에 다른 이름·자료형의 컬럼이 있으면 그대로 남는다. 맨 아래 확인 쿼리로 차이를 확인한다.
--
-- 저장하지 않는 것: 생년월일, 출생연도, 성격 키워드.
-- 쓰기: 서버(api/past-life/story.ts, SUPABASE_SECRET_KEY)만. 로그인 사용자(authenticated)는 자기 행 읽기만.

-- ------------------------------------------------------------------------------------------
-- 1. 결과 테이블
-- ------------------------------------------------------------------------------------------
create table if not exists public.past_life_results (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references auth.users (id) on delete cascade,
  user_name     text not null default '',
  character_id  text not null,
  category_code text not null,
  zodiac_code   text null,
  fragments     jsonb not null,
  story         jsonb not null,
  image_path    text null,
  voice_path    text null,
  created_at    timestamptz not null default now()
);

alter table public.past_life_results add column if not exists user_name     text not null default '';
alter table public.past_life_results add column if not exists character_id  text;
alter table public.past_life_results add column if not exists category_code text;
alter table public.past_life_results add column if not exists zodiac_code   text;
alter table public.past_life_results add column if not exists fragments     jsonb;
alter table public.past_life_results add column if not exists story         jsonb;
alter table public.past_life_results add column if not exists image_path    text;
alter table public.past_life_results add column if not exists voice_path    text;
alter table public.past_life_results add column if not exists created_at    timestamptz not null default now();

-- 이전 초안(2026-11-24) 구조로 이미 만든 경우: 새 저장 형식과 맞지 않는 제약만 푼다 (데이터는 그대로)
--   - fragments 에 archetypeId 를 요구하던 CHECK, story 최상위에 setting 등을 요구하던 CHECK
--   - story_type(새 구조에서는 저장하지 않음)의 NOT NULL
alter table public.past_life_results drop constraint if exists past_life_results_fragments_check;
alter table public.past_life_results drop constraint if exists past_life_results_story_check;
do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'past_life_results' and column_name = 'story_type' and is_nullable = 'NO'
  ) then
    alter table public.past_life_results alter column story_type drop not null;
  end if;
end $$;

-- fragments 는 era/status/story/item 네 문자열 키만 (서버도 같은 검사를 한다)
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'past_life_results_fragments_shape') then
    alter table public.past_life_results
      add constraint past_life_results_fragments_shape check (
        jsonb_typeof(fragments) = 'object'
        and fragments ?& array['era', 'status', 'story', 'item']
        and jsonb_typeof(fragments -> 'era') = 'string'
        and jsonb_typeof(fragments -> 'status') = 'string'
        and jsonb_typeof(fragments -> 'story') = 'string'
        and jsonb_typeof(fragments -> 'item') = 'string'
      ) not valid; -- 기존 행은 검사하지 않고 새 행부터 적용 (기존 데이터 확인 후 VALIDATE)
  end if;
  if not exists (select 1 from pg_constraint where conname = 'past_life_results_story_shape') then
    alter table public.past_life_results
      add constraint past_life_results_story_shape check (
        jsonb_typeof(story) = 'object' and story ?& array['title', 'story', 'image_prompt', 'narration_text']
      ) not valid;
  end if;
end $$;

-- 기준 테이블 참조 (기준 테이블에 해당 컬럼이 unique/pk 로 있을 때만 추가)
do $$
declare
  ref_col text;
begin
  -- story_characters 의 캐릭터 id 컬럼 (character_id 우선, 없으면 id)
  select a.attname into ref_col
  from pg_index i
  join pg_attribute a on a.attrelid = i.indrelid and a.attnum = any (i.indkey)
  where i.indrelid = 'public.story_characters'::regclass and (i.indisprimary or i.indisunique)
    and array_length(i.indkey, 1) = 1 and a.attname in ('character_id', 'id')
  order by (a.attname = 'character_id') desc
  limit 1;
  if ref_col is not null and not exists (select 1 from pg_constraint where conname = 'past_life_results_character_fk') then
    execute format(
      'alter table public.past_life_results add constraint past_life_results_character_fk foreign key (character_id) references public.story_characters (%I) not valid',
      ref_col);
  end if;

  if exists (
    select 1 from pg_index i join pg_attribute a on a.attrelid = i.indrelid and a.attnum = any (i.indkey)
    where i.indrelid = 'public.story_categories'::regclass and (i.indisprimary or i.indisunique) and a.attname = 'category_code'
  ) and not exists (select 1 from pg_constraint where conname = 'past_life_results_category_fk') then
    alter table public.past_life_results
      add constraint past_life_results_category_fk foreign key (category_code) references public.story_categories (category_code) not valid;
  end if;

  if exists (
    select 1 from pg_index i join pg_attribute a on a.attrelid = i.indrelid and a.attnum = any (i.indkey)
    where i.indrelid = 'public.zodiac_story_rules'::regclass and (i.indisprimary or i.indisunique) and a.attname = 'zodiac_code'
  ) and not exists (select 1 from pg_constraint where conname = 'past_life_results_zodiac_fk') then
    alter table public.past_life_results
      add constraint past_life_results_zodiac_fk foreign key (zodiac_code) references public.zodiac_story_rules (zodiac_code) not valid;
  end if;
end $$;

create index if not exists past_life_results_user_created_idx
  on public.past_life_results (user_id, created_at desc);

-- ------------------------------------------------------------------------------------------
-- 2. 권한·RLS — 클라이언트는 자기 행 읽기만. insert/update/delete 정책이 없으므로 클라이언트는 쓸 수 없다.
-- ------------------------------------------------------------------------------------------
alter table public.past_life_results enable row level security;
revoke all on table public.past_life_results from anon, authenticated;
grant select on table public.past_life_results to authenticated;

drop policy if exists "past_life_results_select_own" on public.past_life_results;
create policy "past_life_results_select_own"
  on public.past_life_results
  for select
  to authenticated
  using ((select auth.uid()) = user_id);

-- ------------------------------------------------------------------------------------------
-- 3. Storage 버킷 (이미 있으면 그대로). 읽기는 공개, 쓰기는 서버(Secret 키)만.
--    파일 경로: {user_id}/{result_id}.{png|jpg|wav}
-- ------------------------------------------------------------------------------------------
insert into storage.buckets (id, name, public)
values ('past-life-portraits', 'past-life-portraits', true), ('past-life-voices', 'past-life-voices', true)
on conflict (id) do nothing;

-- ------------------------------------------------------------------------------------------
-- 4. 확인 쿼리 (실행 후 결과를 보고 목표 구조와 같은지 확인)
-- ------------------------------------------------------------------------------------------
-- select column_name, data_type, is_nullable from information_schema.columns
--  where table_schema = 'public' and table_name = 'past_life_results' order by ordinal_position;
-- select conname, pg_get_constraintdef(oid) from pg_constraint where conrelid = 'public.past_life_results'::regclass;
-- 기존 motif_code / story_type 컬럼이 있으면: select motif_code, story_type, count(*) from public.past_life_results group by 1, 2;
