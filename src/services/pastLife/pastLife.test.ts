import assert from 'node:assert/strict';
import { beforeEach, describe, it } from 'node:test';

// 브라우저 저장소·URL 대역 (node 에는 window 가 없다)
class MemoryStorage {
  private map = new Map<string, string>();
  getItem(k: string) {
    return this.map.has(k) ? (this.map.get(k) as string) : null;
  }
  setItem(k: string, v: string) {
    this.map.set(k, String(v));
  }
  removeItem(k: string) {
    this.map.delete(k);
  }
  clear() {
    this.map.clear();
  }
}
const sessionStorage = new MemoryStorage();
const localStorage = new MemoryStorage();
const location = { origin: 'http://localhost', search: '' };
(globalThis as unknown as { window: unknown }).window = { sessionStorage, localStorage, location };

const features = await import('../../config/features.ts');
const service = await import('./index.ts');
const { CHARACTERS, getOrPickCurrentCharacter } = await import('../../data/characters.ts');

beforeEach(() => {
  sessionStorage.clear();
  localStorage.clear();
  location.search = '';
});

describe('전생 결과 모드 스위치', () => {
  it('빌드 기본값은 mock 이고, 기존 호환 플래그는 그대로 false 이다', () => {
    assert.equal(features.PAST_LIFE_MODE_DEFAULT, 'mock');
    assert.equal(features.ENABLE_AI_GENERATION, false);
    assert.equal(features.USE_LOCAL_BACKEND, true);
    assert.equal(features.getPastLifeMode(), 'mock');
  });

  it('URL 쿼리 해석: ?mock=1 / ?mode=mock 은 강제 Mock, ?mock=0 은 해제, api 는 URL 로 켤 수 없다', () => {
    assert.equal(features.readModeOverrideFromSearch('?mock=1'), 'mock');
    assert.equal(features.readModeOverrideFromSearch('?mock'), 'mock');
    assert.equal(features.readModeOverrideFromSearch('?mode=MOCK'), 'mock');
    assert.equal(features.readModeOverrideFromSearch('?mock=0'), 'clear');
    assert.equal(features.readModeOverrideFromSearch('?mode=api'), null);
    assert.equal(features.readModeOverrideFromSearch(''), null);
  });

  it('강제 Mock 은 쿼리가 사라져도 같은 탭에서 유지되고 ?mock=0 으로 해제된다', () => {
    location.search = '?mock=1';
    assert.equal(features.getPastLifeMode(), 'mock');
    location.search = '';
    assert.equal(sessionStorage.getItem(features.PAST_LIFE_MODE_OVERRIDE_KEY), 'mock');
    assert.equal(features.getPastLifeMode(), 'mock');
    location.search = '?mock=0';
    assert.equal(features.getPastLifeMode(), features.PAST_LIFE_MODE_DEFAULT);
    assert.equal(sessionStorage.getItem(features.PAST_LIFE_MODE_OVERRIDE_KEY), null);
  });

  it('팩토리: mock → mockGenerator(폴백 없음), api → 자리표시자(+Mock 폴백)', () => {
    assert.equal(service.createPastLifeGenerator('mock'), service.mockGenerator);
    assert.equal(service.createFallbackGenerator('mock'), null);
    assert.equal(service.createPastLifeGenerator('api').mode, 'api');
    assert.equal(service.createFallbackGenerator('api'), service.mockGenerator);
  });
});

describe('mockGenerator (기존 10종 캐릭터와 동일한 결과)', () => {
  it('이 탭에 고정된 캐릭터를 돌려주고, 여러 번 불러도 같다', async () => {
    const first = await service.mockGenerator.story({});
    const again = await service.mockGenerator.story({});
    assert.ok(CHARACTERS.some((c) => c.id === first.characterId));
    assert.equal(again.characterId, first.characterId);
    assert.equal(getOrPickCurrentCharacter().id, first.characterId);
    assert.equal(service.mockGenerator.peekCurrent?.()?.story.characterId, first.characterId);
  });

  it('이미지·음성은 같은 캐릭터의 에셋이고, 음성 문장은 대표 대사와 같다', async () => {
    const story = await service.mockGenerator.story({});
    const c = CHARACTERS.find((x) => x.id === story.characterId)!;
    const image = await service.mockGenerator.image(story);
    const voice = await service.mockGenerator.voice(story);
    assert.equal(image.url, c.imageUrl);
    assert.equal(voice.url, c.audioUrl);
    assert.equal(voice.transcript, c.quote);
    assert.equal(story.quote, c.quote);
  });

  it("'다른 전생 확인하기'(excludeCharacterId)는 현재 캐릭터를 빼고 새로 고정한다", async () => {
    const current = await service.mockGenerator.story({});
    const next = await service.mockGenerator.story({ excludeCharacterId: current.characterId });
    assert.notEqual(next.characterId, current.characterId);
    assert.equal((await service.mockGenerator.story({})).characterId, next.characterId);
  });

  it('중단된 signal 이면 AbortError 로 거부한다', async () => {
    const controller = new AbortController();
    controller.abort();
    await assert.rejects(service.mockGenerator.story({}, controller.signal), (e) => service.isAbortError(e));
  });
});

describe('api 자리표시자', () => {
  it('모든 단계가 PastLifeApiNotReadyError 로 거부되어 훅이 Mock 으로 폴백할 수 있다', async () => {
    const gen = service.createPastLifeGenerator('api');
    await assert.rejects(gen.story({}), service.PastLifeApiNotReadyError);
    const story = service.characterToStoryPart(CHARACTERS[0]);
    await assert.rejects(gen.image(story), service.PastLifeApiNotReadyError);
    await assert.rejects(gen.voice(story), service.PastLifeApiNotReadyError);
    const backup = service.mockPartsForStory(story);
    assert.equal(backup.image.url, CHARACTERS[0].imageUrl);
  });
});
