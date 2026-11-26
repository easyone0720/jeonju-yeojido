/**
 * 생년월일 비저장 + 예전 기록 이관 (로컬 백엔드 = 실제 배포 경로).
 */
import assert from 'node:assert/strict';
import { beforeEach, describe, it } from 'node:test';
import { clearBrowserStorage, ensureBrowserStubs } from '../preservation/helpers.ts';

ensureBrowserStubs();
const { apiFetch } = await import('../../src/utils/localApi.ts');
const { SPOT_QR_ALLOWLIST } = await import('../../src/data/qrAllowlist.ts');
const engine = await import('../../src/utils/pastLifeEngine.ts');

const w = (globalThis as any).window;
const SESSION_KEY = 'jeonsaeng:v2:local:session:experience';
const DATE = '1990-01-27';

async function call(method: string, url: string, body?: unknown) {
  const res = await apiFetch(url, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  return { status: res.status, data: (await res.json()) as any };
}

function allStoredText(): string {
  const dump = (s: any) => JSON.stringify(Object.fromEntries((s.map ?? new Map()) as Map<string, string>));
  return dump(w.sessionStorage) + dump(w.localStorage);
}

beforeEach(() => clearBrowserStorage());

describe('생년월일 비저장', () => {
  it('등록 요청에 생년월일이 섞여 와도 세션·저장소에 남지 않고, 띠 코드만 저장된다', async () => {
    const r = await call('POST', '/api/auth/register', {
      visitorName: '검사',
      birthDate: DATE,
      zodiacCode: 'horse',
      permissionsAcknowledged: { location: true, camera: true },
    });
    assert.equal(r.status, 201);
    assert.equal('birthDate' in r.data.session, false);
    assert.equal(r.data.session.zodiacCode, 'horse');
    assert.equal('archetypeSeed' in r.data.session, false);
    assert.ok(!allStoredText().includes(DATE));
    assert.ok(!allStoredText().includes('birthDate'));
  });

  it('허용 목록에 없는 띠 코드는 버린다 (null)', async () => {
    for (const bad of ['1990', 'sheep', 'tiger-3']) {
      const r = await call('POST', '/api/auth/register', {
        zodiacCode: bad,
        permissionsAcknowledged: { location: true, camera: true },
      });
      assert.equal(r.data.session.zodiacCode, null, bad);
    }
  });

  it('결과에 띠 코드가 실리고 생년월일은 없으며, 네 조각은 한 원형 세트다', async () => {
    const reg = await call('POST', '/api/auth/register', {
      zodiacCode: 'ox',
      permissionsAcknowledged: { location: true, camera: true },
    });
    const sid = reg.data.session.sessionId;
    for (const spot of ['gyeonggijeon', 'jeollagamyeong', 'wanpanbon', 'nambu_market'] as const) {
      await call('POST', `/api/session/${sid}/verify-qr`, { spotId: spot, qrCodeValue: SPOT_QR_ALLOWLIST[spot] });
    }
    await call('POST', `/api/session/${sid}/verify-qr`, { spotId: 'jeonju_museum', qrCodeValue: SPOT_QR_ALLOWLIST.jeonju_museum });
    const gen = await call('POST', '/api/past-life/generate', { sessionId: sid });
    assert.equal(gen.status, 200);
    assert.equal(gen.data.result.zodiacCode, 'ox');
    assert.ok(!JSON.stringify(gen.data).includes('birthDate'));
    const a = (await import('../../src/data/jeonjuSpots.ts')).PAST_LIFE_ARCHETYPES[gen.data.result.archetypeId as 'gate_guardian'];
    const clues = gen.data.session.clues;
    assert.deepEqual(
      [clues.era.value, clues.status.value, clues.story.value, clues.item.value],
      [a.era, `${a.title} (${a.hanjaTitle})`, a.storySeed, a.item],
    );
  });
});

describe('예전 기록 정리 — birthDate 만 지우고 결과·방문·쿠폰은 보존, 조각은 한 세트 유지', () => {
  function legacySession() {
    let s: any = engine.createInitialSession({ sessionId: 'usr_legacy_0001', mode: 'experience', visitorName: '옛기록' });
    delete s.zodiacCode;
    s.birthDate = DATE; // 예전 코드가 저장하던 모양
    // 예전 판정식(생년월일 기반)으로 조각 2개를 받은 상태
    const oldArchetype = engine.determinePastLifeArchetype({ birthDate: DATE, visitOrder: ['gyeonggijeon'], sessionId: s.sessionId });
    s.visitOrder = ['gyeonggijeon', 'jeollagamyeong'];
    s.clues = {
      era: engine.buildClueForSpot({ spotId: 'gyeonggijeon', archetype: oldArchetype }),
      status: engine.buildClueForSpot({ spotId: 'jeollagamyeong', archetype: oldArchetype }),
    };
    s.coupons = s.coupons.map((c: any) =>
      c.spotId === 'gyeonggijeon' || c.spotId === 'jeollagamyeong' ? { ...c, unlocked: true, templateId: 'tpl_x', used: c.spotId === 'gyeonggijeon' } : c,
    );
    return { s, oldArchetype };
  }

  it('불러오는 순간 birthDate 가 지워지고 저장소에도 다시 쓰인다', async () => {
    const { s: raw, oldArchetype } = legacySession();
    const s = JSON.parse(JSON.stringify(raw)); // 저장소에 들어가 있던 모양 그대로 비교
    w.sessionStorage.setItem(SESSION_KEY, JSON.stringify(s));
    const me = await call('GET', '/api/auth/me');
    assert.equal(me.data.authenticated, true);
    const migrated = me.data.session;
    assert.equal('birthDate' in migrated, false);
    assert.ok(!w.sessionStorage.getItem(SESSION_KEY).includes(DATE));
    assert.deepEqual(migrated.visitOrder, s.visitOrder);
    assert.deepEqual(migrated.clues, s.clues);
    assert.deepEqual(migrated.coupons, s.coupons);
    assert.equal('lockedArchetypeId' in migrated, false);
    assert.equal(engine.resolveSessionArchetype(migrated).id, oldArchetype.id);
  });

  it('이관 뒤 남은 조각·결과도 예전 원형 그대로 이어진다', async () => {
    const { s, oldArchetype } = legacySession();
    w.sessionStorage.setItem(SESSION_KEY, JSON.stringify(s));
    const sid = s.sessionId;
    for (const spot of ['wanpanbon', 'nambu_market'] as const) {
      const r = await call('POST', `/api/session/${sid}/verify-qr`, { spotId: spot, qrCodeValue: SPOT_QR_ALLOWLIST[spot] });
      assert.equal(r.status, 200);
    }
    const after = (await call('GET', `/api/session/${sid}`)).data.session;
    assert.equal(after.clues.story.value, oldArchetype.storySeed);
    assert.equal(after.clues.item.value, oldArchetype.item);
    await call('POST', `/api/session/${sid}/verify-qr`, { spotId: 'jeonju_museum', qrCodeValue: SPOT_QR_ALLOWLIST.jeonju_museum });
    const gen = await call('POST', '/api/past-life/generate', { sessionId: sid });
    assert.equal(gen.data.result.archetypeId, oldArchetype.id);
    assert.ok(!allStoredText().includes(DATE));
  });

  it('이미 결과가 있는 기록은 결과를 그대로 둔다', () => {
    const { s } = legacySession();
    s.pastLifeResult = { archetypeId: 'market_merchant', title: 't' };
    const m = engine.stripLegacyBirthDate(s);
    assert.equal(m.pastLifeResult, s.pastLifeResult);
    assert.equal(engine.resolveSessionArchetype(m).id, 'market_merchant');
    assert.equal('birthDate' in m, false);
  });
});
