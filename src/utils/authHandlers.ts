import { USE_LOCAL_BACKEND } from '../config/features';

/**
 * 로그인 핸들러 모음.
 *
 * Supabase 없이도 시연이 되도록 브라우저 localStorage(`jeonju_auth_users`)에 회원 목록을 두고
 * 실제로 가입·로그인을 검증합니다. (시연용: 비밀번호는 해시만 저장하지만 서버 인증 수준의 보안은 아닙니다.)
 * Supabase Auth 등을 붙일 때는 각 함수 안의 `TODO(auth)` 부분만 교체하면 되고,
 * UI(LoginModal)와 SceneStart는 수정할 필요가 없도록 반환 타입을 고정해 두었습니다.
 */

export type SocialProvider = 'google' | 'kakao' | 'naver';

export type LoginMethod = 'password' | SocialProvider | 'guest';

export type AuthResult =
  | { ok: true; method: LoginMethod; /** 외부 로그인 화면으로 이동 중 (돌아온 뒤 이어서 진행) */ redirecting?: boolean }
  | { ok: false; message: string };

export interface PasswordCredentials {
  id: string;
  password: string;
}

/**
 * 스텁 로그인(서버 인증 없이 통과)을 허용할지 여부.
 * - 로컬 단독 실행 모드(USE_LOCAL_BACKEND = true)에서는 개발·프로덕션 빌드 모두 허용합니다.
 *   (Supabase 미연동 상태에서 어떤 로그인 방식을 눌러도 막히지 않게 하기 위함)
 * - 서버 모드로 바꾸면 개발 서버에서만 허용하고, 프로덕션에서는 실제 인증이 연결되기 전까지
 *   ID/PW·소셜 로그인을 막고 게스트 로그인만 동작시킵니다.
 */
const ALLOW_STUB_LOGIN: boolean = USE_LOCAL_BACKEND || Boolean(import.meta.env?.DEV);

// ---------------------------------------------------------------------------------------------
// 로컬 로그인 정보 저장 (sessionStorage — 탭을 닫으면 사라진다. 비밀번호는 저장하지 않는다.)
// ---------------------------------------------------------------------------------------------
const LOCAL_AUTH_KEY = 'jeonsaeng:local:auth';

export interface LocalAuthInfo {
  method: LoginMethod;
  /** 화면 표시용 이름 (ID 로그인은 회원 이름, 소셜은 'Google 체험자' 등, 게스트는 '게스트 체험자') */
  displayName: string;
  /** ID 로그인에서 입력한 ID (비밀번호는 저장하지 않음) */
  id?: string;
  /** Google 로그인 시 JWT 에서 읽은 이메일 / 프로필 이미지 URL (sessionStorage 에만 저장) */
  email?: string;
  picture?: string;
  loggedInAt: string;
}

const SOCIAL_DISPLAY_NAMES: Record<SocialProvider, string> = {
  google: 'Google 체험자',
  kakao: 'Kakao 체험자',
  naver: 'Naver 체험자',
};

function saveLocalAuth(info: Omit<LocalAuthInfo, 'loggedInAt'>): void {
  try {
    window.sessionStorage.setItem(
      LOCAL_AUTH_KEY,
      JSON.stringify({ ...info, loggedInAt: new Date().toISOString() })
    );
  } catch {
    // 저장소를 쓸 수 없어도 로그인 흐름은 계속 진행한다
  }
}

/** 이 탭에서 로그인한 정보를 읽는다 (없으면 null). */
export function getLocalAuth(): LocalAuthInfo | null {
  try {
    const raw = window.sessionStorage.getItem(LOCAL_AUTH_KEY);
    return raw ? (JSON.parse(raw) as LocalAuthInfo) : null;
  } catch {
    return null;
  }
}

export function clearLocalAuth(): void {
  try {
    window.sessionStorage.removeItem(LOCAL_AUTH_KEY);
  } catch {
    // ignore
  }
}

/** 미등록 아이디 · 틀린 비밀번호 공통 안내 */
export const LOGIN_FAILED_MESSAGE = '아이디 또는 비밀번호가 올바르지 않습니다.';

const NOT_READY_MESSAGE = '로그인 연동 준비 중입니다. 게스트 로그인으로 이용해 주세요.';

// ---------------------------------------------------------------------------------------------
// 로컬 회원 저장소 (localStorage `jeonju_auth_users`)
// ---------------------------------------------------------------------------------------------
export const AUTH_USERS_KEY = 'jeonju_auth_users';

/** 처음 실행 시 자동 등록되는 시연 계정 */
export const DEFAULT_DEMO_ACCOUNT = { id: 'jeonju', password: '1234', name: '전주여행자' } as const;

interface StoredUser {
  /** 소문자로 정규화한 아이디 */
  id: string;
  name: string;
  /** 비밀번호 해시 (원문은 저장하지 않음) */
  passwordHash: string;
  createdAt: string;
}

// localStorage 를 못 쓰는 환경(시크릿 모드 일부 등)에서도 이번 탭 안에서는 동작하도록 메모리 폴백
let memoryUsers: StoredUser[] | null = null;

function readUsers(): StoredUser[] {
  try {
    const raw = window.localStorage.getItem(AUTH_USERS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as unknown;
      if (Array.isArray(parsed)) return parsed as StoredUser[];
    }
    // localStorage 는 쓸 수 있는데 목록이 없다 = 처음이거나 사용자가 지운 상태 → 빈 목록
    return [];
  } catch {
    // localStorage 를 쓸 수 없는 환경에서만 메모리 보관분을 쓴다
    return memoryUsers ?? [];
  }
}

function writeUsers(users: StoredUser[]): void {
  memoryUsers = users;
  try {
    window.localStorage.setItem(AUTH_USERS_KEY, JSON.stringify(users));
  } catch {
    // 메모리 보관분만 유효
  }
}

const normalizeId = (id: string) => id.trim().toLowerCase();

/** SHA-256(가능하면) 해시. subtle crypto 를 못 쓰는 환경(비보안 컨텍스트)에서는 단순 해시로 폴백. */
async function hashPassword(id: string, password: string): Promise<string> {
  const input = `jeonju-yeojido:${normalizeId(id)}:${password}`;
  try {
    const subtle = globalThis.crypto?.subtle;
    if (subtle) {
      const digest = await subtle.digest('SHA-256', new TextEncoder().encode(input));
      return 'sha256:' + Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, '0')).join('');
    }
  } catch {
    // 아래 폴백 사용
  }
  let h = 5381;
  for (let i = 0; i < input.length; i += 1) h = ((h << 5) + h + input.charCodeAt(i)) | 0;
  return 'djb2:' + (h >>> 0).toString(16);
}

/** 기본 시연 계정(jeonju / 1234)이 없으면 자동 등록한다. 여러 번 호출해도 안전하다. */
export async function ensureDefaultAccount(): Promise<void> {
  const users = readUsers();
  if (users.some((u) => u.id === DEFAULT_DEMO_ACCOUNT.id)) return;
  users.push({
    id: DEFAULT_DEMO_ACCOUNT.id,
    name: DEFAULT_DEMO_ACCOUNT.name,
    passwordHash: await hashPassword(DEFAULT_DEMO_ACCOUNT.id, DEFAULT_DEMO_ACCOUNT.password),
    createdAt: new Date().toISOString(),
  });
  writeUsers(users);
}

/** ID/비밀번호 로그인 (등록된 회원만, 비밀번호가 맞아야 통과) */
export async function loginWithPassword({
  id,
  password,
}: PasswordCredentials): Promise<AuthResult> {
  if (!id.trim()) return { ok: false, message: 'ID를 입력해 주세요.' };
  if (!password) return { ok: false, message: '비밀번호를 입력해 주세요.' };

  // TODO(auth): Supabase 연동 시 아래로 교체
  // const { error } = await supabase.auth.signInWithPassword({ email: id.trim(), password });
  // if (error) return { ok: false, message: 'ID 또는 비밀번호가 올바르지 않습니다.' };
  if (!ALLOW_STUB_LOGIN) return { ok: false, message: NOT_READY_MESSAGE };

  await ensureDefaultAccount();
  const user = readUsers().find((u) => u.id === normalizeId(id));
  // 아이디 존재 여부가 드러나지 않도록 미등록 아이디와 틀린 비밀번호에 같은 문구를 쓴다
  if (!user || user.passwordHash !== (await hashPassword(id, password))) {
    return { ok: false, message: LOGIN_FAILED_MESSAGE };
  }
  saveLocalAuth({ method: 'password', displayName: user.name, id: user.id });
  return { ok: true, method: 'password' };
}

export interface RegisterCredentials extends PasswordCredentials {
  /** 표시 이름 (비워 두면 아이디를 사용) */
  name?: string;
}

/** 간편 회원가입: 새 계정을 저장하고 바로 로그인 처리한다. */
export async function registerWithPassword({
  id,
  password,
  name,
}: RegisterCredentials): Promise<AuthResult> {
  const nid = normalizeId(id);
  if (!nid) return { ok: false, message: 'ID를 입력해 주세요.' };
  if (nid.length < 2 || nid.length > 20 || /\s/.test(nid)) {
    return { ok: false, message: 'ID는 공백 없이 2~20자로 입력해 주세요.' };
  }
  if (!password) return { ok: false, message: '비밀번호를 입력해 주세요.' };
  if (password.length < 4) return { ok: false, message: '비밀번호는 4자 이상 입력해 주세요.' };

  // TODO(auth): Supabase 연동 시 supabase.auth.signUp(...) 으로 교체
  if (!ALLOW_STUB_LOGIN) return { ok: false, message: NOT_READY_MESSAGE };

  await ensureDefaultAccount();
  const users = readUsers();
  if (users.some((u) => u.id === nid)) {
    return { ok: false, message: '이미 사용 중인 아이디입니다.' };
  }
  const displayName = (name ?? '').trim().slice(0, 16) || id.trim();
  users.push({
    id: nid,
    name: displayName,
    passwordHash: await hashPassword(id, password),
    createdAt: new Date().toISOString(),
  });
  writeUsers(users);
  saveLocalAuth({ method: 'password', displayName, id: nid });
  return { ok: true, method: 'password' };
}

// ---------------------------------------------------------------------------------------------
// Google Identity Services (https://accounts.google.com/gsi/client)
// ---------------------------------------------------------------------------------------------
const GSI_SCRIPT_SRC = 'https://accounts.google.com/gsi/client';

/** .env 의 VITE_GOOGLE_CLIENT_ID (비어 있거나 예시값이면 빈 문자열) */
export function getGoogleClientId(): string {
  const raw = ((import.meta.env?.VITE_GOOGLE_CLIENT_ID as string | undefined) ?? '').trim();
  if (!raw || /^(MY_|YOUR_|your-|<)/i.test(raw)) return '';
  return raw;
}

interface GoogleIdApi {
  initialize: (config: {
    client_id: string;
    callback: (response: { credential?: string }) => void;
    ux_mode?: 'popup' | 'redirect';
    auto_select?: boolean;
    cancel_on_tap_outside?: boolean;
  }) => void;
  renderButton: (parent: HTMLElement, options: Record<string, unknown>) => void;
}

declare global {
  interface Window {
    google?: { accounts?: { id?: GoogleIdApi } };
  }
}

let gsiLoading: Promise<GoogleIdApi | null> | null = null;

/** GIS 스크립트를 한 번만 불러온다. 실패(오프라인·차단)하면 null. */
export function loadGoogleIdentity(): Promise<GoogleIdApi | null> {
  if (typeof window === 'undefined') return Promise.resolve(null);
  const ready = window.google?.accounts?.id;
  if (ready) return Promise.resolve(ready);
  if (gsiLoading) return gsiLoading;
  gsiLoading = new Promise<GoogleIdApi | null>((resolve) => {
    const script = document.createElement('script');
    script.src = GSI_SCRIPT_SRC;
    script.async = true;
    script.defer = true;
    script.onload = () => resolve(window.google?.accounts?.id ?? null);
    script.onerror = () => {
      gsiLoading = null; // 다음 시도에서 다시 불러올 수 있게 한다
      script.remove();
      resolve(null);
    };
    document.head.appendChild(script);
  });
  return gsiLoading;
}

/** JWT(ID 토큰)의 payload 를 디코딩한다. 서명 검증은 하지 않는다(시연용, 서버 인증 아님). */
export function decodeJwtPayload(token: string): Record<string, unknown> | null {
  try {
    const part = token.split('.')[1];
    if (!part) return null;
    const b64 = part.replace(/-/g, '+').replace(/_/g, '/');
    const padded = b64 + '='.repeat((4 - (b64.length % 4)) % 4);
    const bin = atob(padded);
    const bytes = Uint8Array.from(bin, (c) => c.charCodeAt(0));
    const parsed = JSON.parse(new TextDecoder().decode(bytes)) as unknown;
    return parsed && typeof parsed === 'object' ? (parsed as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

/** Google 로그인 팝업이 돌려준 JWT 에서 이름·이메일·프로필 이미지를 읽어 로컬 세션에 저장한다. */
export async function loginWithGoogleCredential(credential: string): Promise<AuthResult> {
  const payload = decodeJwtPayload(credential);
  if (!payload) return { ok: false, message: 'Google 로그인 정보를 읽지 못했습니다. 다시 시도해 주세요.' };
  const str = (v: unknown) => (typeof v === 'string' ? v.trim() : '');
  const email = str(payload.email);
  const name = str(payload.name) || str(payload.given_name) || email.split('@')[0] || SOCIAL_DISPLAY_NAMES.google;
  const picture = str(payload.picture);
  saveLocalAuth({
    method: 'google',
    displayName: name.slice(0, 16),
    ...(email ? { email } : {}),
    ...(picture ? { picture } : {}),
  });
  return { ok: true, method: 'google' };
}

// ---------------------------------------------------------------------------------------------
// Supabase Auth — Google OAuth (Supabase 설정이 있으면 Google 로그인은 이 경로만 쓴다)
// ---------------------------------------------------------------------------------------------
const OAUTH_PENDING_KEY = 'jeonsaeng:oauth:pending';

/** Google 로그인 화면으로 이동한다 (같은 탭에서 돌아온다) */
export async function loginWithSupabaseGoogle(): Promise<AuthResult> {
  const { signInWithGoogle } = await import('../services/supabase/client');
  try {
    window.sessionStorage.setItem(OAUTH_PENDING_KEY, '1');
  } catch {
    // 표시만 못 할 뿐 로그인은 진행된다
  }
  const r = await signInWithGoogle();
  if (!r.ok) {
    try {
      window.sessionStorage.removeItem(OAUTH_PENDING_KEY);
    } catch {
      /* noop */
    }
    return { ok: false, message: r.message };
  }
  return { ok: true, method: 'google', redirecting: true };
}

/**
 * Google 로그인에서 돌아왔으면 세션을 확정하고 로컬 표시 정보(이름·이메일)를 저장한다.
 * 돌아온 경우가 아니면 'none', 로그인 완료면 'signed-in', 취소·실패면 'failed'.
 */
export async function completeSupabaseGoogleLogin(): Promise<'none' | 'signed-in' | 'failed'> {
  const { completeOAuthReturn, hasOAuthResponseInUrl, isSupabaseConfigured } = await import('../services/supabase/client');
  let pending = false;
  try {
    pending = window.sessionStorage.getItem(OAUTH_PENDING_KEY) === '1';
  } catch {
    pending = false;
  }
  if (!isSupabaseConfigured() || (!pending && !hasOAuthResponseInUrl())) return 'none';
  try {
    window.sessionStorage.removeItem(OAUTH_PENDING_KEY);
  } catch {
    /* noop */
  }
  const session = await completeOAuthReturn();
  if (!session) return 'failed';
  const meta = (session.user.user_metadata ?? {}) as Record<string, unknown>;
  const str = (v: unknown) => (typeof v === 'string' ? v.trim() : '');
  const email = str(session.user.email);
  const name = str(meta.full_name) || str(meta.name) || email.split('@')[0] || SOCIAL_DISPLAY_NAMES.google;
  const picture = str(meta.avatar_url) || str(meta.picture);
  saveLocalAuth({
    method: 'google',
    displayName: name.slice(0, 16),
    ...(email ? { email } : {}),
    ...(picture ? { picture } : {}),
  });
  return 'signed-in';
}

/** 소셜 로그인 (Google / Kakao / Naver). Google 은 클라이언트 ID 가 없을 때의 체험자 폴백으로도 쓰인다. */
export async function loginWithSocial(provider: SocialProvider): Promise<AuthResult> {
  if (provider === 'google' && !getGoogleClientId()) {
    console.info(
      '[로그인] VITE_GOOGLE_CLIENT_ID 가 비어 있어 실제 Google 로그인 대신 "Google 체험자" 계정으로 진행합니다. ' +
        '.env 에 VITE_GOOGLE_CLIENT_ID 를 설정하면 실제 Google 로그인 팝업이 열립니다.'
    );
  }
  // TODO(auth): Supabase 연동 시 아래로 교체 (kakao, google은 내장 provider, naver는 커스텀 OIDC 필요)
  // const { error } = await supabase.auth.signInWithOAuth({
  //   provider,
  //   options: { redirectTo: window.location.origin },
  // });
  // if (error) return { ok: false, message: '소셜 로그인에 실패했습니다. 잠시 후 다시 시도해 주세요.' };
  if (!ALLOW_STUB_LOGIN) return { ok: false, message: NOT_READY_MESSAGE };

  saveLocalAuth({ method: provider, displayName: SOCIAL_DISPLAY_NAMES[provider] });
  return { ok: true, method: provider };
}

/** 게스트 로그인: 별도 인증 없이 바로 진행 */
export async function loginAsGuest(): Promise<AuthResult> {
  // 게스트는 인증이 필요 없습니다. 추후 익명 세션(supabase.auth.signInAnonymously 등)을
  // 쓰고 싶다면 여기에서 처리하세요.
  saveLocalAuth({ method: 'guest', displayName: '게스트 체험자' });
  return { ok: true, method: 'guest' };
}
