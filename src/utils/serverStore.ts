import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import type {
  AppMode,
  ClueSpotId,
  CompanionType,
  CouponRecord,
  SpotAuthRecord,
  SpotId,
  UserSessionState,
  WallEntry,
} from '../types/jeonju.ts';
import { createInitialSession } from './pastLifeEngine.ts';
import {
  computeCouponExpiresAt,
  generateDemoBarcodeNumber,
  isCouponExpired,
  isDemoBarcodeNumber,
} from './couponBarcode.ts';
import {
  generateLiveCouponBarcode,
  verifyLiveCouponBarcodeSignature,
} from './couponServerCrypto.ts';
import {
  generateAuthToken,
  generateRecoveryCode,
  hashAuthToken,
  hashRecoveryCode,
  verifyRecoveryCodeHash,
} from './authCrypto.ts';

const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;
const ONE_DAY_MS = 24 * 60 * 60 * 1000;

interface UserRow {
  user_id: string;
  mode: AppMode;
  nickname: string;
  birth_date: string;
  recovery_code_hash: string;
  recovery_code_salt: string;
  created_at: string;
  last_accessed_at: string;
}

export type RedeemResult<T extends object> =
  | ({ ok: true } & T)
  | { ok: false; statusCode: number; code: string; error: string };

export class JeonsaengDatabase {
  private readonly db: DatabaseSync;

  constructor(dbPath: string) {
    if (dbPath !== ':memory:') {
      fs.mkdirSync(path.dirname(dbPath), { recursive: true });
    }
    this.db = new DatabaseSync(dbPath, { timeout: 5000 });
    this.db.exec('PRAGMA foreign_keys = ON;');
    if (dbPath !== ':memory:') {
      this.db.exec('PRAGMA journal_mode = WAL;');
    }
    this.initSchema();
  }

  private initSchema(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS users (
        user_id TEXT PRIMARY KEY,
        mode TEXT NOT NULL,
        nickname TEXT NOT NULL,
        birth_date TEXT NOT NULL,
        recovery_code_hash TEXT NOT NULL,
        recovery_code_salt TEXT NOT NULL,
        created_at TEXT NOT NULL,
        last_accessed_at TEXT NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_users_lookup
        ON users (mode, birth_date, nickname);

      CREATE TABLE IF NOT EXISTS auth_sessions (
        token_hash TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        mode TEXT NOT NULL,
        created_at TEXT NOT NULL,
        expires_at TEXT NOT NULL,
        FOREIGN KEY (user_id) REFERENCES users (user_id) ON DELETE CASCADE
      );

      CREATE INDEX IF NOT EXISTS idx_auth_sessions_user
        ON auth_sessions (user_id);

      CREATE TABLE IF NOT EXISTS progress_records (
        user_id TEXT PRIMARY KEY,
        session_json TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        FOREIGN KEY (user_id) REFERENCES users (user_id) ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS wall_entries (
        id TEXT PRIMARY KEY,
        session_id TEXT NOT NULL,
        entry_json TEXT NOT NULL,
        published_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS spot_authentications (
        user_id TEXT NOT NULL,
        spot_id TEXT NOT NULL,
        spot_name TEXT NOT NULL,
        qr_verified INTEGER NOT NULL DEFAULT 1,
        gps_verified INTEGER NOT NULL DEFAULT 1,
        visit_verified INTEGER NOT NULL DEFAULT 1,
        clue_acquired INTEGER NOT NULL DEFAULT 0,
        verified_at TEXT NOT NULL,
        PRIMARY KEY (user_id, spot_id),
        FOREIGN KEY (user_id) REFERENCES users (user_id) ON DELETE CASCADE
      );

      CREATE INDEX IF NOT EXISTS idx_spot_auth_user
        ON spot_authentications (user_id);
    `);
  }

  close(): void {
    this.db.close();
  }

  migrateLegacyJsonIfEmpty(legacyJsonPath: string): void {
    const existingCountRow = this.db
      .prepare('SELECT COUNT(*) as cnt FROM users')
      .get() as { cnt: number } | undefined;
    if ((existingCountRow?.cnt ?? 0) > 0) {
      return;
    }
    if (!fs.existsSync(legacyJsonPath)) {
      return;
    }

    try {
      const raw = fs.readFileSync(legacyJsonPath, 'utf8');
      const parsed = JSON.parse(raw) as {
        sessions?: Record<string, UserSessionState>;
        wallEntries?: WallEntry[];
      };
      const sessions = Object.values(parsed.sessions ?? {});
      const wallEntries = Array.isArray(parsed.wallEntries) ? parsed.wallEntries : [];

      this.db.exec('BEGIN');
      try {
        const insertUser = this.db.prepare(`
          INSERT OR IGNORE INTO users
            (user_id, mode, nickname, birth_date, recovery_code_hash, recovery_code_salt, created_at, last_accessed_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `);
        const insertProgress = this.db.prepare(`
          INSERT OR IGNORE INTO progress_records (user_id, session_json, updated_at)
          VALUES (?, ?, ?)
        `);
        const insertWall = this.db.prepare(`
          INSERT OR IGNORE INTO wall_entries (id, session_id, entry_json, published_at)
          VALUES (?, ?, ?, ?)
        `);

        for (const sess of sessions) {
          if (!sess || !sess.sessionId) continue;
          const randomSecret = generateRecoveryCode();
          const { salt, hash } = hashRecoveryCode(randomSecret);
          const created = sess.createdAt ?? sess.updatedAt ?? new Date().toISOString();
          const normalized: UserSessionState = {
            ...sess,
            createdAt: created,
            lastAccessedAt: sess.lastAccessedAt ?? sess.updatedAt ?? created,
            spotVerifiedAt: sess.spotVerifiedAt ?? {},
            hasCompletedPastLife: Boolean(sess.pastLifeResult),
          };
          insertUser.run(
            sess.sessionId,
            sess.mode ?? 'experience',
            (sess.visitorName ?? '').trim(),
            sess.birthDate ?? '',
            hash,
            salt,
            created,
            normalized.lastAccessedAt!
          );
          insertProgress.run(
            sess.sessionId,
            JSON.stringify(normalized),
            sess.updatedAt ?? created
          );
        }

        for (const entry of wallEntries) {
          if (!entry || !entry.id) continue;
          insertWall.run(
            entry.id,
            entry.sessionId ?? '',
            JSON.stringify(entry),
            entry.publishedAt ?? new Date().toISOString()
          );
        }
        this.db.exec('COMMIT');
      } catch (err) {
        this.db.exec('ROLLBACK');
        throw err;
      }
    } catch (err) {
      console.warn('Legacy JSON migration skipped:', err instanceof Error ? err.message : err);
    }
  }

  registerUser(params: {
    mode: AppMode;
    visitorName: string;
    birthDate: string;
    companion: CompanionType;
    permissionsAcknowledged: { location: boolean; camera: boolean };
    nowIso?: string;
    ttlMs?: number;
  }): {
    userId: string;
    session: UserSessionState;
    recoveryCode: string | null;
    authToken: string;
    maxAgeSeconds: number;
  } {
    const nowIso = params.nowIso ?? new Date().toISOString();
    const nowMs = Date.parse(nowIso);
    const ttlMs =
      params.ttlMs ?? (params.mode === 'demo' ? ONE_DAY_MS : THIRTY_DAYS_MS);
    const expiresAt = new Date(nowMs + ttlMs).toISOString();

    const userId = `usr_${crypto.randomUUID()}`;
    const trimmedName = params.visitorName.trim();

    const plainRecoveryCode = generateRecoveryCode();
    const { salt, hash } = hashRecoveryCode(plainRecoveryCode);

    const session: UserSessionState = {
      ...createInitialSession({
        sessionId: userId,
        mode: params.mode,
        visitorName: trimmedName,
        birthDate: params.birthDate,
        companion: params.companion,
        nowIso,
      }),
      permissionsAcknowledged: {
        location: Boolean(params.permissionsAcknowledged.location),
        camera: Boolean(params.permissionsAcknowledged.camera),
      },
      currentScene: 3,
      currentSpotId: 'wanpanbon',
      lastCompletedStep: 'registered',
      recoveryCodeIssued: params.mode === 'experience',
    };

    const authToken = generateAuthToken();
    const tokenHash = hashAuthToken(authToken);

    this.db.exec('BEGIN');
    try {
      this.db
        .prepare(
          `INSERT INTO users
            (user_id, mode, nickname, birth_date, recovery_code_hash, recovery_code_salt, created_at, last_accessed_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
        )
        .run(
          userId,
          params.mode,
          trimmedName,
          params.birthDate,
          hash,
          salt,
          nowIso,
          nowIso
        );

      this.db
        .prepare(
          `INSERT INTO progress_records (user_id, session_json, updated_at)
           VALUES (?, ?, ?)`
        )
        .run(userId, JSON.stringify(session), nowIso);

      this.db
        .prepare(
          `INSERT INTO auth_sessions (token_hash, user_id, mode, created_at, expires_at)
           VALUES (?, ?, ?, ?, ?)`
        )
        .run(tokenHash, userId, params.mode, nowIso, expiresAt);

      this.db.exec('COMMIT');
    } catch (err) {
      this.db.exec('ROLLBACK');
      throw err;
    }

    return {
      userId,
      session,
      recoveryCode: params.mode === 'experience' ? plainRecoveryCode : null,
      authToken,
      maxAgeSeconds: Math.floor(ttlMs / 1000),
    };
  }

  authenticateToken(
    rawToken: string | undefined,
    expectedMode?: AppMode,
    nowMs = Date.now()
  ): { userId: string; session: UserSessionState } | null {
    if (!rawToken || rawToken.length < 16) {
      return null;
    }
    const tokenHash = hashAuthToken(rawToken);
    const authRow = this.db
      .prepare(
        `SELECT token_hash, user_id, mode, expires_at
         FROM auth_sessions
         WHERE token_hash = ?`
      )
      .get(tokenHash) as
      | { token_hash: string; user_id: string; mode: AppMode; expires_at: string }
      | undefined;

    if (!authRow) {
      return null;
    }
    if (expectedMode && authRow.mode !== expectedMode) {
      return null;
    }
    if (Date.parse(authRow.expires_at) <= nowMs) {
      this.db.prepare('DELETE FROM auth_sessions WHERE token_hash = ?').run(tokenHash);
      return null;
    }

    const session = this.getSession(authRow.user_id);
    if (!session) {
      return null;
    }

    const nowIso = new Date(nowMs).toISOString();
    this.db
      .prepare('UPDATE users SET last_accessed_at = ? WHERE user_id = ?')
      .run(nowIso, authRow.user_id);

    return {
      userId: authRow.user_id,
      session: {
        ...session,
        lastAccessedAt: nowIso,
      },
    };
  }

  recoverUser(params: {
    visitorName: string;
    birthDate: string;
    recoveryCode: string;
    nowIso?: string;
    ttlMs?: number;
  }): {
    userId: string;
    session: UserSessionState;
    authToken: string;
    maxAgeSeconds: number;
  } | null {
    const trimmedName = params.visitorName.trim();
    const candidates = this.db
      .prepare(
        `SELECT user_id, mode, nickname, birth_date, recovery_code_hash, recovery_code_salt, created_at, last_accessed_at
         FROM users
         WHERE mode = 'experience' AND birth_date = ? AND nickname = ?
         ORDER BY last_accessed_at DESC`
      )
      .all(params.birthDate, trimmedName) as unknown as UserRow[];

    let matchedUser: UserRow | null = null;
    for (const candidate of candidates) {
      if (
        verifyRecoveryCodeHash(
          params.recoveryCode,
          candidate.recovery_code_salt,
          candidate.recovery_code_hash
        )
      ) {
        matchedUser = candidate;
        break;
      }
    }

    if (!matchedUser) {
      return null;
    }

    const session = this.getSession(matchedUser.user_id);
    if (!session) {
      return null;
    }

    const nowIso = params.nowIso ?? new Date().toISOString();
    const ttlMs = params.ttlMs ?? THIRTY_DAYS_MS;
    const expiresAt = new Date(Date.parse(nowIso) + ttlMs).toISOString();
    const authToken = generateAuthToken();
    const tokenHash = hashAuthToken(authToken);

    const updatedSession: UserSessionState = {
      ...session,
      lastAccessedAt: nowIso,
    };

    this.db.exec('BEGIN');
    try {
      this.db
        .prepare('UPDATE users SET last_accessed_at = ? WHERE user_id = ?')
        .run(nowIso, matchedUser.user_id);
      this.db
        .prepare(
          `INSERT INTO auth_sessions (token_hash, user_id, mode, created_at, expires_at)
           VALUES (?, ?, 'experience', ?, ?)`
        )
        .run(tokenHash, matchedUser.user_id, nowIso, expiresAt);
      this.db
        .prepare('UPDATE progress_records SET session_json = ?, updated_at = ? WHERE user_id = ?')
        .run(JSON.stringify(updatedSession), updatedSession.updatedAt, matchedUser.user_id);
      this.db.exec('COMMIT');
    } catch (err) {
      this.db.exec('ROLLBACK');
      throw err;
    }

    return {
      userId: matchedUser.user_id,
      session: updatedSession,
      authToken,
      maxAgeSeconds: Math.floor(ttlMs / 1000),
    };
  }

  revokeAuthToken(rawToken: string | undefined): void {
    if (!rawToken) return;
    const tokenHash = hashAuthToken(rawToken);
    this.db.prepare('DELETE FROM auth_sessions WHERE token_hash = ?').run(tokenHash);
  }

  deleteUserRecord(userId: string): boolean {
    this.db.exec('BEGIN');
    try {
      this.db.prepare('DELETE FROM spot_authentications WHERE user_id = ?').run(userId);
      this.db.prepare('DELETE FROM auth_sessions WHERE user_id = ?').run(userId);
      this.db.prepare('DELETE FROM wall_entries WHERE session_id = ?').run(userId);
      this.db.prepare('DELETE FROM progress_records WHERE user_id = ?').run(userId);
      const result = this.db.prepare('DELETE FROM users WHERE user_id = ?').run(userId);
      this.db.exec('COMMIT');
      return Number(result.changes) > 0;
    } catch (err) {
      this.db.exec('ROLLBACK');
      throw err;
    }
  }

  getSpotAuthentications(userId: string): Partial<Record<SpotId, SpotAuthRecord>> {
    const rows = this.db
      .prepare(
        `SELECT spot_id, spot_name, qr_verified, gps_verified, visit_verified, clue_acquired, verified_at
         FROM spot_authentications
         WHERE user_id = ?`
      )
      .all(userId) as unknown as Array<{
      spot_id: SpotId;
      spot_name: string;
      qr_verified: number;
      gps_verified: number;
      visit_verified: number;
      clue_acquired: number;
      verified_at: string;
    }>;

    const map: Partial<Record<SpotId, SpotAuthRecord>> = {};
    for (const row of rows) {
      map[row.spot_id] = {
        spotId: row.spot_id,
        spotName: row.spot_name,
        qrVerified: Boolean(row.qr_verified),
        gpsVerified: Boolean(row.gps_verified),
        visitVerified: Boolean(row.visit_verified),
        clueAcquired: Boolean(row.clue_acquired),
        verifiedAt: row.verified_at,
      };
    }
    return map;
  }

  upsertSpotAuthentication(userId: string, record: SpotAuthRecord): void {
    this.db
      .prepare(
        `INSERT INTO spot_authentications
          (user_id, spot_id, spot_name, qr_verified, gps_verified, visit_verified, clue_acquired, verified_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(user_id, spot_id) DO UPDATE SET
           spot_name = excluded.spot_name,
           qr_verified = excluded.qr_verified,
           gps_verified = excluded.gps_verified,
           visit_verified = excluded.visit_verified,
           clue_acquired = MAX(spot_authentications.clue_acquired, excluded.clue_acquired),
           verified_at = excluded.verified_at`
      )
      .run(
        userId,
        record.spotId,
        record.spotName,
        record.qrVerified ? 1 : 0,
        record.gpsVerified ? 1 : 0,
        record.visitVerified ? 1 : 0,
        record.clueAcquired ? 1 : 0,
        record.verifiedAt
      );
  }

  getSession(userId: string): UserSessionState | null {
    const row = this.db
      .prepare('SELECT session_json FROM progress_records WHERE user_id = ?')
      .get(userId) as { session_json: string } | undefined;
    if (!row) return null;
    try {
      const parsed = JSON.parse(row.session_json) as UserSessionState;
      const dbAuths = this.getSpotAuthentications(userId);
      const mergedAuths: Partial<Record<SpotId, SpotAuthRecord>> = {
        ...(parsed.spotAuthentications ?? {}),
        ...dbAuths,
      };
      const mergedVerifiedAt: Partial<Record<SpotId, string>> = {
        ...(parsed.spotVerifiedAt ?? {}),
      };
      for (const [spotKey, auth] of Object.entries(mergedAuths)) {
        if (auth?.verifiedAt) {
          mergedVerifiedAt[spotKey as SpotId] = auth.verifiedAt;
        }
      }
      return {
        ...parsed,
        spotAuthentications: mergedAuths,
        spotVerifiedAt: mergedVerifiedAt,
      };
    } catch {
      return null;
    }
  }

  /**
   * 새로 잠금 해제된 쿠폰에 유효기간과 바코드 번호를 채운다.
   * 시연(demo) 세션은 JSYJ-DEMO-… 번호와 isDemoCoupon=true, 현장 체험(experience) 세션은
   * 서버 HMAC 서명 JSYJ-LV-… 번호와 isDemoCoupon=false 로 발급한다. 이미 있는 번호는 바꾸지 않는다.
   */
  private issueCouponBarcodes(session: UserSessionState): UserSessionState {
    if (!Array.isArray(session.coupons)) return session;
    const nowIso = new Date().toISOString();
    const isLive = session.mode === 'experience';
    return {
      ...session,
      coupons: session.coupons.map((c) => {
        if (!c.unlocked || c.barcodeNumber) return c;
        const unlockedAt = c.unlockedAt ?? nowIso;
        const barcodeNumber = isLive
          ? generateLiveCouponBarcode({
              spotId: c.spotId as ClueSpotId,
              userId: session.sessionId,
              couponId: c.id,
            })
          : generateDemoBarcodeNumber(c.spotId as ClueSpotId, session.sessionId, unlockedAt);
        return {
          ...c,
          unlockedAt,
          expiresAt: c.expiresAt ?? computeCouponExpiresAt(c.spotId as ClueSpotId, unlockedAt),
          barcodeNumber,
          isDemoCoupon: !isLive,
        };
      }),
    };
  }

  saveSession(session: UserSessionState): UserSessionState {
    const nowIso = new Date().toISOString();
    const normalized: UserSessionState = {
      ...this.issueCouponBarcodes(session),
      spotAuthentications: session.spotAuthentications ?? {},
      lastAccessedAt: nowIso,
      updatedAt: session.updatedAt || nowIso,
    };

    this.db.exec('BEGIN');
    try {
      this.db
        .prepare(
          `INSERT INTO progress_records (user_id, session_json, updated_at)
           VALUES (?, ?, ?)
           ON CONFLICT(user_id) DO UPDATE SET
             session_json = excluded.session_json,
             updated_at = excluded.updated_at`
        )
        .run(session.sessionId, JSON.stringify(normalized), normalized.updatedAt);

      for (const record of Object.values(normalized.spotAuthentications ?? {})) {
        if (record) {
          this.upsertSpotAuthentication(session.sessionId, record);
        }
      }

      this.db
        .prepare('UPDATE users SET last_accessed_at = ? WHERE user_id = ?')
        .run(nowIso, session.sessionId);

      this.db.exec('COMMIT');
      return normalized;
    } catch (err) {
      this.db.exec('ROLLBACK');
      throw err;
    }
  }

  /** 시연용(demo) 쿠폰의 본인 사용 처리. 현장 쿠폰은 제휴처 확인이 필요하므로 거절한다. */
  redeemDemoCoupon(params: {
    userId: string;
    couponId: string;
  }): RedeemResult<{ session: UserSessionState }> {
    this.db.exec('BEGIN IMMEDIATE');
    try {
      const session = this.getSession(params.userId);
      const coupon = session?.coupons.find((c) => c.id === params.couponId);
      if (!session || !coupon || !coupon.unlocked) {
        this.db.exec('ROLLBACK');
        return { ok: false, statusCode: 404, code: 'NOT_FOUND', error: '사용할 수 있는 쿠폰을 찾지 못했습니다.' };
      }
      if (!coupon.isDemoCoupon) {
        this.db.exec('ROLLBACK');
        return { ok: false, statusCode: 403, code: 'PARTNER_VERIFY_REQUIRED', error: '현장 체험 쿠폰은 제휴처에서 바코드 확인 후 사용 처리됩니다.' };
      }
      if (coupon.used) {
        this.db.exec('ROLLBACK');
        return { ok: false, statusCode: 409, code: 'ALREADY_USED', error: '이미 사용 처리된 쿠폰입니다.' };
      }
      if (isCouponExpired(coupon.expiresAt)) {
        this.db.exec('ROLLBACK');
        return { ok: false, statusCode: 410, code: 'EXPIRED', error: '유효기간이 지난 쿠폰입니다.' };
      }
      const saved = this.markCouponUsed(session, coupon);
      this.db.exec('COMMIT');
      return { ok: true, session: saved };
    } catch (err) {
      this.db.exec('ROLLBACK');
      throw err;
    }
  }

  /** 운영자/제휴처가 바코드 번호로 현장 쿠폰을 1회만 사용 처리한다(서명 검증 + 원자적 처리). */
  redeemCouponByIssueCode(params: {
    issueCode: string;
  }): RedeemResult<{ session: UserSessionState; couponId: string; title: string }> {
    const code = (params.issueCode ?? '').trim().toUpperCase();
    if (!code) {
      return { ok: false, statusCode: 400, code: 'INVALID_CODE', error: '바코드 번호를 입력해 주세요.' };
    }
    if (isDemoBarcodeNumber(code)) {
      return { ok: false, statusCode: 400, code: 'DEMO_COUPON', error: '시연용 쿠폰 바코드는 현장 사용 처리를 할 수 없습니다.' };
    }
    this.db.exec('BEGIN IMMEDIATE');
    try {
      let owner: UserSessionState | null = null;
      let target: CouponRecord | undefined;
      for (const s of this.getAllSessions()) {
        const hit = s.coupons?.find((c) => c.barcodeNumber?.toUpperCase() === code);
        if (hit) {
          owner = this.getSession(s.sessionId) ?? s;
          target = hit;
          break;
        }
      }
      if (!owner || !target) {
        this.db.exec('ROLLBACK');
        return { ok: false, statusCode: 404, code: 'NOT_FOUND', error: '등록되지 않은 바코드입니다.' };
      }
      if (!verifyLiveCouponBarcodeSignature({ issueCode: code, userId: owner.sessionId, couponId: target.id })) {
        this.db.exec('ROLLBACK');
        return { ok: false, statusCode: 400, code: 'INVALID_SIGNATURE', error: '바코드 서명이 올바르지 않습니다.' };
      }
      const fresh = owner.coupons.find((c) => c.id === target!.id)!;
      if (fresh.used) {
        this.db.exec('ROLLBACK');
        return { ok: false, statusCode: 409, code: 'ALREADY_USED', error: '이미 사용 처리된 쿠폰입니다.' };
      }
      if (isCouponExpired(fresh.expiresAt)) {
        this.db.exec('ROLLBACK');
        return { ok: false, statusCode: 410, code: 'EXPIRED', error: '유효기간이 지난 쿠폰입니다.' };
      }
      const saved = this.markCouponUsed(owner, fresh);
      this.db.exec('COMMIT');
      return { ok: true, session: saved, couponId: fresh.id, title: fresh.title };
    } catch (err) {
      this.db.exec('ROLLBACK');
      throw err;
    }
  }

  /** 트랜잭션 안에서 호출: 쿠폰 used 표시 후 세션 JSON만 갱신한다. */
  private markCouponUsed(session: UserSessionState, coupon: CouponRecord): UserSessionState {
    const nowIso = new Date().toISOString();
    const next: UserSessionState = {
      ...session,
      coupons: session.coupons.map((c) =>
        c.id === coupon.id ? { ...c, used: true, usedAt: nowIso } : c
      ),
      updatedAt: nowIso,
      lastAccessedAt: nowIso,
    };
    this.db
      .prepare('UPDATE progress_records SET session_json = ?, updated_at = ? WHERE user_id = ?')
      .run(JSON.stringify(next), nowIso, session.sessionId);
    return next;
  }

  getAllSessions(): UserSessionState[] {
    const rows = this.db
      .prepare('SELECT session_json FROM progress_records')
      .all() as unknown as Array<{ session_json: string }>;
    const list: UserSessionState[] = [];
    for (const row of rows) {
      try {
        list.push(JSON.parse(row.session_json) as UserSessionState);
      } catch {
        // Ignore corrupted row
      }
    }
    return list;
  }

  getWallEntries(): WallEntry[] {
    const rows = this.db
      .prepare('SELECT entry_json FROM wall_entries ORDER BY published_at DESC LIMIT 40')
      .all() as unknown as Array<{ entry_json: string }>;
    const list: WallEntry[] = [];
    for (const row of rows) {
      try {
        list.push(JSON.parse(row.entry_json) as WallEntry);
      } catch {
        // Ignore corrupted row
      }
    }
    return list;
  }

  upsertWallEntry(entry: WallEntry): void {
    this.db
      .prepare(
        `INSERT INTO wall_entries (id, session_id, entry_json, published_at)
         VALUES (?, ?, ?, ?)
         ON CONFLICT(id) DO UPDATE SET
           entry_json = excluded.entry_json,
           published_at = excluded.published_at`
      )
      .run(entry.id, entry.sessionId, JSON.stringify(entry), entry.publishedAt);
  }

  deleteWallEntriesBySession(sessionId: string): void {
    this.db.prepare('DELETE FROM wall_entries WHERE session_id = ?').run(sessionId);
  }
}
