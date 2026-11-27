# Supabase Edge Functions

| 함수 | 역할 |
|---|---|
| `signup` | 간편 회원가입. service_role 로 사용자를 만들고(이메일 확인 생략) 트리거가 `profiles` 에 저장 |
| `guest-session` | 게스트·소셜(체험) 로그인에도 맞춤형 전생을 만들 수 있게 임시 사용자 세션 정보를 발급 |

service_role 키는 Edge Function 런타임이 `SUPABASE_SERVICE_ROLE_KEY` 로 자동 주입하므로 브라우저·저장소에 두지 않습니다.

## 배포

```powershell
supabase login
supabase link --project-ref <프로젝트 ref>
supabase db push
supabase functions deploy signup --no-verify-jwt
supabase functions deploy guest-session --no-verify-jwt
```

- `supabase db push` 대신 SQL Editor 에서 `supabase/migrations/20261127000000_profiles_and_signup.sql` 을 직접 실행해도 됩니다.
- `--no-verify-jwt`: 새 Publishable 키(`sb_publishable_...`)는 JWT 가 아니라서 게이트웨이 JWT 검증을 끄고, 함수 안에서 직접 검증·호출 제한을 합니다.

## 아직 Edge Function 으로 옮기지 않은 것

AI 스토리·초상화·음성 생성(`api/past-life/story.ts`)은 Anthropic·Gemini 키를 쓰고 Node 전용 패키지(msedge-tts)에 의존해서 Vercel/Express 서버에 그대로 둡니다.
