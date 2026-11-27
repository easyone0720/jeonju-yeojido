// 간편 회원가입 — ID/비밀번호로 가입하면 Supabase Auth 사용자를 만들고 profiles 에 저장한다.
// 이메일 확인 없이 바로 로그인할 수 있도록 service_role 로 email_confirm: true 로 생성한다.
// profiles 행은 DB 트리거(handle_new_user)가 user_metadata 를 읽어 자동으로 만든다.
import { adminClient, clientIp, corsHeaders, json, loginIdToEmail, rateLimited } from '../_shared/common.ts';

const ID_RE = /^[\p{L}\p{N}_.-]{2,20}$/u;

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json(405, { error: '허용되지 않은 메서드입니다.' });
  if (rateLimited(`signup:${clientIp(req)}`, 10, 10 * 60_000)) return json(429, { error: '잠시 후 다시 시도해 주세요.' });

  let body: { id?: unknown; password?: unknown; name?: unknown };
  try {
    body = await req.json();
  } catch {
    return json(400, { error: '요청 형식이 올바르지 않습니다.' });
  }
  const id = typeof body.id === 'string' ? body.id.trim().toLowerCase() : '';
  const password = typeof body.password === 'string' ? body.password : '';
  const name = (typeof body.name === 'string' ? body.name.trim() : '').slice(0, 16) || id;
  if (!ID_RE.test(id)) return json(400, { error: 'ID는 공백 없이 2~20자(글자·숫자·_ . -)로 입력해 주세요.' });
  if (password.length < 6 || password.length > 72) return json(400, { error: '비밀번호는 6자 이상 입력해 주세요.' });

  const admin = adminClient();
  const { data, error } = await admin.auth.admin.createUser({
    email: loginIdToEmail(id),
    password,
    email_confirm: true,
    user_metadata: { login_id: id, display_name: name, signup_method: 'password' },
  });
  if (error || !data.user) {
    const dup = /already|registered|exists/i.test(error?.message ?? '');
    return json(dup ? 409 : 502, { error: dup ? '이미 사용 중인 아이디입니다.' : '회원가입에 실패했습니다. 잠시 후 다시 시도해 주세요.' });
  }
  return json(200, { ok: true, userId: data.user.id });
});
