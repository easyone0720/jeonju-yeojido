/**
 * 실행 방식 스위치 (클라이언트·서버 공용).
 *
 * 1) USE_LOCAL_BACKEND — 세션·QR 인증·쿠폰·미디어월 저장을 어디서 처리하는가 (전생 결과 생성 모드와 별개)
 *    true 이면 브라우저가 Express/DB 없이 로컬 구현(`src/utils/localApi.ts`)으로 처리한다.
 *    false 로 바꾸면 `/api/*` 를 실제 서버로 보낸다(별도 서버 호스팅이 있어야 동작).
 *
 * 2) 전생 결과 생성 모드 — 스토리·이미지·음성을 무엇으로 만드는가: 'mock' | 'api'
 *    - 'mock' (기본값): `charactersData.json` 의 고정 10종 캐릭터 (`src/services/pastLife/mockGenerator.ts`)
 *    - 'api'          : 맞춤형 전생. Google(Supabase Auth) 로그인 후 서버 함수 `/api/past-life/story` 가
 *                       4개 조각·이름·띠 코드로 스토리·초상화·음성을 만들어 Supabase 에 저장한다
 *                       (`src/components/AiPastLifeSection.tsx`, `src/services/aiPastLife/api.ts`).
 *    빌드 기본값은 `VITE_PAST_LIFE_MODE`(mock|api)로 정하고, 없으면 'mock'.
 *    실행 중에는 URL 에 `?mock=1` 또는 `?mode=mock` 을 붙이면 재배포 없이 Mock 으로 강제 전환된다.
 *    이 강제 전환은 같은 탭이 열려 있는 동안 유지되며 `?mock=0` 으로 해제한다.
 *
 * 3) ENABLE_AI_GENERATION — (호환용) server.ts 의 Gemini 경로가 읽던 기존 플래그.
 *    이제 빌드 기본 모드에서 파생된다. node(server.ts)에는 VITE_ 값이 없으므로 기존처럼 false 이다.
 */
export const USE_LOCAL_BACKEND = true;

export type PastLifeMode = 'mock' | 'api';

function readBuildEnv(name: string): string | undefined {
  try {
    // 브라우저(Vite)에서는 import.meta.env 가 있고, node(server.ts·테스트)에서는 없을 수 있다
    const env = (import.meta as unknown as { env?: Record<string, unknown> }).env;
    const value = env?.[name];
    return typeof value === 'string' ? value : undefined;
  } catch {
    return undefined;
  }
}

export function normalizePastLifeMode(value: string | null | undefined): PastLifeMode | null {
  const v = (value ?? '').trim().toLowerCase();
  return v === 'mock' || v === 'api' ? v : null;
}

/** 빌드 시점 기본 모드 (환경변수가 없거나 잘못되면 'mock') */
export const PAST_LIFE_MODE_DEFAULT: PastLifeMode =
  normalizePastLifeMode(readBuildEnv('VITE_PAST_LIFE_MODE')) ?? 'mock';

/** @deprecated server.ts Gemini 경로 호환용. 새 코드는 getPastLifeMode() 를 쓴다. */
export const ENABLE_AI_GENERATION: boolean = PAST_LIFE_MODE_DEFAULT === 'api';

export const PAST_LIFE_MODE_OVERRIDE_KEY = 'jeonsaeng:v2:pastLifeModeOverride';

/**
 * URL 쿼리에서 Mock 강제 여부를 읽는다.
 * - `?mock` / `?mock=1` / `?mock=true` / `?mode=mock` → 'mock'
 * - `?mock=0` / `?mock=false`                         → 'clear' (강제 해제)
 * - 그 외                                             → null (변경 없음)
 * 비용·남용 방지를 위해 URL 로 'api' 를 켜는 것은 허용하지 않는다.
 */
export function readModeOverrideFromSearch(search: string): 'mock' | 'clear' | null {
  let params: URLSearchParams;
  try {
    params = new URLSearchParams(search);
  } catch {
    return null;
  }
  const mock = params.get('mock');
  if (mock !== null) {
    const v = mock.trim().toLowerCase();
    if (v === '' || v === '1' || v === 'true' || v === 'yes') return 'mock';
    if (v === '0' || v === 'false' || v === 'no') return 'clear';
  }
  if (normalizePastLifeMode(params.get('mode')) === 'mock') return 'mock';
  return null;
}

/**
 * 현재 전생 결과 생성 모드. 우선순위: URL 강제 Mock > 이 탭에 기억된 강제 Mock > 빌드 기본값.
 * 화면 전환(pushState)으로 쿼리가 사라져도 같은 탭에서는 강제 Mock 이 유지되도록 sessionStorage 에 기억한다.
 */
export function getPastLifeMode(): PastLifeMode {
  if (typeof window === 'undefined') return PAST_LIFE_MODE_DEFAULT;
  try {
    const fromUrl = readModeOverrideFromSearch(window.location?.search ?? '');
    if (fromUrl === 'mock') {
      window.sessionStorage?.setItem(PAST_LIFE_MODE_OVERRIDE_KEY, 'mock');
      return 'mock';
    }
    if (fromUrl === 'clear') {
      window.sessionStorage?.removeItem(PAST_LIFE_MODE_OVERRIDE_KEY);
      return PAST_LIFE_MODE_DEFAULT;
    }
    if (window.sessionStorage?.getItem(PAST_LIFE_MODE_OVERRIDE_KEY) === 'mock') return 'mock';
  } catch {
    // URL·저장소를 읽을 수 없으면 빌드 기본값
  }
  return PAST_LIFE_MODE_DEFAULT;
}

/**
 * [시연·검수용] 지도 화면의 `[스탬프 4개 완료로 이동]` 빠른 이동 버튼.
 * 4개 거점 QR 인증을 건너뛰고 조각·쿠폰 발급과 박물관 단계를 한 번에 확인한다.
 * TODO: 최종 시연 영상 녹화·배포 전에 false 로 바꾸면 버튼(HomeWorkspace)과 로컬 API 가 모두 꺼진다.
 */
export const ENABLE_QUICK_COMPLETE_BUTTON = true;
