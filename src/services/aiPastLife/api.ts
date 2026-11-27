/**
 * 맞춤형 전생 생성·조회 클라이언트. 서버 `/api/past-life/story` 만 호출한다(로컬 apiFetch 를 거치지 않음).
 * 요청에는 Supabase Auth(Google) 액세스 토큰과 이름·띠 코드·4개 조각만 담는다. 생년월일은 담지 않는다.
 */
import type { Fragments, PastLifeResultView } from '../../../api/past-life/story';
import { BUCKETS } from './constants';
import { getCurrentSession, publicUrl } from '../supabase/client';

export type { DialogueLine, Fragments, PastLifeResultView, PastLifeStoryOutput } from '../../../api/past-life/story';

export const STORY_ENDPOINT = '/api/past-life/story';

export class LoginRequiredError extends Error {
  constructor() {
    super('Google 로그인이 필요합니다.');
    this.name = 'LoginRequiredError';
  }
}

async function call<T>(body: Record<string, unknown>, timeoutMs: number, signal?: AbortSignal): Promise<T> {
  const session = await getCurrentSession();
  if (!session) throw new LoginRequiredError();
  const controller = new AbortController();
  const onAbort = () => controller.abort();
  signal?.addEventListener('abort', onAbort, { once: true });
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  let res: Response;
  try {
    res = await fetch(STORY_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
  } catch (err) {
    if (signal?.aborted) throw new DOMException('취소되었습니다.', 'AbortError');
    if (controller.signal.aborted) throw new Error('응답 시간이 초과되었습니다. 다시 시도해 주세요.');
    throw err instanceof Error ? err : new Error(String(err));
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener('abort', onAbort);
  }
  let payload: Record<string, unknown> = {};
  try {
    payload = (await res.json()) as Record<string, unknown>;
  } catch {
    // 아래에서 실패 처리
  }
  if (res.status === 401) throw new LoginRequiredError();
  if (!res.ok) {
    const base = typeof payload.error === 'string' ? payload.error : `요청이 실패했습니다. (${res.status})`;
    // 개발 서버는 실패 단계·원인을 함께 돌려준다(배포에서는 단계만). 화면 안내와 콘솔에 남긴다
    const where = typeof payload.step === 'string' ? payload.step : null;
    const detail = typeof payload.detail === 'string' ? payload.detail : null;
    if (where || detail) console.error('[past-life] 요청 실패', { status: res.status, step: where, code: payload.code, detail });
    throw new Error(detail ? `${base}\n(${where ?? '원인'}: ${detail})` : base);
  }
  return payload as T;
}

export function generateStory(
  input: { name: string; zodiacCode: string | null; fragments: Fragments },
  signal?: AbortSignal,
): Promise<{ result: PastLifeResultView }> {
  return call({ action: 'story', name: input.name, zodiacCode: input.zodiacCode, fragments: input.fragments }, 70_000, signal);
}

export function generateAssets(
  resultId: string,
  signal?: AbortSignal,
): Promise<{ result: PastLifeResultView; assets: { image: 'ok' | 'failed' | 'skipped'; voice: 'ok' | 'failed' | 'skipped' } }> {
  return call({ action: 'assets', resultId }, 70_000, signal);
}

/** 공유 링크로 연 결과 1건 — 로그인 없이 읽는다(소유자 정보는 서버가 지운다) */
export async function getSharedResult(resultId: string, signal?: AbortSignal): Promise<{ result: PastLifeResultView }> {
  const res = await fetch(STORY_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'shared', resultId }),
    signal,
  });
  const payload = (await res.json().catch(() => ({}))) as { result?: PastLifeResultView; error?: string };
  if (!res.ok || !payload.result) throw new Error(payload.error ?? `공유된 결과를 불러오지 못했습니다. (${res.status})`);
  return { result: payload.result };
}

/** 이 결과를 열람하는 공유 주소 (현재 사이트 루트 + sharedResult 파라미터) */
export function buildShareUrl(resultId: string): string {
  const url = new URL(window.location.origin + '/');
  url.searchParams.set('sharedResult', resultId);
  return url.toString();
}

/** 주소창의 ?sharedResult=<uuid> (없거나 형식이 틀리면 null) */
export function readSharedResultId(search: string = typeof window === 'undefined' ? '' : window.location.search): string | null {
  const v = new URLSearchParams(search).get('sharedResult');
  return v && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v) ? v : null;
}

export function getResult(resultId: string, signal?: AbortSignal): Promise<{ result: PastLifeResultView }> {
  return call({ action: 'get', resultId }, 20_000, signal);
}

export function listResults(signal?: AbortSignal): Promise<{ results: PastLifeResultView[] }> {
  return call({ action: 'list' }, 20_000, signal);
}

export async function assetUrls(
  row: Pick<PastLifeResultView, 'image_path' | 'voice_path'> & { character_id?: string },
): Promise<{ image: string | null; voice: string | null }> {
  const [image, voice] = await Promise.all([publicUrl(BUCKETS.portrait, row.image_path), publicUrl(BUCKETS.voice, row.voice_path)]);
  // 외부 초상화 생성이 모두 실패해 image_path 가 없으면, 같은 유형의 참고 캐릭터 초상화(public/characters/NN.jpg)로 대체한다
  const fallback = !image && row.character_id && /^\d{2}$/.test(row.character_id) ? `/characters/${row.character_id}.jpg` : null;
  return { image: image ?? fallback, voice };
}

// ---- 이 탭에서 마지막으로 본 결과 id (새로고침 복원용. 개인정보 없음) ----
const LAST_KEY_PREFIX = 'jeonsaeng:v3:aiResult:';

export function readLastResultId(sessionId: string): string | null {
  try {
    return window.sessionStorage.getItem(LAST_KEY_PREFIX + sessionId);
  } catch {
    return null;
  }
}

export function writeLastResultId(sessionId: string, resultId: string): void {
  try {
    window.sessionStorage.setItem(LAST_KEY_PREFIX + sessionId, resultId);
  } catch {
    // 저장소를 못 쓰면 새로고침 복원만 안 된다
  }
}

export interface AdminTypeStat {
  category_code: string;
  name: string;
  count: number;
}

/** 운영자 대시보드: Supabase 의 전생 유형(story_categories)별 저장된 결과 수(전체 기간). 실패하면 null */
export async function fetchAdminTypeStats(passcode?: string, signal?: AbortSignal): Promise<{ total: number; types: AdminTypeStat[] } | null> {
  try {
    const res = await fetch(STORY_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...(passcode ? { 'x-admin-passcode': encodeURIComponent(passcode) } : {}) },
      body: JSON.stringify({ action: 'admin_type_stats' }),
      signal,
    });
    if (!res.ok) return null;
    const body = (await res.json()) as { total?: number; types?: AdminTypeStat[] };
    return Array.isArray(body.types) ? { total: body.total ?? 0, types: body.types } : null;
  } catch {
    return null;
  }
}
