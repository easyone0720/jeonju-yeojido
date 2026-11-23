import { getPastLifeMode } from '../../config/features';
import { mockGenerator } from './mockGenerator';
import {
  ImagePart,
  PastLifeApiNotReadyError,
  PastLifeGenerator,
  PastLifeMode,
  StoryPart,
  VoicePart,
  throwIfAborted,
} from './types';

export * from './types';
export { mockGenerator, mockPartsForStory, characterToStoryPart } from './mockGenerator';
// 화면이 데이터 파일을 직접 읽지 않도록, 화면용 순수 헬퍼는 서비스 계층에서 다시 내보낸다
export { parseDialogue, characterToStory } from '../../data/characters';
export type { DialogueRow, Character } from '../../data/characters';

/**
 * 'api' 모드 자리표시자. 실제 AI API 가 연결되기 전까지 모든 단계가 PastLifeApiNotReadyError 로 거부되고,
 * usePastLifeGeneration 훅이 단계별로 Mock 결과로 폴백한다(상태 'fallback').
 * 다음 단계에서 이 구현체를 서버 함수(`/api/ai/*`)를 호출하는 apiGenerator 로 교체한다.
 */
export const apiPlaceholderGenerator: PastLifeGenerator = {
  mode: 'api',
  async story(_input, signal): Promise<StoryPart> {
    throwIfAborted(signal);
    throw new PastLifeApiNotReadyError('story');
  },
  async image(_story, signal): Promise<ImagePart> {
    throwIfAborted(signal);
    throw new PastLifeApiNotReadyError('image');
  },
  async voice(_story, signal): Promise<VoicePart> {
    throwIfAborted(signal);
    throw new PastLifeApiNotReadyError('voice');
  },
};

/** 현재 모드(또는 지정한 모드)에 맞는 생성기 */
export function createPastLifeGenerator(mode: PastLifeMode = getPastLifeMode()): PastLifeGenerator {
  return mode === 'api' ? apiPlaceholderGenerator : mockGenerator;
}

/** API 모드에서 실패한 단계를 대신할 생성기. Mock 모드에는 폴백이 필요 없다. */
export function createFallbackGenerator(mode: PastLifeMode = getPastLifeMode()): PastLifeGenerator | null {
  return mode === 'api' ? mockGenerator : null;
}
