/**
 * Supabase Edge Function 호출 (회원가입·게스트 세션). Publishable 키만 쓴다 — service_role 은 함수 런타임 안에만 있다.
 * 함수가 배포되지 않았거나 네트워크가 막히면 unavailable: true 로 알려, 호출 측이 기존 로컬 방식으로 물러나게 한다.
 */
const SUPABASE_URL: string = (import.meta.env?.VITE_SUPABASE_URL ?? '').trim().replace(/\/$/, '');
const PUBLISHABLE_KEY: string = (import.meta.env?.VITE_SUPABASE_PUBLISHABLE_KEY ?? '').trim();

export type EdgeResult<T> =
  | { ok: true; data: T }
  | { ok: false; status: number; message: string; /** 함수가 없거나 연결 불가 (배포 전) */ unavailable: boolean };

async function callEdge<T>(name: string, body: unknown, timeoutMs = 15_000): Promise<EdgeResult<T>> {
  if (!SUPABASE_URL || !PUBLISHABLE_KEY) return { ok: false, status: 0, message: 'Supabase 설정이 없습니다.', unavailable: true };
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(`${SUPABASE_URL}/functions/v1/${name}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', apikey: PUBLISHABLE_KEY, Authorization: `Bearer ${PUBLISHABLE_KEY}` },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    const payload = (await res.json().catch(() => ({}))) as T & { error?: string };
    if (!res.ok) {
      return { ok: false, status: res.status, message: payload.error ?? `요청이 실패했습니다. (${res.status})`, unavailable: res.status === 404 };
    }
    return { ok: true, data: payload };
  } catch {
    return { ok: false, status: 0, message: '서버에 연결하지 못했습니다.', unavailable: true };
  } finally {
    clearTimeout(timer);
  }
}

/** 아이디 → 로그인용 이메일. supabase/functions/_shared/common.ts 의 loginIdToEmail 과 같은 규칙 */
export function loginIdToEmail(id: string): string {
  const hex = Array.from(new TextEncoder().encode(id.trim().toLowerCase()), (b) => b.toString(16).padStart(2, '0')).join('');
  return `id-${hex}@id.jeonju-yeojido.app`;
}

export function signUpViaEdge(input: { id: string; password: string; name: string }) {
  return callEdge<{ ok: true; userId: string }>('signup', input);
}

export function requestGuestSession(input: { method: string; displayName: string }) {
  return callEdge<{ email: string; password: string }>('guest-session', input);
}
