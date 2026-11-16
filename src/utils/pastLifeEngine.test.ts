import test from 'node:test';
import assert from 'node:assert/strict';
import {
  SPOT_QR_ALLOWLIST,
  canonicalizeSpotId,
  validateSpotQrCode,
} from '../data/qrAllowlist';
import {
  calculateDistanceMeters,
  claimSpotClueAndCoupon,
  createInitialSession,
  determinePastLifeArchetype,
  getCollectedClueCount,
  isMuseumUnlocked,
  isSpotClueOrPastLifeCompleted,
  isSpotVisitVerified,
  parseSpotQrPayload,
  recordSpotVisitAuthentication,
  toggleCouponUsedState,
  validateBirthDate,
  verifySpotLocation,
} from './pastLifeEngine';

test('validateSpotQrCode enforces strict exact-match 5-URL allowlist and Korean errors', () => {
  // All 5 official URLs pass strictly (with optional outer whitespace trimmed)
  assert.deepEqual(
    parseSpotQrPayload('https://m.site.naver.com/2l46K', 'gyeonggijeon'),
    {
      valid: true,
      spotId: 'gyeonggijeon',
      canonicalQrUrl: 'https://m.site.naver.com/2l46K',
      errorCode: undefined,
      error: undefined,
    }
  );
  assert.equal(
    parseSpotQrPayload('  https://m.site.naver.com/2l46J  ', 'jeollagamyeong').valid,
    true
  );
  assert.equal(
    parseSpotQrPayload('https://m.site.naver.com/2l46H', 'wanpanbon').valid,
    true
  );
  assert.equal(
    parseSpotQrPayload('https://m.site.naver.com/2l46G', 'nambu_market').valid,
    true
  );
  assert.equal(
    parseSpotQrPayload('https://m.site.naver.com/2l46E', 'jeonju_museum').valid,
    true
  );

  // Alias mapping preserves existing DB id
  assert.equal(canonicalizeSpotId('jeolla_gamyeong'), 'jeollagamyeong');
  assert.equal(canonicalizeSpotId('gyeonggijeon'), 'gyeonggijeon');
  assert.equal(canonicalizeSpotId('unknown_place'), null);

  // Strictness: lowercase suffix, extra query param, trailing slash, http instead of https -> UNREGISTERED_QR
  for (const variant of [
    'https://m.site.naver.com/2l46k',
    'https://m.site.naver.com/2l46K?from=qr',
    'https://m.site.naver.com/2l46K/',
    'http://m.site.naver.com/2l46K',
    'https://m.site.naver.com/other',
    'JEONSAENG:spot:gyeonggijeon',
  ]) {
    const res = validateSpotQrCode(variant, 'gyeonggijeon');
    assert.equal(res.valid, false, `Expected rejection for ${variant}`);
    assert.equal(res.errorCode, 'UNREGISTERED_QR');
    assert.equal(res.error, '이 장소의 QR코드가 아닙니다. 다시 확인해 주세요.');
  }

  // Empty string -> EMPTY_QR
  const emptyRes = validateSpotQrCode('   ', 'gyeonggijeon');
  assert.equal(emptyRes.valid, false);
  assert.equal(emptyRes.errorCode, 'EMPTY_QR');
  assert.equal(emptyRes.error, 'QR코드를 인식하지 못했습니다. 다시 시도해 주세요.');

  // Official QR from a different spot -> WRONG_SPOT_QR
  const wrongSpotRes = validateSpotQrCode(
    SPOT_QR_ALLOWLIST.jeollagamyeong,
    'gyeonggijeon'
  );
  assert.equal(wrongSpotRes.valid, false);
  assert.equal(wrongSpotRes.errorCode, 'WRONG_SPOT_QR');
  assert.equal(
    wrongSpotRes.error,
    '이 장소의 QR코드가 아닙니다. 다시 확인해 주세요.'
  );
});

test('GPS distance and verification work accurately for experience and demo modes', () => {
  const near = verifySpotLocation(
    'gyeonggijeon',
    { lat: 35.8157, lng: 127.1497 },
    'experience'
  );
  assert.equal(near.verified, true);
  assert.ok((near.distanceMeters ?? 999) < 100);

  const far = verifySpotLocation(
    'gyeonggijeon',
    { lat: 37.5665, lng: 126.978 },
    'experience'
  );
  assert.equal(far.verified, false);
  assert.ok((far.distanceMeters ?? 0) > 150000);

  const demo = verifySpotLocation('gyeonggijeon', null, 'demo');
  assert.equal(demo.verified, true);

  const d = calculateDistanceMeters(35.8154, 127.1497, 35.8126, 127.1462);
  assert.ok(d > 300 && d < 600);
});

test('validateBirthDate checks valid YYYY-MM-DD and rejects impossible dates', () => {
  assert.equal(validateBirthDate('1998-05-15').valid, true);
  assert.equal(validateBirthDate('').valid, false);
  assert.equal(validateBirthDate('1880-01-01').valid, false);
  assert.equal(validateBirthDate('2000-02-31').valid, false);
});

test('2-stage visit authentication vs clue acquisition prevents skipping and handles idempotency', () => {
  let session = createInitialSession({
    sessionId: 'sess-test-001',
    birthDate: '1995-08-22',
    mode: 'experience',
  });

  // Stage 1: Visit authentication marks visitVerified=true, clueAcquired=false
  const authStep = recordSpotVisitAuthentication(
    session,
    'gyeonggijeon',
    '2026-05-01T10:00:00.000Z'
  );
  assert.equal(authStep.alreadyVerified, false);
  assert.equal(authStep.authRecord.visitVerified, true);
  assert.equal(authStep.authRecord.clueAcquired, false);
  session = authStep.nextSession;

  assert.equal(isSpotVisitVerified(session, 'gyeonggijeon'), true);
  assert.equal(isSpotClueOrPastLifeCompleted(session, 'gyeonggijeon'), false);
  assert.equal(getCollectedClueCount(session), 0);

  // Duplicate Stage 1 attempt returns alreadyVerified=true without mutating
  const dupAuth = recordSpotVisitAuthentication(session, 'gyeonggijeon');
  assert.equal(dupAuth.alreadyVerified, true);

  // Stage 2: Claiming clue flips clueAcquired=true and adds clue
  const claimStep = claimSpotClueAndCoupon(session, 'gyeonggijeon');
  assert.equal(claimStep.alreadyClaimed, false);
  session = claimStep.nextSession;
  assert.equal(isSpotClueOrPastLifeCompleted(session, 'gyeonggijeon'), true);
  assert.equal(session.spotAuthentications?.gyeonggijeon?.clueAcquired, true);
  assert.equal(getCollectedClueCount(session), 1);

  // Visit Nambu Market next -> still yields 'item' category
  const nambu = claimSpotClueAndCoupon(session, 'nambu_market');
  assert.equal(nambu.claimedClue.category, 'item');
  session = nambu.nextSession;

  // Duplicate claim is idempotent
  const dupClaim = claimSpotClueAndCoupon(session, 'nambu_market');
  assert.equal(dupClaim.alreadyClaimed, true);

  // Claim remaining 2 clue spots
  session = claimSpotClueAndCoupon(session, 'jeollagamyeong').nextSession;
  session = claimSpotClueAndCoupon(session, 'wanpanbon').nextSession;

  assert.equal(getCollectedClueCount(session), 4);
  assert.equal(isMuseumUnlocked(session), true);
  assert.equal(session.coupons.filter((c) => c.unlocked).length, 4);

  // Museum Stage 1 authentication keeps pastLifeResult null (never auto-completes portrait)
  const museumAuth = recordSpotVisitAuthentication(session, 'jeonju_museum');
  assert.equal(museumAuth.alreadyVerified, false);
  assert.equal(isSpotVisitVerified(museumAuth.nextSession, 'jeonju_museum'), true);
  assert.equal(
    isSpotClueOrPastLifeCompleted(museumAuth.nextSession, 'jeonju_museum'),
    false
  );
  assert.equal(museumAuth.nextSession.pastLifeResult, null);

  // Archetype remains deterministic
  const a1 = determinePastLifeArchetype({
    birthDate: session.birthDate,
    visitOrder: session.visitOrder,
    sessionId: session.sessionId,
  });
  const a2 = determinePastLifeArchetype({
    birthDate: session.birthDate,
    visitOrder: session.visitOrder,
    sessionId: session.sessionId,
  });
  assert.equal(a1.id, a2.id);

  // Coupon usage state transition
  const updatedWithUsed = toggleCouponUsedState(session, 'coupon_gyeonggijeon');
  assert.equal(
    updatedWithUsed.coupons.find((c) => c.id === 'coupon_gyeonggijeon')?.used,
    true
  );
});
