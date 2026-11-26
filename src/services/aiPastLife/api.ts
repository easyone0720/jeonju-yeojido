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
