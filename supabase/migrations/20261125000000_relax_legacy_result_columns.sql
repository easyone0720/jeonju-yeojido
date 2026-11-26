-- past_life_results 에 남아 있는 이전 초안 컬럼의 NOT NULL 만 푼다.
-- 서버는 이 컬럼들에 값을 넣지 않으므로, NOT NULL 이면 저장(insert)이 실패한다.
-- 컬럼과 데이터는 지우지 않는다. 여러 번 실행해도 안전하다.
--   대응 관계(현재 코드 기준): display_name→user_name, reference_character_id→character_id,
--   clues→fragments, result_payload→story, audio_path→voice_path, status→(사용 안 함)
do $$
declare
  col text;
begin
  foreach col in array array['display_name', 'reference_character_id', 'clues', 'result_payload', 'audio_path', 'status']
  loop
    if exists (
      select 1 from information_schema.columns
      where table_schema = 'public' and table_name = 'past_life_results' and column_name = col and is_nullable = 'NO'
    ) then
      execute format('alter table public.past_life_results alter column %I drop not null', col);
      raise notice 'past_life_results.%: NOT NULL 해제', col;
    end if;
  end loop;
end $$;

-- created_at: 이전 초안에서 NOT NULL 이면서 기본값이 없으면 insert 가 실패한다 (check:api 에서 확인된 원인)
alter table public.past_life_results alter column created_at set default now();
update public.past_life_results set created_at = now() where created_at is null;

-- 확인: 아래 결과에 서버가 값을 넣는 컬럼만 is_nullable = NO 로 남아야 한다
-- (id, user_id, character_id, category_code, fragments, story 등. created_at 은 기본값이 있으면 무관)
select column_name, is_nullable, column_default
from information_schema.columns
where table_schema = 'public' and table_name = 'past_life_results'
order by ordinal_position;
