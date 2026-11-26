/**
 * 보존 5 — 지도·방문·조각·쿠폰·잠금, 기본 결과 저장·복원, 전시 동의 의미.
 * 앱 코드를 고치지 않고 기존 로컬 API(apiFetch → routeLocal)와 공개 함수만으로 검사한다.
 * App.tsx 안의 화면 연결(잠금 오버레이 표시 등)은 여기서 검사하지 못한다 → 스크린샷 기준으로 확인.
 */
import assert from 'node:assert/strict';
import { beforeEach, describe, it } from 'node:test';
import { clearBrowserStorage, ensureBrowserStubs, readFixture, syntheticBirthDate } from './helpers.ts';

ensureBrowserStubs();
const { apiFetch } = await import('../../src/utils/localApi.ts');
const { JEONJU_SPOTS } = await import('../../src/data/jeonjuSpots.ts');
const { SPOT_QR_ALLOWLIST } = await import('../../src/data/qrAllowlist.ts');
const { COUPON_TEMPLATES, COUPON_CATEGORIES } = await import('../../src/data/coupons.ts');
const { isSpotVisitVerified, isMuseumUnlocked } = await import('../../src/utils/pastLifeEngine.ts');
const { mockGenerator } = await import('../../src/services/pastLife/index.ts');

type SpotFixture = {
  id: string;
  orderNumber: number;
  name: string;
  coordinates: { lat: number; lng: number };
  verifyRadiusMeters: number;
  clueCategory: string | null;
  mapPositionPercent: { x: number; y: number };
  qrCodeValue: string;
};
const spotsFixture = readFixture<SpotFixture[]>('spots.json');
const couponsFixture = readFixture<{ categories: unknown; templates: Array<{ id: string; category: string }> }>(
  'coupons.json',
);
const CLUE_SPOTS = ['wanpanbon', 'gyeonggijeon', 'nambu_market', 'jeollagamyeong'] as const;

async function call(method: string, url: string, body?: unknown) {
  const res = await apiFetch(url, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  return { status: res.status, data: (await res.json()) as any };
}

async function register(i = 0) {
  const r = await call('POST', '/api/auth/register', {
    visitorName: '보존검사',
    birthDate: syntheticBirthDate(i),
    companion: 'alone',
    permissionsAcknowledged: { location: true, camera: true },
  });
  assert.equal(r.status, 201, JSON.stringify(r.data));
  return r.data.session as any;
}

/** 현재 App.tsx 의 잠금 계산과 같은 식 (박물관 제외 거점 중 방문 인증된 수) */
function stampCount(session: any): number {
  return JEONJU_SPOTS.filter((s) => s.id !== 'jeonju_museum' && isSpotVisitVerified(session, s.id)).length;
}

beforeEach(() => clearBrowserStorage());

describe('보존: 지도·거점·QR·조각 기준값', () => {
  it('거점 5곳의 순서·좌표·반경·조각 종류·지도 위치·QR 허용 값이 기준과 같다', () => {
    const qr = SPOT_QR_ALLOWLIST as Record<string, string>;
    assert.deepEqual(
      JEONJU_SPOTS.map((s) => ({
        id: s.id,
        orderNumber: s.orderNumber,
        name: s.name,
        coordinates: s.coordinates,
        verifyRadiusMeters: s.verifyRadiusMeters,
        clueCategory: s.clueCategory ?? null,
        mapPositionPercent: s.mapPositionPercent,
        qrCodeValue: qr[s.id],
      })),
      spotsFixture,
    );
  });

  it('쿠폰 카테고리 4종·템플릿 12종이 기준과 같다', () => {
    assert.deepEqual(COUPON_CATEGORIES, couponsFixture.categories);
    assert.deepEqual(
      COUPON_TEMPLATES.map((t) => ({ id: t.id, category: t.category })),
      couponsFixture.templates,
    );
  });
});

describe('보존: 방문·조각 수집·쿠폰·잠금 조건', () => {
  it('박물관은 조각 4개 전에는 거절되고, 4개 거점 QR 마다 해당 조각 1개와 쿠폰 1장이 열린다', async () => {
    const s0 = await register();
    const id = s0.sessionId;
    assert.equal(stampCount(s0), 0);
    assert.equal(isMuseumUnlocked(s0), false);

    const early = await call('POST', `/api/session/${id}/verify-qr`, {
      spotId: 'jeonju_museum',
      qrCodeValue: SPOT_QR_ALLOWLIST.jeonju_museum,
    });
    assert.equal(early.status, 400);

    let session = s0;
    for (const [n, spotId] of CLUE_SPOTS.entries()) {
      const r = await call('POST', `/api/session/${id}/verify-qr`, { spotId, qrCodeValue: SPOT_QR_ALLOWLIST[spotId] });
      assert.equal(r.status, 200, JSON.stringify(r.data));
      session = r.data.session;
      const expectedCategory = spotsFixture.find((s) => s.id === spotId)!.clueCategory!;
      assert.equal(r.data.claimedClue.category, expectedCategory);
      assert.ok(session.clues[expectedCategory], `${expectedCategory} 조각이 저장되지 않음`);
      assert.equal(stampCount(session), n + 1);
      assert.equal(session.coupons.filter((c: any) => c.unlocked).length, n + 1);
    }
    // 4곳 완료: 잠금 해제 조건 충족, 쿠폰 4장은 서로 다른 템플릿
    assert.equal(stampCount(session), 4, '기념품 잠금 해제 조건(4개) 미충족');
    assert.equal(isMuseumUnlocked(session), true);
    const templates = session.coupons.filter((c: any) => c.unlocked).map((c: any) => c.templateId);
    assert.equal(new Set(templates).size, 4);
    for (const c of session.coupons.filter((c: any) => c.unlocked)) assert.ok(c.barcodeNumber, '바코드 번호 없음');

    // 같은 거점·같은 QR 재인증은 409, 틀린 QR 은 400
    const dup = await call('POST', `/api/session/${id}/verify-qr`, {
      spotId: 'wanpanbon',
      qrCodeValue: SPOT_QR_ALLOWLIST.wanpanbon,
    });
    assert.equal(dup.status, 409);
    const wrong = await call('POST', `/api/session/${id}/verify-qr`, {
      spotId: 'gyeonggijeon',
      qrCodeValue: SPOT_QR_ALLOWLIST.wanpanbon,
    });
    assert.equal(wrong.status, 400); // 현재 동작: QR 값 검사가 먼저라, 이미 인증한 거점이어도 틀린 QR 은 400

    const museum = await call('POST', `/api/session/${id}/verify-qr`, {
      spotId: 'jeonju_museum',
      qrCodeValue: SPOT_QR_ALLOWLIST.jeonju_museum,
    });
    assert.equal(museum.status, 200);
  });

  it('다른 거점의 QR 로는 인증되지 않는다', async () => {
    const s = await register();
    const r = await call('POST', `/api/session/${s.sessionId}/verify-qr`, {
      spotId: 'gyeonggijeon',
      qrCodeValue: SPOT_QR_ALLOWLIST.wanpanbon,
    });
    assert.equal(r.status, 400);
    assert.equal(stampCount(r.data.session ?? s), 0);
  });
});

async function finishedSession(i = 0) {
  const s = await register(i);
  const id = s.sessionId;
  for (const spotId of CLUE_SPOTS) {
    await call('POST', `/api/session/${id}/verify-qr`, { spotId, qrCodeValue: SPOT_QR_ALLOWLIST[spotId] });
  }
  await call('POST', `/api/session/${id}/verify-qr`, {
    spotId: 'jeonju_museum',
    qrCodeValue: SPOT_QR_ALLOWLIST.jeonju_museum,
  });
  const gen = await call('POST', '/api/past-life/generate', { sessionId: id, portraitDataUrl: '' });
  assert.equal(gen.status, 200, JSON.stringify(gen.data));
  return { id, result: gen.data.result };
}

describe('보존: 기본 결과 저장·복원', () => {
  it('생성한 결과가 세션에 저장되고, 다시 조회해도 같은 결과가 돌아온다', async () => {
    const { id, result } = await finishedSession();
    const again = await call('GET', `/api/session/${id}`);
    assert.equal(again.status, 200);
    assert.deepEqual(again.data.session.pastLifeResult, result);
    assert.equal(again.data.session.hasCompletedPastLife, true);
  });

  it('결과를 다시 요청해도 이번 체험의 캐릭터가 바뀌지 않는다', async () => {
    const { id, result } = await finishedSession();
    const second = await call('POST', '/api/past-life/generate', { sessionId: id, portraitDataUrl: '' });
    assert.equal(second.status, 200);
    assert.equal(second.data.result.characterId, result.characterId);
    assert.equal(second.data.result.archetypeId, result.archetypeId);
  });
});

describe('보존: 전시 동의의 의미', () => {
  it('동의 후 결과 화면에서 다른 전생으로 바꿔도 이미 공개된 전시 항목은 그대로다', async () => {
    const { id } = await finishedSession();
    const consent = await call('POST', '/api/wall/consent', { sessionId: id, consent: 'accepted' });
    assert.equal(consent.status, 200, JSON.stringify(consent.data));
    const published = consent.data.entry;

    // 결과 화면의 '다른 전생 확인하기'가 쓰는 것과 같은 호출
    const other = await mockGenerator.story({ excludeCharacterId: published.characterId });
    assert.notEqual(other.characterId, published.characterId);

    const wall = await call('GET', '/api/wall');
    const mine = wall.data.liveEntries.filter((e: any) => e.sessionId === id);
    assert.equal(mine.length, 1);
    assert.equal(mine[0].title, published.title);
    assert.equal(mine[0].characterId, published.characterId);
    assert.equal(mine[0].portraitDataUrl, published.portraitDataUrl);
  });

  it('철회하면 공개 항목이 사라진다', async () => {
    const { id } = await finishedSession();
    await call('POST', '/api/wall/consent', { sessionId: id, consent: 'accepted' });
    const off = await call('POST', '/api/wall/consent', { sessionId: id, consent: 'declined' });
    assert.equal(off.status, 200);
    const wall = await call('GET', '/api/wall');
    assert.equal(wall.data.liveEntries.filter((e: any) => e.sessionId === id).length, 0);
  });
});
