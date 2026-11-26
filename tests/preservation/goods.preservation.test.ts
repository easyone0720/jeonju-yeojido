/**
 * 보존 2·3 — 결과 화면의 기존 추천(recommendedGoods)과 기념품 스토어 14종.
 *
 * 추천 검사의 기준 입력은 "결과의 원형 id(archetypeId)" 다.
 * 어떤 원형이 뽑히는지(현재 생년월일·첫 방문지·세션 id 해시)는 검사하지 않는다 —
 * 판정 방식은 다음 단계에서 바뀔 예정이므로 보존 조건으로 만들지 않는다.
 * 실제 handleGenerate 경로를 거쳐 나온 결과에서 "원형 → 추천 ID·순서·표시 필드" 대응만 확인한다.
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { beforeEach, describe, it } from 'node:test';
import { clearBrowserStorage, ensureBrowserStubs, PROJECT_ROOT, readFixture, syntheticBirthDate } from './helpers.ts';

ensureBrowserStubs();
const { GOODS } = await import('../../src/data/goods.ts');
const { apiFetch } = await import('../../src/utils/localApi.ts');
const { SPOT_QR_ALLOWLIST } = await import('../../src/data/qrAllowlist.ts');

type StoreItem = { id: string; name: string; price: number; imageUrl: string };
type RecItem = {
  id: string;
  archetypeId: string;
  name: string;
  subtitle: string;
  description: string;
  priceLabel: string;
  isDemoGoods: boolean;
};
const storeFixture = readFixture<StoreItem[]>('goods.store.json');
const recFixture = readFixture<Record<string, RecItem[]>>('goods.recommended.json');

async function call(method: string, url: string, body?: unknown) {
  const res = await apiFetch(url, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  return { status: res.status, data: (await res.json()) as any };
}

/** 기존 API 경로 그대로: 등록 → 4개 거점 QR → 박물관 QR → 결과 생성 */
async function generateResultViaExistingFlow(i: number) {
  const reg = await call('POST', '/api/auth/register', {
    visitorName: '보존검사',
    birthDate: syntheticBirthDate(i),
    companion: 'alone',
    permissionsAcknowledged: { location: true, camera: true },
  });
  assert.equal(reg.status, 201, JSON.stringify(reg.data));
  const id = reg.data.session.sessionId as string;
  for (const spotId of ['wanpanbon', 'gyeonggijeon', 'nambu_market', 'jeollagamyeong'] as const) {
    const r = await call('POST', `/api/session/${id}/verify-qr`, { spotId, qrCodeValue: SPOT_QR_ALLOWLIST[spotId] });
    assert.equal(r.status, 200, JSON.stringify(r.data));
  }
  const museum = await call('POST', `/api/session/${id}/verify-qr`, {
    spotId: 'jeonju_museum',
    qrCodeValue: SPOT_QR_ALLOWLIST.jeonju_museum,
  });
  assert.equal(museum.status, 200, JSON.stringify(museum.data));
  const gen = await call('POST', '/api/past-life/generate', { sessionId: id, portraitDataUrl: '' });
  assert.equal(gen.status, 200, JSON.stringify(gen.data));
  return gen.data.result as { archetypeId: string; recommendedGoods: RecItem[] };
}

beforeEach(() => clearBrowserStorage());

describe('보존: 결과 화면 기존 추천 (recommendedGoods)', () => {
  it('기준표는 원형 5종 × [원형 상품, 한지 인화 초상화] 순서다', () => {
    assert.deepEqual(Object.keys(recFixture).sort(), [
      'gamyeong_official',
      'gate_guardian',
      'market_merchant',
      'royal_inspector',
      'woodblock_artisan',
    ]);
    for (const items of Object.values(recFixture)) {
      assert.equal(items.length, 2);
      assert.equal(items[1].id, 'goods_hanji_print');
    }
  });

  it('실제 결과 생성 경로에서 원형별 추천 ID·순서·표시 필드가 기준과 같다 (원형 5종 모두)', async () => {
    const seen = new Set<string>();
    for (let i = 0; i < 300 && seen.size < 5; i += 1) {
      clearBrowserStorage();
      const result = await generateResultViaExistingFlow(i);
      const expected = recFixture[result.archetypeId];
      assert.ok(expected, `기준표에 없는 원형: ${result.archetypeId}`);
      assert.deepEqual(
        result.recommendedGoods.map((g) => ({
          id: g.id,
          archetypeId: g.archetypeId,
          name: g.name,
          subtitle: g.subtitle,
          description: g.description,
          priceLabel: g.priceLabel,
          isDemoGoods: g.isDemoGoods,
        })),
        expected,
        `원형 ${result.archetypeId} 의 추천이 바뀜`,
      );
      seen.add(result.archetypeId);
    }
    assert.equal(seen.size, 5, `원형 5종을 모두 확인하지 못함: ${[...seen].join(', ')}`);
  });
});

describe('보존: 기념품 스토어 14종', () => {
  it('ID·이름·가격·이미지 경로·순서가 기준과 같다', () => {
    assert.equal(GOODS.length, 14);
    assert.deepEqual(
      GOODS.map((g) => ({ id: g.id, name: g.name, price: g.price, imageUrl: g.imageUrl })),
      storeFixture,
    );
  });

  it('모든 상품 이미지 파일이 있다 (내용 해시는 assets 보존 테스트에서 검사)', () => {
    for (const g of storeFixture) {
      assert.ok(fs.existsSync(path.join(PROJECT_ROOT, 'public', g.imageUrl)), `${g.imageUrl} 없음`);
    }
  });
});
