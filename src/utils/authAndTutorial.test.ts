import test from 'node:test';
import assert from 'node:assert/strict';
import {
  clearTutorialHide,
  getNextLocalMidnightMs,
  hideTutorialForToday,
  shouldShowTutorial,
  TUTORIAL_HIDE_UNTIL_KEY,
  type StorageLike,
} from './tutorialStorage';
import {
  generateRecoveryCode,
  hashRecoveryCode,
  parseCookieHeader,
  serializeHttpOnlyCookie,
  SlidingWindowRateLimiter,
  verifyRecoveryCodeHash,
} from './authCrypto';
import { JeonsaengDatabase } from './serverStore';
import {
  claimSpotClueAndCoupon,
  getCollectedClueCount,
  getResumeNavigationState,
} from './pastLifeEngine';

function createMemoryStorage(): StorageLike & { store: Map<string, string> } {
  const store = new Map<string, string>();
  return {
    store,
    getItem: (k) => store.get(k) ?? null,
    setItem: (k, v) => {
      store.set(k, v);
    },
    removeItem: (k) => {
      store.delete(k);
    },
  };
}

test('tutorial hide-for-today expires strictly at local midnight', () => {
  const storage = createMemoryStorage();
  const afternoon = new Date(2026, 4, 15, 14, 30, 0, 0);

  assert.equal(shouldShowTutorial(afternoon, storage), true);

  const midnightMs = hideTutorialForToday(afternoon, storage);
  assert.equal(midnightMs, getNextLocalMidnightMs(afternoon));
  assert.equal(new Date(midnightMs).getHours(), 0);
  assert.equal(new Date(midnightMs).getMinutes(), 0);
  assert.equal(new Date(midnightMs).getDate(), 16);

  // Same day 23:59:59.999 -> still hidden
  const beforeMidnight = new Date(2026, 4, 15, 23, 59, 59, 999);
  assert.equal(shouldShowTutorial(beforeMidnight, storage), false);

  // Next day 00:00:00.000 -> shown again and cleans up expired key
  const atMidnight = new Date(2026, 4, 16, 0, 0, 0, 0);
  assert.equal(shouldShowTutorial(atMidnight, storage), true);
  assert.equal(storage.store.has(TUTORIAL_HIDE_UNTIL_KEY), false);

  // Corrupted storage value -> safe fallback to showing
  storage.setItem(TUTORIAL_HIDE_UNTIL_KEY, 'not-a-number');
  assert.equal(shouldShowTutorial(afternoon, storage), true);
  clearTutorialHide(storage);
});

test('tutorial storage handles blocked browser storage gracefully', () => {
  const throwingStorage: StorageLike = {
    getItem: () => {
      throw new Error('SecurityError');
    },
    setItem: () => {
      throw new Error('QuotaExceededError');
    },
    removeItem: () => {
      throw new Error('SecurityError');
    },
  };

  assert.equal(shouldShowTutorial(new Date(), throwingStorage), true);
  assert.doesNotThrow(() => hideTutorialForToday(new Date(), throwingStorage));
});

test('recovery code hashing, verification, cookies, and rate limiter', () => {
  const code1 = generateRecoveryCode();
  const code2 = generateRecoveryCode();
  assert.notEqual(code1, code2);
  assert.match(code1, /^JSYJ-[2-9A-HJ-NP-Z]{4}-[2-9A-HJ-NP-Z]{4}-[2-9A-HJ-NP-Z]{4}$/);

  const { salt, hash } = hashRecoveryCode(code1);
  assert.notEqual(hash, code1);
  assert.equal(verifyRecoveryCodeHash(code1, salt, hash), true);
  // Accepts lowercase / stripped hyphens cleanly
  assert.equal(verifyRecoveryCodeHash(code1.toLowerCase().replace(/-/g, ' '), salt, hash), true);
  assert.equal(verifyRecoveryCodeHash(code2, salt, hash), false);

  // Cookie serialization & parsing
  const httpsCookie = serializeHttpOnlyCookie({
    name: 'jeonsaeng_exp_sid',
    value: 'tok_abc123',
    maxAgeSeconds: 3600,
    secure: true,
  });
  assert.match(httpsCookie, /HttpOnly/);
  assert.match(httpsCookie, /SameSite=None/);
  assert.match(httpsCookie, /Secure/);
  assert.match(httpsCookie, /Partitioned/);

  const httpCookie = serializeHttpOnlyCookie({
    name: 'jeonsaeng_exp_sid',
    value: 'tok_abc123',
    maxAgeSeconds: 3600,
    secure: false,
  });
  assert.match(httpCookie, /HttpOnly/);
  assert.match(httpCookie, /SameSite=Lax/);
  assert.doesNotMatch(httpCookie, /Secure/);

  const parsed = parseCookieHeader('other=1; jeonsaeng_exp_sid=tok_abc123');
  assert.equal(parsed.jeonsaeng_exp_sid, 'tok_abc123');

  // Rate limiter blocks after maxAttempts within window
  const limiter = new SlidingWindowRateLimiter(3, 60_000);
  const t0 = 1_700_000_000_000;
  assert.equal(limiter.consume('ip1', t0).allowed, true);
  assert.equal(limiter.consume('ip1', t0 + 10).allowed, true);
  assert.equal(limiter.consume('ip1', t0 + 20).allowed, true);
  const blocked = limiter.consume('ip1', t0 + 30);
  assert.equal(blocked.allowed, false);
  assert.ok(blocked.retryAfterSeconds >= 1);
  // Unblocks once window expires
  assert.equal(limiter.consume('ip1', t0 + 60_001).allowed, true);
});

test('SQLite store isolates duplicate nicknames, recovers across devices, and deletes safely', () => {
  const db = new JeonsaengDatabase(':memory:');
  try {
    // 1. Register two distinct users with the EXACT SAME nickname & birthDate (Test H)
    const u1 = db.registerUser({
      mode: 'experience',
      visitorName: '전주나그네',
      birthDate: '1995-05-15',
      companion: 'alone',
      permissionsAcknowledged: { location: true, camera: true },
    });
    const u2 = db.registerUser({
      mode: 'experience',
      visitorName: '전주나그네',
      birthDate: '1995-05-15',
      companion: 'alone',
      permissionsAcknowledged: { location: true, camera: true },
    });

    assert.notEqual(u1.userId, u2.userId);
    assert.ok(u1.recoveryCode && u2.recoveryCode);
    assert.notEqual(u1.recoveryCode, u2.recoveryCode);

    // 2. User 1 collects 2 clues & saves to DB
    const c1 = claimSpotClueAndCoupon(u1.session, 'gyeonggijeon').nextSession;
    const c2 = claimSpotClueAndCoupon(c1, 'jeollagamyeong').nextSession;
    db.saveSession({ ...c2, currentScene: 4, currentSpotId: 'jeollagamyeong' });

    // Authenticate u1 via token & check resume target
    const auth1 = db.authenticateToken(u1.authToken, 'experience');
    assert.ok(auth1);
    assert.equal(getCollectedClueCount(auth1.session), 2);
    const resume = getResumeNavigationState(auth1.session);
    assert.equal(resume.scene, 4);
    assert.equal(resume.homeTab, 'clues');
    assert.equal(resume.selectedSpotId, 'jeollagamyeong');

    // User 2 must still have 0 clues (total isolation)
    const auth2 = db.authenticateToken(u2.authToken, 'experience');
    assert.ok(auth2);
    assert.equal(getCollectedClueCount(auth2.session), 0);

    // 3. Logout / session expiry leaves DB record intact & recovers cleanly via recovery code (Tests G & I)
    db.revokeAuthToken(u1.authToken);
    assert.equal(db.authenticateToken(u1.authToken, 'experience'), null);

    // Wrong recovery code fails without leaking
    assert.equal(
      db.recoverUser({
        visitorName: '전주나그네',
        birthDate: '1995-05-15',
        recoveryCode: 'JSYJ-AAAA-BBBB-CCCC',
      }),
      null
    );

    // Correct recovery code for u1 restores u1's 2 clues & issues fresh token
    const recovered1 = db.recoverUser({
      visitorName: '전주나그네',
      birthDate: '1995-05-15',
      recoveryCode: u1.recoveryCode!,
    });
    assert.ok(recovered1);
    assert.equal(recovered1.userId, u1.userId);
    assert.equal(getCollectedClueCount(recovered1.session), 2);
    assert.ok(db.authenticateToken(recovered1.authToken, 'experience'));

    // Correct recovery code for u2 restores u2 (0 clues)
    const recovered2 = db.recoverUser({
      visitorName: '전주나그네',
      birthDate: '1995-05-15',
      recoveryCode: u2.recoveryCode!,
    });
    assert.ok(recovered2);
    assert.equal(recovered2.userId, u2.userId);
    assert.equal(getCollectedClueCount(recovered2.session), 0);

    // 4. Deleting u1 leaves u2 completely untouched (Test J)
    assert.equal(db.deleteUserRecord(u1.userId), true);
    assert.equal(db.getSession(u1.userId), null);
    assert.ok(db.getSession(u2.userId));
  } finally {
    db.close();
  }
});
