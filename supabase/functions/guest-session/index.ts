// 게스트·소셜(체험) 로그인 연결 — 로그인 방식과 관계없이 맞춤형 전생을 만들 수 있게,
// 임시 Supabase 사용자를 만들어 로그인 정보(이메일·임시 비밀번호)를 돌려준다.
// 브라우저는 이 정보로 signInWithPassword 를 호출해 진짜 세션을 얻는다. (익명 로그인 설정이 필요 없다)
import { adminClient, clientIp, corsHeaders, json, rateLimited, randomPassword } from '../_shared/common.ts';

const METHODS = ['guest', 'google', 'kakao', 'naver', 'password'];

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json(405, { error: '허용되지 않은 메서드입니다.' });
  // 한 IP 가 짧은 시간에 임시 사용자를 대량 생성하지 못하게 한다
  if (rateLimited(`guest:${clientIp(req)}`, 20, 60 * 60_000)) return json(429, { error: '잠시 후 다시 시도해 주세요.' });

  let body: { method?: unknown; displayName?: unknown };
  try {
    body = await req.json();
  } catch {
    body = {};
  }
  const method = METHODS.includes(String(body.method)) ? String(body.method) : 'guest';
  const displayName = (typeof body.displayName === 'string' ? body.displayName.trim() : '').slice(0, 16) || '체험자';

  const email = `guest-${crypto.randomUUID()}@guest.jeonju-yeojido.app`;
  const password = randomPassword();
  const admin = adminClient();
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { display_name: displayName, signup_method: `${method}-bridge` },
  });
  if (error || !data.user) return json(502, { error: '임시 세션을 만들지 못했습니다.' });
  return json(200, { email, password });
});
