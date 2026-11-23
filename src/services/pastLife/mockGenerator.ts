import {
  Character,
  getCharacterById,
  getOrPickCurrentCharacter,
  pickAnotherCharacter,
} from '../../data/characters';
import {
  ImagePart,
  PastLifeGenerator,
  PastLifeInput,
  PastLifeParts,
  StoryPart,
  VoicePart,
  throwIfAborted,
} from './types';

/** Character(고정 데이터) → StoryPart */
export function characterToStoryPart(c: Character): StoryPart {
  return {
    characterId: c.id,
    title: c.title,
    emoji: c.emoji,
    quote: c.quote,
    setting: c.setting,
    dialogue: c.dialogue,
    result: { job: c.result.job, reputation: c.result.reputation, achievement: c.result.achievement },
    ending: c.ending,
  };
}

function characterToImagePart(c: Character): ImagePart {
  return { url: c.imageUrl, alt: `${c.title} 전생 캐릭터 일러스트` };
}

function characterToVoicePart(c: Character): VoicePart {
  return { url: c.audioUrl, transcript: c.quote };
}

function partsOf(c: Character): PastLifeParts {
  return { story: characterToStoryPart(c), image: characterToImagePart(c), voice: characterToVoicePart(c) };
}

function requireCharacter(characterId: string): Character {
  const c = getCharacterById(characterId);
  if (!c) throw new Error(`알 수 없는 캐릭터입니다: ${characterId}`);
  return c;
}

/**
 * 고정 10종 캐릭터(`charactersData.json`) 기반 생성기.
 * 선택 규칙은 기존과 같다: 이 탭에 고정된 캐릭터가 있으면 그대로, 없으면 직전 캐릭터를 피해 무작위로 뽑아 고정.
 * '다른 전생 확인하기'(excludeCharacterId)는 현재 캐릭터를 빼고 다시 뽑아 고정한다.
 */
export const mockGenerator: PastLifeGenerator = {
  mode: 'mock',

  async story(input: PastLifeInput, signal?: AbortSignal): Promise<StoryPart> {
    throwIfAborted(signal);
    const c = input.excludeCharacterId
      ? pickAnotherCharacter(input.excludeCharacterId)
      : getOrPickCurrentCharacter();
    return characterToStoryPart(c);
  },

  async image(story: StoryPart, signal?: AbortSignal): Promise<ImagePart> {
    throwIfAborted(signal);
    return characterToImagePart(requireCharacter(story.characterId));
  },

  async voice(story: StoryPart, signal?: AbortSignal): Promise<VoicePart> {
    throwIfAborted(signal);
    return characterToVoicePart(requireCharacter(story.characterId));
  },

  peekCurrent(): PastLifeParts | null {
    return partsOf(getOrPickCurrentCharacter());
  },
};

/**
 * 폴백용: 실패한 단계의 스토리에 맞는 Mock 이미지·음성.
 * 스토리가 Mock 캐릭터가 아니면(API 가 만든 스토리) 이 탭의 고정 캐릭터 에셋을 쓴다.
 */
export function mockPartsForStory(story: StoryPart | null): PastLifeParts {
  const c = (story && getCharacterById(story.characterId)) || getOrPickCurrentCharacter();
  return partsOf(c);
}
