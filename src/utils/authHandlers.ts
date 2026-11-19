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
  | { ok: true; method: LoginMethod }
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

const NOT_READY_MESSAGE = '로그인 연동 준비 중입니다. 게스트 로그인으로 이용해 주세요.';

// ---------------------------------------------------------------------------------------------
// 로컬 회원 저장소 (localStorage `jeonju_auth_users`)
// ---------------------------------------------------------------------------------------------
export const AUTH_USERS_KEY = 'jeonju_auth_users';

/** 처음 실행 시 자동 등록되는 시연 계정 */
export const DEFAULT_DEMO_ACCOUNT = { id: 'test', password: '1234', name: '전주여행자' } as const;

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
    return memoryUsers ?? [];
  } catch {
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

/** 기본 시연 계정(test / 1234)이 없으면 자동 등록한다. 여러 번 호출해도 안전하다. */
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
  if (!user) {
    return { ok: false, message: '등록되지 않은 아이디입니다. 간편 회원가입으로 먼저 가입해 주세요.' };
  }
  if (user.passwordHash !== (await hashPassword(id, password))) {
    return { ok: false, message: '비밀번호가 일치하지 않습니다.' };
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

/** 소셜 로그인 (Google / Kakao / Naver) */
export async function loginWithSocial(provider: SocialProvider): Promise<AuthResult> {
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
