import type { PastLifeMode } from '../../config/features';

export type { PastLifeMode };

/** 결과 각 단계(스토리·이미지·음성)의 진행 상태 */
export type PartStatus = 'pending' | 'ready' | 'fallback' | 'error';

/**
 * 결과가 어디서 왔는가.
 * - 'mock'  : 고정 캐릭터 데이터
 * - 'api'   : 실제 AI API
 * - 'mixed' : 일부 단계만 API, 나머지는 Mock 폴백
 * (기존 PastLifeResult.generationSource('curated-demo' 등)와는 별개의 서비스 계층용 값)
 */
export type GenerationSource = 'mock' | 'api' | 'mixed';

/** 결과 생성 입력. 'mock' 은 아직 입력값을 쓰지 않지만 'api' 는 프롬프트 재료로 쓴다. */
export interface PastLifeInput {
  sessionId?: string;
  visitorName?: string;
  birthDate?: string;
  archetypeId?: string;
  /** '다른 전생 확인하기': 이 캐릭터를 제외하고 새로 만든다 */
  excludeCharacterId?: string | null;
}

/** 스토리 단계 결과 (화면의 제목·대사·설정·결과·마무리) */
export interface StoryPart {
  characterId: string;
  title: string;
  emoji: string;
  /** 대표 대사. 음성(voice)과 같은 문장이어야 한다 */
  quote: string;
  setting: string;
  /** "화자: 대사" / "(지문)" 을 줄바꿈으로 이은 문자열 */
  dialogue: string;
  result: { job: string; reputation: string; achievement: string };
  ending: string;
}

export interface ImagePart {
  url: string;
  alt: string;
}

export interface VoicePart {
  url: string;
  /** 음성에 담긴 문장 (= story.quote) */
  transcript: string;
}

export interface PastLifeParts {
  story: StoryPart;
  image: ImagePart;
  voice: VoicePart;
}

/**
 * 전생 결과 생성기. 스토리가 먼저 나오고, 이미지·음성은 스토리를 재료로 만든다.
 * 모든 메서드는 AbortSignal 이 중단되면 AbortError(DOMException)로 거부해야 한다.
 */
export interface PastLifeGenerator {
  readonly mode: PastLifeMode;
  story(input: PastLifeInput, signal?: AbortSignal): Promise<StoryPart>;
  image(story: StoryPart, signal?: AbortSignal): Promise<ImagePart>;
  voice(story: StoryPart, signal?: AbortSignal): Promise<VoicePart>;
  /**
   * 기다릴 필요 없이 바로 보여 줄 수 있는 현재 결과(있으면). Mock 은 이 탭에 고정된 캐릭터를 돌려주어
   * 첫 화면이 로딩 없이 기존과 똑같이 그려지게 한다. API 구현체는 보통 null 이다.
   */
  peekCurrent?(): PastLifeParts | null;
}

/** 단계별 상태 */
export interface PartState<T> {
  status: PartStatus;
  data: T | null;
  /** 이 단계 데이터의 출처 ('fallback' 이면 'mock') */
  source: Exclude<GenerationSource, 'mixed'> | null;
  error?: string;
}

/** 아직 구현되지 않은 API 모드에서 던지는 오류 (훅이 받아 Mock 으로 폴백한다) */
export class PastLifeApiNotReadyError extends Error {
  constructor(part: 'story' | 'image' | 'voice') {
    super(`전생 결과 '${part}' API 가 아직 연결되지 않았습니다. Mock 결과로 대체합니다.`);
    this.name = 'PastLifeApiNotReadyError';
  }
}

export function throwIfAborted(signal?: AbortSignal): void {
  if (signal?.aborted) {
    throw new DOMException('전생 결과 생성이 취소되었습니다.', 'AbortError');
  }
}

export function isAbortError(error: unknown): boolean {
  return error instanceof DOMException && error.name === 'AbortError';
}
