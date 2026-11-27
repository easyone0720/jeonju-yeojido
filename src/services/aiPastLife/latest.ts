/**
 * 가장 최근에 만든 AI 전생 결과(제목·한 줄·초상화 주소) — 앱 전체 화면이 같은 결과를 보여 주기 위한 가벼운 공유 저장소.
 * 이 탭의 sessionStorage 에만 두고(개인정보 없음), 바뀌면 이벤트로 모든 구독 화면에 알린다.
 * 홈 완성 배너·결과·저장·공유·미디어월 동의 화면이 같은 값을 읽는다.
 */
import { useMemo, useSyncExternalStore } from 'react';
import type { PastLifeResult } from '../../types/jeonju';
import type { PastLifeResultView } from '../../../api/past-life/story';

export interface LatestAiResult {
  sessionId: string;
  id: string;
  title: string;
  oneLine: string;
  categoryName: string;
  setting: string;
  job: string;
  reputation: string;
  achievement: string;
  ending: string;
  /** Storage 공개 주소 또는 기존 캐릭터 초상화 경로(/characters/NN.jpg). 없으면 null */
  imageUrl: string | null;
  updatedAt: string;
}

const KEY = 'jeonsaeng:v3:aiLatest';
const EVENT = 'jeonsaeng:aiLatest';
const EMPTY = '';

function readRaw(): string {
  try {
    return window.sessionStorage.getItem(KEY) ?? EMPTY;
  } catch {
    return EMPTY;
  }
}

export function readLatestAiResult(sessionId?: string | null): LatestAiResult | null {
  const raw = readRaw();
  if (!raw) return null;
  try {
    const v = JSON.parse(raw) as LatestAiResult;
    if (!v?.title) return null;
    return sessionId && v.sessionId !== sessionId ? null : v;
  } catch {
    return null;
  }
}

/** 한 줄 요약: 낭독문의 첫 문장(없으면 결과 평판) */
function oneLineOf(row: PastLifeResultView): string {
  const first = row.story.narration_text.split(/(?<=[.!?。…])\s/)[0]?.trim();
  return (first && first.length <= 80 ? first : row.story.story.result.reputation).slice(0, 80);
}

export function publishLatestAiResult(sessionId: string, row: PastLifeResultView, imageUrl: string | null): void {
  const next: LatestAiResult = {
    sessionId,
    id: row.id,
    title: row.story.title,
    oneLine: oneLineOf(row),
    categoryName: row.category_name,
    setting: row.story.story.setting,
    job: row.story.story.result.job,
    reputation: row.story.story.result.reputation,
    achievement: row.story.story.result.achievement,
    ending: row.story.story.ending,
    imageUrl,
    updatedAt: new Date().toISOString(),
  };
  try {
    const raw = JSON.stringify(next);
    if (raw === readRaw()) return;
    window.sessionStorage.setItem(KEY, raw);
  } catch {
    // 저장소를 쓸 수 없어도 화면은 동작한다
  }
  window.dispatchEvent(new Event(EVENT));
}

export function clearLatestAiResult(): void {
  try {
    window.sessionStorage.removeItem(KEY);
  } catch {
    // ignore
  }
  window.dispatchEvent(new Event(EVENT));
}

function subscribe(cb: () => void): () => void {
  window.addEventListener(EVENT, cb);
  window.addEventListener('storage', cb);
  return () => {
    window.removeEventListener(EVENT, cb);
    window.removeEventListener('storage', cb);
  };
}

/** 최신 AI 전생 결과를 구독한다. 없으면 null (이때는 기존 Mock 결과를 그대로 쓴다) */
export function useLatestAiResult(sessionId?: string | null): LatestAiResult | null {
  const raw = useSyncExternalStore(subscribe, readRaw, () => EMPTY);
  return useMemo(() => {
    if (!raw) return null;
    try {
      const v = JSON.parse(raw) as LatestAiResult;
      return v?.title && (!sessionId || v.sessionId === sessionId) ? v : null;
    } catch {
      return null;
    }
  }, [raw, sessionId]);
}

/** 세션의 기본(Mock) 결과 위에 최신 AI 결과의 제목·한 줄·초상화를 덮어쓴다 */
export function overlayAiResult(result: PastLifeResult | null, latest: LatestAiResult | null): PastLifeResult | null {
  if (!result || !latest) return result;
  return {
    ...result,
    title: latest.title,
    hanjaTitle: '',
    oneLineSummary: latest.oneLine,
    portraitDataUrl: latest.imageUrl ?? result.portraitDataUrl,
    characterId: undefined,
    generationSource: 'claude-ai',
  };
}

// ---- 결과 확인 여부 (홈 하단 완성 배너를 "새 결과" 초록색으로 보여 줄지 결정) ----
const SEEN_KEY = 'jeonsaeng:v3:resultSeen:';

export function isResultSeen(sessionId: string): boolean {
  try {
    return window.localStorage.getItem(SEEN_KEY + sessionId) === '1';
  } catch {
    return false;
  }
}

export function markResultSeen(sessionId: string): void {
  try {
    window.localStorage.setItem(SEEN_KEY + sessionId, '1');
  } catch {
    // 표시만 못 할 뿐이다
  }
}
