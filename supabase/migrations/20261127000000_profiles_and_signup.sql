-- 회원 정보 자동 저장: auth.users 에 사용자가 생기면(ID 회원가입·Google·게스트 연결 등) profiles 에 자동으로 한 행을 만든다.
-- 쓰기: 트리거(서버)만. 로그인 사용자는 자기 행 읽기만. 여러 번 실행해도 안전하다.

create table if not exists public.profiles (
  id             uuid primary key references auth.users (id) on delete cascade,
  login_id       text unique null,                 -- ID 회원가입의 아이디 (소셜·게스트는 null)
  display_name   text not null default '',
  signup_method  text not null default 'unknown',  -- password | google | kakao-bridge | guest-bridge ...
  email          text null,                        -- 실제 이메일만 (내부용 합성 이메일은 저장하지 않음)
  created_at     timestamptz not null default now()
);

alter table public.profiles enable row level security;
revoke all on table public.profiles from anon, authenticated;
grant select on table public.profiles to authenticated;

drop policy if exists "profiles_select_own" on public.profiles;
create policy "profiles_select_own"
  on public.profiles
  for select
  to authenticated
  using ((select auth.uid()) = id);

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, login_id, display_name, signup_method, email)
  values (
    new.id,
    new.raw_user_meta_data ->> 'login_id',
    coalesce(
      new.raw_user_meta_data ->> 'display_name',
      new.raw_user_meta_data ->> 'full_name',
      new.raw_user_meta_data ->> 'name',
      ''
    ),
    coalesce(new.raw_user_meta_data ->> 'signup_method', new.raw_app_meta_data ->> 'provider', 'unknown'),
    case
      when new.email like '%@id.jeonju-yeojido.app' or new.email like '%@guest.jeonju-yeojido.app' then null
      else new.email
    end
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- 이미 있는 사용자도 채운다 (예: 개발 시연 계정, 이전에 Google 로 로그인한 사용자)
insert into public.profiles (id, login_id, display_name, signup_method, email)
select
  u.id,
  u.raw_user_meta_data ->> 'login_id',
  coalesce(u.raw_user_meta_data ->> 'display_name', u.raw_user_meta_data ->> 'full_name', u.raw_user_meta_data ->> 'name', ''),
  coalesce(u.raw_user_meta_data ->> 'signup_method', u.raw_app_meta_data ->> 'provider', 'unknown'),
  case
    when u.email like '%@id.jeonju-yeojido.app' or u.email like '%@guest.jeonju-yeojido.app' or u.email like '%@local.test' then null
    else u.email
  end
from auth.users u
on conflict (id) do nothing;
