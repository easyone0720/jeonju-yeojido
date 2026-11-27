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

const { apiFetch, assignRandomCoupons, getLocalCouponCategoryStats, summarizeCouponsByCategory } = await import('./localApi.ts');
const { COUPON_CATEGORIES, COUPON_TEMPLATES, pickCouponTemplate } = await import('../data/coupons.ts');
const {
  CHARACTERS,
  clearCurrentCharacter,
  getCharacterById,
  getOrPickCurrentCharacter,
  parseDialogue,
  pickAnotherCharacter,
  pickRandomCharacter,
} = await import('../data/characters.ts');
const { SPOT_QR_ALLOWLIST } = await import('../data/qrAllowlist.ts');
const { ENABLE_AI_GENERATION, USE_LOCAL_BACKEND } = await import('../config/features.ts');

async function call(method: string, url: string, body?: unknown) {
  const res = await apiFetch(url, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  return { status: res.status, data: (await res.json()) as any };
}

async function registerUser() {
  const r = await call('POST', '/api/auth/register', {
    visitorName: '테스트 탐험가',
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
      assert.match(c.imageUrl, /^\/characters\/\d\d\.jpg$/);
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
  it('등록 → 조각 4개 → 박물관 → 결과 → 미디어월 → 쿠폰', async () => {
    const session = await registerUser();
    const id = session.sessionId;

    for (const spotId of SPOTS) {
      const r = await call('POST', `/api/session/${id}/verify-qr`, { spotId, qrCodeValue: SPOT_QR_ALLOWLIST[spotId] });
      assert.equal(r.status, 200, `${spotId} ${JSON.stringify(r.data)}`);
      assert.ok(r.data.claimedClue);
    }

    // 같은 장소 재인증은 409
    const dup = await call('POST', `/api/session/${id}/verify-qr`, { spotId: 'gyeonggijeon', qrCodeValue: SPOT_QR_ALLOWLIST.gyeonggijeon });
    assert.equal(dup.status, 409);

    const museum = await call('POST', `/api/session/${id}/verify-qr`, { spotId: 'jeonju_museum', qrCodeValue: SPOT_QR_ALLOWLIST.jeonju_museum });
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

    // 진행 기록은 같은 탭에서 유지된다
    assert.equal((await call('GET', '/api/auth/me?mode=experience')).data.authenticated, true);
  });

  it('QR 없이(시연 우회) 인증하면 거절한다', async () => {
    const session = await registerUser();
    const r = await call('POST', `/api/session/${session.sessionId}/verify-qr`, { spotId: 'gyeonggijeon', demoSimulated: true });
    assert.equal(r.status, 400);
  });

  it('조각이 부족하면 결과를 만들 수 없다', async () => {
    const session = await registerUser();
    const r = await call('POST', '/api/past-life/generate', { sessionId: session.sessionId });
    assert.equal(r.status, 400);
  });

  it('잘못된 요청은 에러 응답으로 끝나고 예외를 던지지 않는다', async () => {
    assert.equal((await call('POST', '/api/auth/register', { birthDate: 'x' })).status, 400);
    assert.equal((await call('POST', '/api/session/nope/claim', { spotId: 'gyeonggijeon' })).status, 401);
    assert.equal((await call('POST', '/api/auth/recover', {})).status, 404);
    assert.equal((await call('POST', '/api/admin/stats', {})).status, 503);
    assert.equal((await call('GET', '/api/unknown')).status, 404);
    assert.equal((await call('GET', '/api/config/map')).data.configured, false);
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
      const s = await registerUser();
      const me = await call('GET', '/api/auth/me?mode=experience');
      assert.equal(me.data.session.sessionId, s.sessionId);
    } finally {
      w.sessionStorage = original;
    }
  });
});

describe('쿠폰 12종 랜덤 발급', () => {
  it('4개 카테고리 × 3종 = 12종 마스터 데이터', () => {
    assert.equal(COUPON_TEMPLATES.length, 12);
    assert.deepEqual(COUPON_CATEGORIES, ['카페', '식당', '숙박권', '전주 지역 상품권']);
    for (const cat of COUPON_CATEGORIES) {
      assert.equal(COUPON_TEMPLATES.filter((t) => t.category === cat).length, 3, cat);
    }
    assert.equal(new Set(COUPON_TEMPLATES.map((t) => t.id)).size, 12);
    for (const t of COUPON_TEMPLATES) assert.ok(t.storeName && t.benefit && t.locationHint, t.id);
  });

  it('카테고리를 균등 확률로 먼저 고른다', () => {
    const counts: Record<string, number> = {};
    const N = 8000;
    for (let i = 0; i < N; i++) {
      const t = pickCouponTemplate([]);
      counts[t.category] = (counts[t.category] ?? 0) + 1;
    }
    for (const cat of COUPON_CATEGORIES) {
      const ratio = (counts[cat] ?? 0) / N;
      assert.ok(ratio > 0.22 && ratio < 0.28, `${cat} ${ratio}`);
    }
  });

  it('보유 중인 쿠폰은 피하고, 4장을 받아도 중복이 없다', () => {
    for (let n = 0; n < 300; n++) {
      const held: string[] = [];
      for (let k = 0; k < 4; k++) {
        const t = pickCouponTemplate(held);
        assert.ok(!held.includes(t.id));
        held.push(t.id);
      }
    }
    // 카페 2종을 보유해도 남은 1종 또는 다른 카테고리만 나온다
    for (let n = 0; n < 200; n++) {
      assert.ok(!['cafe-1', 'cafe-2'].includes(pickCouponTemplate(['cafe-1', 'cafe-2']).id));
    }
    // 카페 3종을 모두 보유하면 카페는 선택되지 않는다
    for (let n = 0; n < 200; n++) {
      assert.notEqual(pickCouponTemplate(['cafe-1', 'cafe-2', 'cafe-3']).category, '카페');
    }
  });

  it('한 사용자에게 4장을 발급하면 4개 카테고리가 한 장씩 모두 나온다 (카테고리 중복 없음)', () => {
    for (let n = 0; n < 500; n++) {
      const held: string[] = [];
      const cats: string[] = [];
      for (let k = 0; k < 4; k++) {
        const t = pickCouponTemplate(held);
        held.push(t.id);
        cats.push(t.category);
      }
      assert.equal(new Set(cats).size, 4, cats.join(','));
    }
    // assignRandomCoupons(여러 슬롯을 한 번에 열 때)도 같은 보장
    const slot = (id: string) => ({ id, spotId: 'gyeonggijeon', category: '카페', title: '', partnerArea: '', benefit: '', condition: '', expiresLabel: '', isDemoCoupon: true, unlocked: true, used: false }) as never;
    for (let n = 0; n < 200; n++) {
      const out = assignRandomCoupons([slot('a'), slot('b'), slot('c'), slot('d')]);
      assert.equal(new Set(out.map((c) => c.category)).size, 4);
    }
  });

  it('assignRandomCoupons 는 열린 슬롯에만 채우고 이미 채운 슬롯은 유지한다', () => {
    const base = (id: string, unlocked: boolean) => ({
      id, spotId: 'gyeonggijeon', category: '식당', title: 't', partnerArea: 'p', benefit: 'b', condition: 'c',
      expiresLabel: 'e', isDemoCoupon: true, unlocked, used: false,
    }) as any;
    const once = assignRandomCoupons([base('a', true), base('b', false)]);
    assert.ok(once[0].templateId && once[0].locationHint);
    assert.equal(once[1].templateId, undefined);
    const twice = assignRandomCoupons(once);
    assert.equal(twice[0].templateId, once[0].templateId);
  });

  it('스탬프 4개 완료 API: 조각·쿠폰 4장이 한 번에 발급되고 카테고리 현황이 집계된다', async () => {
    const session = await registerUser();
    const r = await call('POST', `/api/session/${session.sessionId}/complete-all-stamps`);
    assert.equal(r.status, 200, JSON.stringify(r.data));
    const s = r.data.session;
    assert.equal(Object.values(s.clues).filter(Boolean).length, 4);
    const issued = s.coupons.filter((c: any) => c.unlocked);
    assert.equal(issued.length, 4);
    assert.equal(new Set(issued.map((c: any) => c.templateId)).size, 4);
    for (const c of issued) {
      assert.ok(COUPON_CATEGORIES.includes(c.category));
      assert.ok(c.barcodeNumber);
    }
    // 시연용 사용 처리도 카테고리와 무관하게 동작
    const use = await call('POST', `/api/session/${session.sessionId}/coupons/${issued[0].id}/use`);
    assert.equal(use.status, 200);
    const stats = getLocalCouponCategoryStats();
    assert.equal(stats.length, 4);
    assert.equal(stats.reduce((a: number, x: any) => a + x.issued, 0), 4);
    assert.equal(stats.reduce((a: number, x: any) => a + x.used, 0), 1);
    assert.equal(summarizeCouponsByCategory([]).every((x: any) => x.issued === 0), true);
    // 이미 완료된 뒤 다시 눌러도 쿠폰이 바뀌지 않는다
    const again = await call('POST', `/api/session/${session.sessionId}/complete-all-stamps`);
    assert.deepEqual(again.data.session.coupons.map((c: any) => c.templateId), s.coupons.map((c: any) => c.templateId));
  });

  it('일반 QR 인증으로 받은 쿠폰도 랜덤 12종 중 하나이고 서로 겹치지 않는다', async () => {
    const session = await registerUser();
    const ids: string[] = [];
    for (const spotId of SPOTS) {
      const r = await call('POST', `/api/session/${session.sessionId}/verify-qr`, { spotId, qrCodeValue: SPOT_QR_ALLOWLIST[spotId] });
      assert.equal(r.status, 200);
      const c = r.data.session.coupons.find((x: any) => x.spotId === spotId);
      assert.ok(c.templateId && COUPON_TEMPLATES.some((t: any) => t.id === c.templateId));
      ids.push(c.templateId);
    }
    assert.equal(new Set(ids).size, 4);
  });
});

void getCharacterById;
