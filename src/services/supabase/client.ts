/**
 * 브라우저용 Supabase 클라이언트 — Publishable 키만 사용한다. Secret(service_role) 키는 절대 여기에 두지 않는다.
 * 로그인은 Supabase Auth Google OAuth 를 쓴다. 인증 세션은 supabase-js 가 localStorage 에 보관하므로
 * 새로고침·재방문해도 같은 사용자로 저장된 결과를 다시 읽을 수 있다. (생년월일은 여기에 넣지 않는다.)
 *
 * supabase-js 는 처음 필요할 때만 불러온다(설정이 없거나 Mock 모드에서는 번들·초기 동작에 영향 없음).
 */
import type { Session, SupabaseClient } from '@supabase/supabase-js';

/** 환경변수는 이름을 직접 적어 읽는다(그래야 Vite 가 이 값만 번들에 넣는다) */
const SUPABASE_URL: string = (import.meta.env?.VITE_SUPABASE_URL ?? '').trim();
const SUPABASE_PUBLISHABLE_KEY: string = (import.meta.env?.VITE_SUPABASE_PUBLISHABLE_KEY ?? '').trim();

export function isSupabaseConfigured(): boolean {
  return Boolean(SUPABASE_URL && SUPABASE_PUBLISHABLE_KEY);
}

let clientPromise: Promise<SupabaseClient | null> | null = null;

/** 설정이 없으면 null */
export function getSupabase(): Promise<SupabaseClient | null> {
  if (clientPromise) return clientPromise;
  clientPromise = !isSupabaseConfigured()
    ? Promise.resolve(null)
    : import('@supabase/supabase-js').then(({ createClient }) =>
        createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
          auth: { flowType: 'pkce', persistSession: true, autoRefreshToken: true, detectSessionInUrl: true, storageKey: 'jeonsaeng-auth' },
        }),
      );
  return clientPromise;
}

/** Google 로그인 화면으로 이동한다. 돌아오면 completeOAuthReturn() 이 세션을 마무리한다. */
export async function signInWithGoogle(): Promise<{ ok: true } | { ok: false; message: string }> {
  const sb = await getSupabase();
  if (!sb) return { ok: false, message: 'Supabase 설정이 없어 Google 로그인을 할 수 없습니다.' };
  const { error } = await sb.auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo: `${window.location.origin}${window.location.pathname}` },
  });
  return error ? { ok: false, message: 'Google 로그인을 시작하지 못했습니다. 잠시 후 다시 시도해 주세요.' } : { ok: true };
}

/** 주소창에 OAuth 응답(code/error)이 붙어 있는지 */
export function hasOAuthResponseInUrl(): boolean {
  if (typeof window === 'undefined') return false;
  const q = new URLSearchParams(window.location.search);
  return q.has('code') || q.has('error_description') || window.location.hash.includes('access_token=');
}

/**
 * OAuth 로 돌아온 직후 세션을 확정하고 주소창의 code 를 지운다.
 * 로그인됐으면 세션, 아니면 null.
 */
export async function completeOAuthReturn(): Promise<Session | null> {
  const sb = await getSupabase();
  if (!sb) return null;
  const { data } = await sb.auth.getSession(); // detectSessionInUrl 이 code 교환을 끝낼 때까지 기다린다
  if (hasOAuthResponseInUrl()) {
    const url = new URL(window.location.href);
    ['code', 'state', 'error', 'error_code', 'error_description'].forEach((k) => url.searchParams.delete(k));
    window.history.replaceState(window.history.state, '', `${url.pathname}${url.search}`);
  }
  return data.session ?? null;
}

/** 아이디·비밀번호로 Supabase 에 로그인한다 (간편 회원가입으로 만든 계정). 성공하면 표시 이름을 돌려준다 */
export async function signInWithLoginId(id: string, password: string): Promise<{ ok: true; displayName: string } | { ok: false }> {
  const sb = await getSupabase();
  if (!sb) return { ok: false };
  const { loginIdToEmail } = await import('./edge');
  const { data, error } = await sb.auth.signInWithPassword({ email: loginIdToEmail(id), password });
  if (error || !data.session) return { ok: false };
  const meta = (data.session.user.user_metadata ?? {}) as Record<string, unknown>;
  const name = typeof meta.display_name === 'string' ? meta.display_name : '';
  return { ok: true, displayName: name || id };
}

let bridgePromise: Promise<Session | null> | null = null;
let bridgeFailedAt = 0;

/**
 * 게스트·소셜(체험)·시연 계정 등 Supabase 세션이 없는 로그인 방식에도 맞춤형 전생을 만들 수 있게,
 * Edge Function(guest-session)이 만든 임시 사용자로 진짜 Supabase 세션을 연다. 실패하면 null (1분간 다시 시도하지 않음).
 */
async function ensureBridgeSession(method: string, displayName: string): Promise<Session | null> {
  if (bridgePromise) return bridgePromise;
  if (Date.now() - bridgeFailedAt < 60_000) return null;
  bridgePromise = (async () => {
    const sb = await getSupabase();
    if (!sb) return null;
    const { requestGuestSession } = await import('./edge');
    const r = await requestGuestSession({ method, displayName });
    if (!r.ok) return null;
    const { data, error } = await sb.auth.signInWithPassword({ email: r.data.email, password: r.data.password });
    return error || !data.session ? null : data.session;
  })()
    .catch(() => null)
    .then((s) => {
      if (!s) bridgeFailedAt = Date.now();
      bridgePromise = null;
      return s;
    });
  return bridgePromise;
}

/**
 * 현재 로그인 세션 (없으면 null).
 * 1) 진짜 Supabase 세션(Google·ID 회원가입) 2) 다른 방식으로 로그인한 탭이면 임시 사용자 세션을 연결 3) 로컬 개발 전용 시연 매핑
 */
export async function getCurrentSession(): Promise<Session | null> {
  const sb = await getSupabase();
  if (!sb) return null;
  const { data } = await sb.auth.getSession();
  const s = data.session;
  if (s && !s.user.is_anonymous) return s;
  const { getLocalAuth } = await import('../../utils/authHandlers');
  const local = getLocalAuth();
  if (local) {
    const bridged = await ensureBridgeSession(local.method, local.displayName);
    if (bridged) return bridged;
  }
  return import.meta.env.DEV ? devDemoSession() : null;
}

/**
 * 로컬 개발(vite dev) 전용: 시연 계정(jeonju / 1234)으로 로그인한 탭이면 서버가 테스트 사용자에 매핑하는 토큰을 쓴다.
 * 운영 빌드에서는 이 분기가 번들에서 제거되고, 서버도 NODE_ENV=production 이면 이 토큰을 거부한다.
 */
async function devDemoSession(): Promise<Session | null> {
  const { getLocalAuth } = await import('../../utils/authHandlers');
  const auth = getLocalAuth();
  if (auth?.method !== 'password' || auth.id !== 'jeonju') return null;
  return { access_token: 'dev-demo:jeonju', user: { id: 'dev-demo', is_anonymous: false } } as unknown as Session;
}

/** Storage 공개 URL (버킷이 public read 인 경우) */
export async function publicUrl(bucket: string, path: string | null): Promise<string | null> {
  if (!path) return null;
  const sb = await getSupabase();
  return sb ? sb.storage.from(bucket).getPublicUrl(path).data.publicUrl : null;
}
