/**
 * 전생 캐릭터 10종 데이터 (원본: charactersData.json).
 * - 이미지: public/characters/NN.jpg (16:9, 1920×1080), 음성: public/characters/NN.mp3
 * - dialogue / setting / ending 은 줄바꿈(\n)을 그대로 유지한다.
 *   dialogue 에서 `화자: "대사"` 는 화자 강조, `( ... )` 한 줄은 지문으로 렌더링된다.
 */

import type { PastLifeStory } from '../types/jeonju';
import charactersData from './charactersData.json';

export interface CharacterResult {
  job: string;
  reputation: string;
  achievement: string;
}

export interface Character {
  id: string;
  emoji: string;
  title: string;
  imageUrl: string;
  audioUrl: string;
  /** 대표 대사 (음성 파일과 동일한 문장) */
  quote: string;
  setting: string;
  dialogue: string;
  result: CharacterResult;
  ending: string;
}

/**
 * 단일 진실 공급원: src/data/charactersData.json
 * id 를 키로 이름(전생 직업명)·이미지·음성·4단 스토리가 1:1 로 묶여 있다.
 * 이미지/음성/스토리를 화면별로 따로 조합하지 말고 항상 characterId 로 이 데이터를 조회한다.
 */
interface CharacterJsonEntry {
  id: string;
  name: string;
  emoji: string;
  image: string;
  audio: string;
  quote: string;
  story: {
    setting: string;
    dialogue: string;
    result: CharacterResult;
    ending: string;
  };
}

export const CHARACTERS: Character[] = Object.values(
  charactersData as unknown as Record<string, CharacterJsonEntry>,
)
  .sort((a, b) => a.id.localeCompare(b.id))
  .map((e) => ({
    id: e.id,
    emoji: e.emoji,
    title: e.name,
    imageUrl: e.image,
    audioUrl: e.audio,
    quote: e.quote,
    setting: e.story.setting,
    dialogue: e.story.dialogue,
    result: e.story.result,
    ending: e.story.ending,
  }));

const LAST_CHARACTER_KEY = 'jeonsaeng:v2:lastCharacterId';

function readLastCharacterId(): string | null {
  try {
    return window.localStorage.getItem(LAST_CHARACTER_KEY);
  } catch {
    return null;
  }
}

function writeLastCharacterId(id: string): void {
  try {
    window.localStorage.setItem(LAST_CHARACTER_KEY, id);
  } catch {
    // 저장소를 쓸 수 없는 환경에서는 중복 방지가 현재 화면 안에서만 동작한다
  }
}

/**
 * 직전 캐릭터(excludeId)를 제외하고 무작위로 하나 뽑는다.
 * excludeId 를 생략하면 마지막으로 뽑힌 캐릭터(localStorage)를 제외한다.
 * 뽑힌 캐릭터 id 는 다음 뽑기를 위해 저장된다.
 */
export function pickRandomCharacter(
  excludeId: string | null = readLastCharacterId(),
  random: () => number = Math.random,
): Character {
  const pool = CHARACTERS.filter((c) => c.id !== excludeId);
  const candidates = pool.length > 0 ? pool : CHARACTERS;
  const picked = candidates[Math.min(candidates.length - 1, Math.floor(random() * candidates.length))];
  writeLastCharacterId(picked.id);
  return picked;
}

export type DialogueRow =
  | { kind: 'line'; speaker: string; text: string }
  | { kind: 'stage'; text: string };

/** dialogue 문자열을 화면 렌더링용 행으로 분해한다. `( ... )` 는 지문, `화자: 대사` 는 대사. */
export function parseDialogue(dialogue: string): DialogueRow[] {
  return dialogue
    .split('\n')
    .map((raw) => raw.trim())
    .filter((raw) => raw.length > 0)
    .map((raw): DialogueRow => {
      if (raw.startsWith('(') && raw.endsWith(')')) {
        return { kind: 'stage', text: raw };
      }
      const idx = raw.indexOf(':');
      if (idx > 0 && idx <= 8) {
        return { kind: 'line', speaker: raw.slice(0, idx).trim(), text: raw.slice(idx + 1).trim() };
      }
      return { kind: 'line', speaker: '', text: raw };
    });
}

/** 캐릭터 → 결과 카드 저장(canvas) 등이 읽는 PastLifeStory 형태 */
export function characterToStory(c: Character): PastLifeStory {
  return {
    jobTitle: c.title,
    setting: c.setting,
    dialogue: parseDialogue(c.dialogue).map((row) =>
      row.kind === 'stage'
        ? { speaker: '', text: row.text.replace(/^\(|\)$/g, '') }
        : { speaker: row.speaker, text: row.text },
    ),
    outcome: { job: c.result.job, reputation: c.result.reputation, achievement: c.result.achievement },
    ending: c.ending,
  };
}

export function getCharacterById(id: string | null | undefined): Character | null {
  return CHARACTERS.find((c) => c.id === id) ?? null;
}

/**
 * characterId 로 이미지 경로를 조회한다. 결과·미디어월·저장 카드는 이 함수(또는 getCharacterById)만 쓴다.
 * characterId 가 없거나 알 수 없으면(이전 버전 기록) fallback 을 돌려준다.
 */
export function resolveCharacterImage(
  characterId: string | null | undefined,
  fallback = '',
): string {
  return getCharacterById(characterId)?.imageUrl ?? fallback;
}

/** characterId 로 음성 파일 경로를 조회한다. */
export function resolveCharacterAudio(characterId: string | null | undefined): string {
  return getCharacterById(characterId)?.audioUrl ?? '';
}

// --- 현재 체험의 캐릭터 고정 (새로고침해도 유지) -------------------------------------------
const CURRENT_CHARACTER_KEY = 'jeonsaeng:v2:currentCharacterId';

function readCurrentCharacterId(): string | null {
  try {
    return window.sessionStorage.getItem(CURRENT_CHARACTER_KEY);
  } catch {
    return null;
  }
}

/** 이번 체험(탭)에서 뽑힌 캐릭터 id. 아직 뽑지 않았으면 null (운영자 대시보드 실시간 합산용, 읽기 전용). */
export function getCurrentCharacterId(): string | null {
  return getCharacterById(readCurrentCharacterId())?.id ?? null;
}

function writeCurrentCharacterId(id: string | null): void {
  try {
    if (id) window.sessionStorage.setItem(CURRENT_CHARACTER_KEY, id);
    else window.sessionStorage.removeItem(CURRENT_CHARACTER_KEY);
  } catch {
    // sessionStorage 를 쓸 수 없으면 이 화면 안에서만 유지된다
  }
}

/** 이번 체험에서 이미 뽑힌 캐릭터가 있으면 그대로, 없으면 (직전 캐릭터 제외) 새로 뽑아 고정한다. */
export function getOrPickCurrentCharacter(): Character {
  const existing = getCharacterById(readCurrentCharacterId());
  if (existing) return existing;
  const picked = pickRandomCharacter();
  writeCurrentCharacterId(picked.id);
  return picked;
}

/** '다른 전생 확인하기' 전용: 현재 캐릭터를 제외하고 새로 뽑아 고정한다. */
export function pickAnotherCharacter(currentId: string): Character {
  const picked = pickRandomCharacter(currentId);
  writeCurrentCharacterId(picked.id);
  return picked;
}

/** 새 체험 시작·기록 삭제 시 고정된 캐릭터를 해제한다 (직전 캐릭터 id 는 localStorage 에 남아 연속 중복을 막는다). */
export function clearCurrentCharacter(): void {
  writeCurrentCharacterId(null);
}
