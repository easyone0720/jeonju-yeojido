import test from 'node:test';
import assert from 'node:assert/strict';
import {
  computeCouponExpiresAt,
  formatCouponExpiryDate,
  generateDemoBarcodeNumber,
  getCouponStatusLabel,
  isCouponExpired,
  isDemoBarcodeNumber,
  resolveCouponBaseStatus,
} from './couponBarcode.ts';
import {
  generateLiveCouponBarcode,
  verifyLiveCouponBarcodeSignature,
} from './couponServerCrypto.ts';
import { claimSpotClueAndCoupon, toggleCouponUsedState } from './pastLifeEngine.ts';
import { JeonsaengDatabase } from './serverStore.ts';

test('coupon barcode pure helpers distinguish demo codes, statuses, and expiration cleanly', () => {
  const unlockedAt = '2026-05-01T10:00:00.000Z';
  const expiresAt = computeCouponExpiresAt('gyeonggijeon', unlockedAt);
  assert.equal(expiresAt.startsWith('2026-05-08'), true);

  assert.equal(isCouponExpired(expiresAt, Date.parse('2026-05-07T23:59:59.000Z')), false);
  assert.equal(isCouponExpired(expiresAt, Date.parse('2026-05-08T10:00:01.000Z')), true);

  const demoCode = generateDemoBarcodeNumber('gyeonggijeon', 'usr_demo_1', unlockedAt);
  assert.match(demoCode, /^JSYJ-DEMO-GJ-[A-Z0-9]{6}$/);
  assert.equal(isDemoBarcodeNumber(demoCode), true);
  assert.equal(isDemoBarcodeNumber('JSYJ-LV-GJ-1234ABCD-99EF'), false);

  assert.equal(
    resolveCouponBaseStatus({ unlocked: false, used: false, expiresAt }),
    'locked'
  );
  assert.equal(
    resolveCouponBaseStatus(
      { unlocked: true, used: false, expiresAt },
      Date.parse('2026-05-02T00:00:00.000Z')
    ),
    'available'
  );
  assert.equal(
    resolveCouponBaseStatus(
      { unlocked: true, used: true, expiresAt },
      Date.parse('2026-05-02T00:00:00.000Z')
    ),
    'used'
  );
  assert.equal(
    resolveCouponBaseStatus(
      { unlocked: true, used: false, expiresAt },
      Date.parse('2026-05-09T00:00:00.000Z')
    ),
    'expired'
  );

  assert.equal(getCouponStatusLabel('barcode_visible'), '바코드 표시 중');
  assert.equal(getCouponStatusLabel('verification_failed'), '검증 실패');
  assert.equal(formatCouponExpiryDate(expiresAt), '2026.05.08까지');
});

test('live HMAC coupon barcode detects tampering and serverStore enforces atomic single redemption', () => {
  const code = generateLiveCouponBarcode({
    spotId: 'wanpanbon',
    userId: 'usr_live_1',
    couponId: 'coupon_wanpanbon',
  });
  assert.match(code, /^JSYJ-LV-WP-[0-9A-F]{8}-[0-9A-F]{4}$/);
  assert.equal(
    verifyLiveCouponBarcodeSignature({
      issueCode: code,
      userId: 'usr_live_1',
      couponId: 'coupon_wanpanbon',
    }),
    true
  );
  // Tamper one character -> must fail verification
  const lastChar = code.slice(-1) === 'A' ? 'B' : 'A';
  assert.equal(
    verifyLiveCouponBarcodeSignature({
      issueCode: `${code.slice(0, -1)}${lastChar}`,
      userId: 'usr_live_1',
      couponId: 'coupon_wanpanbon',
    }),
    false
  );
  // Wrong user ownership -> must fail verification
  assert.equal(
    verifyLiveCouponBarcodeSignature({
      issueCode: code,
      userId: 'usr_other',
      couponId: 'coupon_wanpanbon',
    }),
    false
  );

  const db = new JeonsaengDatabase(':memory:');
  try {
    // 1) Demo session coupon flow
    const demoReg = db.registerUser({
      mode: 'demo',
      visitorName: '시연고객',
      birthDate: '1998-05-15',
      companion: 'alone',
      permissionsAcknowledged: { location: true, camera: true },
    });
    const demoClaimed = claimSpotClueAndCoupon(demoReg.session, 'gyeonggijeon').nextSession;
    const savedDemo = db.saveSession(demoClaimed);
    const demoCoupon = savedDemo.coupons.find((c) => c.id === 'coupon_gyeonggijeon')!;
    assert.ok(demoCoupon.barcodeNumber?.includes('-DEMO-'));

    // Demo barcode rejected by live partner redemption endpoint
    const demoInPartner = db.redeemCouponByIssueCode({
      issueCode: demoCoupon.barcodeNumber!,
    });
    assert.equal(demoInPartner.ok, false);
    if (!demoInPartner.ok) {
      assert.equal(demoInPartner.code, 'DEMO_COUPON');
    }

    // Demo self-redemption succeeds once, fails atomically on repeat
    const firstDemoUse = db.redeemDemoCoupon({
      userId: demoReg.userId,
      couponId: 'coupon_gyeonggijeon',
    });
    assert.equal(firstDemoUse.ok, true);
    const secondDemoUse = db.redeemDemoCoupon({
      userId: demoReg.userId,
      couponId: 'coupon_gyeonggijeon',
    });
    assert.equal(secondDemoUse.ok, false);
    if (!secondDemoUse.ok) {
      assert.equal(secondDemoUse.code, 'ALREADY_USED');
    }

    // 2) Experience (live) session coupon flow
    const expReg = db.registerUser({
      mode: 'experience',
      visitorName: '현장고객',
      birthDate: '1994-03-10',
      companion: 'alone',
      permissionsAcknowledged: { location: true, camera: true },
    });
    const expClaimed = claimSpotClueAndCoupon(expReg.session, 'nambu_market').nextSession;
    const savedExp = db.saveSession(expClaimed);
    const expCoupon = savedExp.coupons.find((c) => c.id === 'coupon_nambu_market')!;
    assert.ok(expCoupon.barcodeNumber?.startsWith('JSYJ-LV-NM-'));
    assert.equal(expCoupon.isDemoCoupon, false);

    // Live coupon cannot be self-redeemed via demo endpoint
    const selfUseExp = db.redeemDemoCoupon({
      userId: expReg.userId,
      couponId: 'coupon_nambu_market',
    });
    assert.equal(selfUseExp.ok, false);
    if (!selfUseExp.ok) {
      assert.equal(selfUseExp.code, 'PARTNER_VERIFY_REQUIRED');
    }

    // Partner/admin redemption succeeds once and blocks double use atomically
    const partnerRedeem1 = db.redeemCouponByIssueCode({
      issueCode: expCoupon.barcodeNumber!,
    });
    assert.equal(partnerRedeem1.ok, true);
    const partnerRedeem2 = db.redeemCouponByIssueCode({
      issueCode: expCoupon.barcodeNumber!,
    });
    assert.equal(partnerRedeem2.ok, false);
    if (!partnerRedeem2.ok) {
      assert.equal(partnerRedeem2.code, 'ALREADY_USED');
    }

    // Check owner session now reflects used: true
    const reloadedOwner = db.getSession(expReg.userId)!;
    assert.equal(
      reloadedOwner.coupons.find((c) => c.id === 'coupon_nambu_market')?.used,
      true
    );

    // Expired coupon cannot be toggled used in pure engine either
    const pastExpiresSession = {
      ...demoClaimed,
      coupons: demoClaimed.coupons.map((c) =>
        c.id === 'coupon_gyeonggijeon'
          ? { ...c, expiresAt: '2020-01-01T00:00:00.000Z' }
          : c
      ),
    };
    const afterExpiredToggle = toggleCouponUsedState(
      pastExpiresSession,
      'coupon_gyeonggijeon',
      '2026-05-01T00:00:00.000Z'
    );
    assert.equal(
      afterExpiredToggle.coupons.find((c) => c.id === 'coupon_gyeonggijeon')?.used,
      false
    );
  } finally {
    db.close();
  }
});
