import assert from 'node:assert/strict';
import { beforeEach, describe, it } from 'node:test';

// 브라우저 저장소 대역 (node 에는 window 가 없다)
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
(globalThis as unknown as { window: unknown }).window = {
  sessionStorage,
  localStorage,
  location: { origin: 'http://localhost' },
};
// 서버(fetch)가 호출되면 즉시 실패하게 만들어 "서버 없이 동작"을 보장한다
globalThis.fetch = (() => {
  throw new Error('fetch must not be called in local mode');
}) as typeof fetch;

const { apiFetch } = await import('./localApi.ts');
const {
  CHARACTERS,
  clearCurrentCharacter,
  getCharacterById,
  getOrPickCurrentCharacter,
  parseDialogue,
  pickAnotherCharacter,
  pickRandomCharacter,
} = await import('../data/characters.ts');
const { ENABLE_AI_GENERATION, USE_LOCAL_BACKEND } = await import('../config/features.ts');

async function call(method: string, url: string, body?: unknown) {
  const res = await apiFetch(url, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  return { status: res.status, data: (await res.json()) as any };
}

async function registerDemo() {
  const r = await call('POST', '/api/auth/register', {
    mode: 'demo',
    visitorName: '시연 탐험가',
    birthDate: '1998-05-15',
    companion: 'alone',
    permissionsAcknowledged: { location: true, camera: true },
  });
  assert.equal(r.status, 201);
  return r.data.session as { sessionId: string };
}

const SPOTS = ['gyeonggijeon', 'jeollagamyeong', 'wanpanbon', 'nambu_market'] as const;

beforeEach(() => {
  sessionStorage.clear();
  localStorage.clear();
});

describe('features', () => {
  it('기본값: 로컬 백엔드 사용, AI 생성 비활성', () => {
    assert.equal(USE_LOCAL_BACKEND, true);
    assert.equal(ENABLE_AI_GENERATION, false);
  });
});

describe('characters', () => {
  it('10종 데이터가 모두 채워져 있다', () => {
    assert.equal(CHARACTERS.length, 10);
    for (const c of CHARACTERS) {
      assert.ok(c.emoji && c.title && c.setting && c.dialogue && c.ending && c.quote, c.id);
      assert.ok(c.result.job && c.result.reputation && c.result.achievement, c.id);
      assert.match(c.imageUrl, /^\/characters\/\d\d\.webp$/);
      assert.match(c.audioUrl, /^\/characters\/\d\d\.mp3$/);
      assert.ok(parseDialogue(c.dialogue).length >= 5, c.id);
    }
  });

  it('직전 캐릭터가 연속으로 뽑히지 않는다', () => {
    let last: string | null = null;
    for (let i = 0; i < 2000; i += 1) {
      const c = pickRandomCharacter(last);
      assert.notEqual(c.id, last);
      last = c.id;
    }
  });

  it('현재 캐릭터는 새로고침(재호출)해도 유지되고, 명시적으로 바꿀 때만 바뀐다', () => {
    const first = getOrPickCurrentCharacter();
    for (let i = 0; i < 50; i += 1) assert.equal(getOrPickCurrentCharacter().id, first.id);
    const another = pickAnotherCharacter(first.id);
    assert.notEqual(another.id, first.id);
    assert.equal(getOrPickCurrentCharacter().id, another.id);
    clearCurrentCharacter();
    // 해제 후 새로 뽑으면 직전(another)과 달라야 한다 (localStorage 의 마지막 id)
    assert.notEqual(getOrPickCurrentCharacter().id, another.id);
  });
});

describe('localApi: 서버 없이 전체 플로우', () => {
  it('등록 → 조각 4개 → 박물관 → 결과 → 미디어월 → 쿠폰 → 삭제', async () => {
    const session = await registerDemo();
    const id = session.sessionId;

    for (const spotId of SPOTS) {
      const r = await call('POST', `/api/session/${id}/verify-qr`, { spotId, demoSimulated: true });
      assert.equal(r.status, 200, `${spotId} ${JSON.stringify(r.data)}`);
      assert.ok(r.data.claimedClue);
    }

    // 같은 장소 재인증은 409
    const dup = await call('POST', `/api/session/${id}/verify-qr`, { spotId: 'gyeonggijeon', demoSimulated: true });
    assert.equal(dup.status, 409);

    const museum = await call('POST', `/api/session/${id}/verify-qr`, { spotId: 'jeonju_museum', demoSimulated: true });
    assert.equal(museum.status, 200);

    const gen = await call('POST', '/api/past-life/generate', { sessionId: id, portraitDataUrl: '' });
    assert.equal(gen.status, 200, JSON.stringify(gen.data));
    const result = gen.data.result;
    const character = getOrPickCurrentCharacter();
    assert.equal(result.title, character.title);
    assert.equal(result.story.jobTitle, character.title);
    assert.equal(result.portraitDataUrl, character.imageUrl);
    assert.equal(result.generationSource, 'curated-demo');
    assert.equal(gen.data.session.currentScene, 10);

    // 결과를 다시 만들어도 같은 캐릭터 (새로고침 안정성)
    const gen2 = await call('POST', '/api/past-life/generate', { sessionId: id, portraitDataUrl: '' });
    assert.equal(gen2.data.result.title, character.title);

    // 쿠폰: 발급 시 바코드·유효기간이 채워지고, 사용 처리는 1회만
    const coupon = gen.data.session.coupons.find((c: any) => c.unlocked);
    assert.ok(coupon.barcodeNumber.includes('-DEMO-'));
    assert.ok(coupon.expiresAt);
    const use1 = await call('POST', `/api/session/${id}/coupons/${coupon.id}/use`);
    assert.equal(use1.status, 200);
    const use2 = await call('POST', `/api/session/${id}/coupons/${coupon.id}/use`);
    assert.equal(use2.status, 409);

    // '다른 전생 확인하기' 이후 미디어월 전시는 화면의 현재 캐릭터 기준
    const other = pickAnotherCharacter(character.id);
    const consent = await call('POST', '/api/wall/consent', { sessionId: id, consent: 'accepted' });
    assert.equal(consent.status, 200);
    assert.equal(consent.data.entry.title, other.title);
    assert.equal(consent.data.entry.portraitDataUrl, other.imageUrl);
    const wall = await call('GET', '/api/wall');
    assert.equal(wall.data.liveEntries.length, 1);
    assert.ok(wall.data.demoSeeds.length > 0);

    const declined = await call('POST', '/api/wall/consent', { sessionId: id, consent: 'declined' });
    assert.equal(declined.status, 200);
    assert.equal((await call('GET', '/api/wall')).data.liveEntries.length, 0);

    // 기록 삭제 → 세션·고정 캐릭터 해제
    const del = await call('DELETE', '/api/auth/record?mode=demo');
    assert.equal(del.status, 200);
    assert.equal((await call('GET', '/api/auth/me?mode=demo')).data.authenticated, false);
    assert.equal(sessionStorage.getItem('jeonsaeng:currentCharacterId'), null);
  });

  it('조각이 부족하면 결과를 만들 수 없다', async () => {
    const session = await registerDemo();
    const r = await call('POST', '/api/past-life/generate', { sessionId: session.sessionId });
    assert.equal(r.status, 400);
  });

  it('잘못된 요청은 에러 응답으로 끝나고 예외를 던지지 않는다', async () => {
    assert.equal((await call('POST', '/api/auth/register', { mode: 'demo', birthDate: 'x' })).status, 400);
    assert.equal((await call('POST', '/api/session/nope/claim', { spotId: 'gyeonggijeon' })).status, 401);
    assert.equal((await call('POST', '/api/auth/recover', {})).status, 404);
    assert.equal((await call('POST', '/api/admin/stats', {})).status, 503);
    assert.equal((await call('GET', '/api/unknown')).status, 404);
    assert.equal((await call('GET', '/api/config/map')).data.configured, false);
    assert.equal((await call('GET', '/api/auth/me?mode=experience')).data.authenticated, false);
  });

  it('세션 저장소를 쓸 수 없어도 메모리로 동작한다', async () => {
    const w = (globalThis as any).window;
    const original = w.sessionStorage;
    w.sessionStorage = {
      getItem() { throw new Error('blocked'); },
      setItem() { throw new Error('blocked'); },
      removeItem() { throw new Error('blocked'); },
    };
    try {
      const s = await registerDemo();
      const me = await call('GET', '/api/auth/me?mode=demo');
      assert.equal(me.data.session.sessionId, s.sessionId);
    } finally {
      w.sessionStorage = original;
    }
  });
});

void getCharacterById;
