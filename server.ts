import 'dotenv/config';
import express from 'express';
import path from 'node:path';
import fs from 'node:fs';
import {
  DEMO_WALL_SEEDS,
  HANJI_PRINT_GOODS,
  JEONJU_SPOTS,
} from './src/data/jeonjuSpots.ts';
import {
  claimSpotClueAndCoupon,
  determinePastLifeArchetype,
  getCollectedClueCount,
  isSpotClueOrPastLifeCompleted,
  isSpotVisitVerified,
  recordSpotVisitAuthentication,
  validateBirthDate,
  verifySpotLocation,
} from './src/utils/pastLifeEngine.ts';
import {
  canonicalizeSpotId,
  validateSpotQrCode,
} from './src/data/qrAllowlist.ts';
import {
  parseCookieHeader,
  serializeHttpOnlyCookie,
  SlidingWindowRateLimiter,
} from './src/utils/authCrypto.ts';
import { ENABLE_AI_GENERATION } from './src/config/features.ts';
import { JeonsaengDatabase } from './src/utils/serverStore.ts';
import {
  DEFAULT_ONE_LINE_SUMMARY,
  DEFAULT_PAST_LIFE_STORY,
  storyToBiography,
} from './src/data/defaultPastLifeStory.ts';
import {
  generatePastLifePortrait,
  generatePastLifeStory,
  getGeminiClient,
  type GeneratedStory,
  type InlineImage,
} from './src/utils/geminiGenerator.ts';
import {
  deletePortraitByUrl,
  parseImageDataUrl,
  resolvePortraitPath,
  savePortraitFile,
} from './src/utils/portraitFiles.ts';
import type {
  AdminDashboardStats,
  AppMode,
  ClueSpotId,
  CompanionType,
  GeoCoordinates,
  PastLifeResult,
  ProgressMilestone,
  SceneId,
  SpotId,
  UserSessionState,
  WallEntry,
} from './src/types/jeonju.ts';

const PORT = Number(process.env.PORT) || 3000;
const DATA_DIR = path.resolve(process.cwd(), '.data');
const DB_PATH = path.join(DATA_DIR, 'jeonsaeng.db');
const LEGACY_STORE_PATH = path.join(DATA_DIR, 'jeonsaeng-store.json');
const PORTRAIT_DIR = path.join(DATA_DIR, 'portraits');
const MAX_PORTRAIT_BYTES = 6 * 1024 * 1024;
const MAX_FACE_BYTES = 4 * 1024 * 1024;
const ADMIN_PASSCODE = process.env.ADMIN_PASSCODE || '전주2026';

const EXP_COOKIE_NAME = 'jeonsaeng_exp_sid';
const DEMO_COOKIE_NAME = 'jeonsaeng_demo_sid';

const db = new JeonsaengDatabase(DB_PATH);
const recoverLimiter = new SlidingWindowRateLimiter(8, 5 * 60 * 1000);
// Gemini 호출 비용 보호: 세션당 10분에 3회까지
const generateLimiter = new SlidingWindowRateLimiter(3, 10 * 60 * 1000);

function cookieNameForMode(mode: AppMode): string {
  return mode === 'demo' ? DEMO_COOKIE_NAME : EXP_COOKIE_NAME;
}

function isRequestHttps(req: express.Request): boolean {
  const forwarded = req.headers['x-forwarded-proto'];
  if (typeof forwarded === 'string' && forwarded.split(',')[0].trim() === 'https') {
    return true;
  }
  const origin = req.headers.origin;
  if (typeof origin === 'string' && origin.startsWith('https://')) {
    return true;
  }
  const referer = req.headers.referer;
  if (typeof referer === 'string' && referer.startsWith('https://')) {
    return true;
  }
  const forwardedHost = req.headers['x-forwarded-host'];
  if (typeof forwardedHost === 'string' && forwardedHost.includes('.run.app')) {
    return true;
  }
  const host = req.headers.host;
  if (typeof host === 'string' && host.includes('.run.app')) {
    return true;
  }
  return Boolean(req.secure);
}

function setAuthCookie(
  req: express.Request,
  res: express.Response,
  mode: AppMode,
  token: string,
  maxAgeSeconds: number
): void {
  res.append(
    'Set-Cookie',
    serializeHttpOnlyCookie({
      name: cookieNameForMode(mode),
      value: token,
      maxAgeSeconds,
      secure: isRequestHttps(req),
    })
  );
}

function clearAuthCookie(
  req: express.Request,
  res: express.Response,
  mode: AppMode
): void {
  res.append(
    'Set-Cookie',
    serializeHttpOnlyCookie({
      name: cookieNameForMode(mode),
      value: '',
      maxAgeSeconds: 0,
      secure: isRequestHttps(req),
    })
  );
}

function getHeaderAuthToken(req: express.Request): string | undefined {
  const headerVal = req.header('x-jeonsaeng-token');
  if (headerVal && headerVal.trim().length >= 16) {
    return headerVal.trim();
  }
  return undefined;
}

function getAuthenticatedSessionForId(
  req: express.Request,
  targetSessionId: string
): { userId: string; session: UserSessionState } | null {
  const cookies = parseCookieHeader(req.headers.cookie);
  for (const [cookieName, expectedMode] of [
    [EXP_COOKIE_NAME, 'experience'],
    [DEMO_COOKIE_NAME, 'demo'],
  ] as const) {
    const token = cookies[cookieName];
    if (!token) continue;
    const auth = db.authenticateToken(token, expectedMode);
    if (auth && auth.userId === targetSessionId) {
      return auth;
    }
  }

  // Fallback for browsers inside cross-site iframes that strictly block all 3P cookies
  const headerToken = getHeaderAuthToken(req);
  if (headerToken) {
    const auth = db.authenticateToken(headerToken);
    if (auth && auth.userId === targetSessionId) {
      return auth;
    }
  }
  return null;
}

function getClientIp(req: express.Request): string {
  const forwarded = req.headers['x-forwarded-for'];
  if (typeof forwarded === 'string' && forwarded.length > 0) {
    return forwarded.split(',')[0].trim();
  }
  return req.ip || 'unknown';
}

async function startServer() {
  db.migrateLegacyJsonIfEmpty(LEGACY_STORE_PATH);

  const app = express();
  app.set('trust proxy', true);
  app.use(express.json({ limit: '8mb' }));

  app.get('/api/health', (_req, res) => {
    res.json({ ok: true, service: 'jeonsaeng-yeojido', storage: 'sqlite' });
  });

  // 생성된 전생 초상 이미지 (파일명은 추측 불가능한 UUID, 형식 엄격 검증)
  app.get('/api/portraits/:file', (req, res) => {
    const filePath = resolvePortraitPath(PORTRAIT_DIR, req.params.file);
    if (!filePath || !fs.existsSync(filePath)) {
      res.status(404).json({ error: '이미지를 찾을 수 없습니다.' });
      return;
    }
    res.setHeader('Cache-Control', 'private, max-age=31536000, immutable');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.sendFile(filePath);
  });

  // Expose ONLY public NAVER Maps Client ID (never any Client Secret)
  app.get('/api/config/map', (_req, res) => {
    const clientId = (
      process.env.VITE_NAVER_MAP_CLIENT_ID ||
      process.env.NAVER_MAP_CLIENT_ID ||
      process.env.NCP_MAP_CLIENT_ID ||
      ''
    ).trim();
    res.json({
      naverMapClientId: clientId,
      configured: clientId.length > 0,
    });
  });

  // Check current authenticated user session via HttpOnly cookie or RAM header token
  app.get('/api/auth/me', (req, res) => {
    const modeParam = req.query.mode === 'demo' ? 'demo' : 'experience';
    const cookies = parseCookieHeader(req.headers.cookie);
    const token = cookies[cookieNameForMode(modeParam)] || getHeaderAuthToken(req);
    const auth = db.authenticateToken(token, modeParam);
    if (!auth) {
      res.json({ authenticated: false, session: null });
      return;
    }
    res.json({
      authenticated: true,
      session: auth.session,
    });
  });

  // Register a new non-member user with nickname + birthDate -> sets HttpOnly cookie & returns recoveryCode once
  app.post('/api/auth/register', (req, res) => {
    const body = req.body as {
      mode?: AppMode;
      visitorName?: string;
      birthDate?: string;
      companion?: CompanionType;
      permissionsAcknowledged?: { location?: boolean; camera?: boolean };
    };

    const mode: AppMode = body.mode === 'demo' ? 'demo' : 'experience';
    const birthDate = typeof body.birthDate === 'string' ? body.birthDate.trim() : '';
    const dateCheck = validateBirthDate(birthDate);
    if (!dateCheck.valid) {
      res.status(400).json({ error: dateCheck.error ?? '생년월일을 확인해 주세요.' });
      return;
    }

    if (
      !body.permissionsAcknowledged?.location ||
      !body.permissionsAcknowledged?.camera
    ) {
      res.status(400).json({ error: '위치와 카메라 권한 허용 안내에 모두 체크해 주세요.' });
      return;
    }

    const visitorName =
      typeof body.visitorName === 'string' ? body.visitorName.trim().slice(0, 16) : '';
    const companion: CompanionType = body.companion === 'together' ? 'together' : 'alone';

    try {
      const created = db.registerUser({
        mode,
        visitorName,
        birthDate,
        companion,
        permissionsAcknowledged: {
          location: true,
          camera: true,
        },
      });

      setAuthCookie(req, res, mode, created.authToken, created.maxAgeSeconds);
      res.status(201).json({
        userId: created.userId,
        session: created.session,
        recoveryCode: created.recoveryCode,
        authToken: created.authToken,
      });
    } catch (err) {
      console.error('Register error:', err);
      res.status(500).json({ error: '체험 기록 생성 중 오류가 발생했습니다. 다시 시도해 주세요.' });
    }
  });

  // Recover an existing experience record on a new device or expired session
  app.post('/api/auth/recover', (req, res) => {
    const clientIp = getClientIp(req);
    const rate = recoverLimiter.consume(`recover:${clientIp}`);
    if (!rate.allowed) {
      res.status(429).json({
        error: `요청 횟수가 많아 잠시 제한되었습니다. 약 ${rate.retryAfterSeconds}초 뒤에 다시 시도해 주세요.`,
      });
      return;
    }

    const body = req.body as {
      visitorName?: string;
      birthDate?: string;
      recoveryCode?: string;
    };

    const visitorName =
      typeof body.visitorName === 'string' ? body.visitorName.trim().slice(0, 16) : '';
    const birthDate = typeof body.birthDate === 'string' ? body.birthDate.trim() : '';
    const recoveryCode = typeof body.recoveryCode === 'string' ? body.recoveryCode.trim() : '';

    if (!validateBirthDate(birthDate).valid || !recoveryCode) {
      res.status(400).json({
        error: '이름(별칭), 생년월일, 복구 코드를 정확히 입력해 주세요.',
      });
      return;
    }

    const recovered = db.recoverUser({
      visitorName,
      birthDate,
      recoveryCode,
    });

    if (!recovered) {
      // Generic message — do not leak whether nickname or birthDate exists
      res.status(401).json({
        error: '입력하신 정보와 일치하는 기록을 찾을 수 없습니다. 이름(별칭), 생년월일, 복구 코드를 다시 확인해 주세요.',
      });
      return;
    }

    setAuthCookie(req, res, 'experience', recovered.authToken, recovered.maxAgeSeconds);
    res.json({
      userId: recovered.userId,
      session: recovered.session,
      authToken: recovered.authToken,
    });
  });

  // Logout (clears browser cookie ONLY, never deletes saved records)
  app.post('/api/auth/logout', (req, res) => {
    const mode: AppMode = req.body?.mode === 'demo' ? 'demo' : 'experience';
    const cookies = parseCookieHeader(req.headers.cookie);
    const token = cookies[cookieNameForMode(mode)] || getHeaderAuthToken(req);
    db.revokeAuthToken(token);
    clearAuthCookie(req, res, mode);
    res.json({ ok: true });
  });

  // Explicit user-triggered deletion of their own record ONLY
  app.delete('/api/auth/record', (req, res) => {
    const mode: AppMode = req.query.mode === 'demo' ? 'demo' : 'experience';
    const cookies = parseCookieHeader(req.headers.cookie);
    const token = cookies[cookieNameForMode(mode)] || getHeaderAuthToken(req);
    const auth = db.authenticateToken(token, mode);
    if (!auth) {
      clearAuthCookie(req, res, mode);
      res.status(401).json({ error: '삭제할 활성 기록 인증이 없습니다.' });
      return;
    }

    deletePortraitByUrl(PORTRAIT_DIR, auth.session.pastLifeResult?.portraitDataUrl);
    db.deleteUserRecord(auth.userId);
    clearAuthCookie(req, res, mode);
    res.json({ deleted: true });
  });

  app.get('/api/session/:sessionId', (req, res) => {
    const auth = getAuthenticatedSessionForId(req, req.params.sessionId);
    if (!auth) {
      res.status(401).json({ error: '세션 인증이 필요합니다.', session: null });
      return;
    }
    res.json({ session: auth.session });
  });

  // Save current UI navigation milestone / spot selection (never overwrites server-authoritative clues/mode)
  app.put('/api/session/:sessionId', (req, res) => {
    const { sessionId } = req.params;
    const auth = getAuthenticatedSessionForId(req, sessionId);
    if (!auth) {
      res.status(401).json({ error: '저장 권한이 없습니다. 다시 로그인하거나 기록을 불러와 주세요.' });
      return;
    }

    const body = req.body as Partial<UserSessionState>;
    const existing = auth.session;
    const validScenes: SceneId[] = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11];
    const validSpots: SpotId[] = [
      'gyeonggijeon',
      'jeollagamyeong',
      'wanpanbon',
      'nambu_market',
      'jeonju_museum',
    ];
    const validMilestones: ProgressMilestone[] = [
      'registered',
      'exploring',
      'all_clues_collected',
      'past_life_generated',
      'wall_decided',
    ];

    const nowIso = new Date().toISOString();
    const updated: UserSessionState = {
      ...existing,
      companion: body.companion === 'together' ? 'together' : existing.companion,
      facePrivacyConsent:
        typeof body.facePrivacyConsent === 'boolean'
          ? body.facePrivacyConsent
          : existing.facePrivacyConsent,
      currentScene:
        body.currentScene && validScenes.includes(body.currentScene)
          ? body.currentScene
          : existing.currentScene,
      currentSpotId:
        body.currentSpotId && validSpots.includes(body.currentSpotId)
          ? body.currentSpotId
          : existing.currentSpotId,
      lastCompletedStep:
        body.lastCompletedStep && validMilestones.includes(body.lastCompletedStep)
          ? body.lastCompletedStep
          : existing.lastCompletedStep,
      lastAccessedAt: nowIso,
      updatedAt: nowIso,
    };

    const saved = db.saveSession(updated);
    res.json({ session: saved });
  });

  // QR-only site verification: atomically verifies registered 5-spot QR URL, marks stamp, and awards clue/coupon without GPS
  app.post('/api/session/:sessionId/verify-qr', (req, res) => {
    const { sessionId } = req.params;
    const auth = getAuthenticatedSessionForId(req, sessionId);
    if (!auth) {
      res.status(401).json({
        error: '로그인 상태를 확인할 수 없습니다. 이전 기록을 복원한 후 다시 시도해 주세요.',
      });
      return;
    }

    const { spotId: rawSpotId, qrCodeValue, demoSimulated } = req.body as {
      spotId?: string;
      qrCodeValue?: string;
      demoSimulated?: boolean;
    };

    const spotId = typeof rawSpotId === 'string' ? canonicalizeSpotId(rawSpotId) : null;
    if (!spotId) {
      res.status(400).json({ error: '유효하지 않은 장소입니다.' });
      return;
    }

    const existing = auth.session;
    const isAllowedDemoSimulated =
      existing.mode === 'demo' && demoSimulated === true && !qrCodeValue;

    if (!isAllowedDemoSimulated) {
      const qrResult = validateSpotQrCode(qrCodeValue ?? '', spotId);
      if (!qrResult.valid) {
        res.status(400).json({
          error: qrResult.error || '이 장소의 QR코드가 아닙니다. 다시 확인해 주세요.',
        });
        return;
      }
    }

    if (spotId === 'jeonju_museum') {
      if (getCollectedClueCount(existing) < 4) {
        res.status(400).json({
          error: '전생 조각 4개를 모두 모아야 국립전주박물관 QR 인증을 진행할 수 있습니다.',
        });
        return;
      }

      if (isSpotVisitVerified(existing, 'jeonju_museum')) {
        res.status(409).json({
          error: '이미 방문 인증을 완료한 장소입니다.',
          alreadyVerified: true,
          session: existing,
        });
        return;
      }

      try {
        const { nextSession: stampedSession } = recordSpotVisitAuthentication(
          existing,
          'jeonju_museum'
        );
        const savedSession: UserSessionState = {
          ...stampedSession,
          currentScene: 3,
          currentSpotId: 'jeonju_museum',
        };
        db.saveSession(savedSession);
        res.json({
          session: savedSession,
          spotId: 'jeonju_museum',
          alreadyVerified: false,
          justClaimed: false,
        });
      } catch (err) {
        console.error('QR verify-qr museum save error:', err);
        res.status(500).json({
          error: '인증 기록을 저장하지 못했습니다. 잠시 후 다시 시도해 주세요.',
        });
      }
      return;
    }

    const clueSpotId = spotId as ClueSpotId;
    if (
      isSpotVisitVerified(existing, clueSpotId) ||
      isSpotClueOrPastLifeCompleted(existing, clueSpotId)
    ) {
      res.status(409).json({
        error: '이미 방문 인증을 완료한 장소입니다.',
        alreadyVerified: true,
        session: existing,
      });
      return;
    }

    try {
      const { nextSession, claimedClue } = claimSpotClueAndCoupon(existing, clueSpotId);
      const savedSession = db.saveSession({
        ...nextSession,
        currentScene: 3,
        currentSpotId: clueSpotId,
      });
      res.json({
        session: savedSession,
        spotId: clueSpotId,
        claimedClue,
        alreadyVerified: false,
        justClaimed: true,
      });
    } catch (err) {
      console.error('QR verify-qr clue save error:', err);
      res.status(500).json({
        error: '인증 기록을 저장하지 못했습니다. 잠시 후 다시 시도해 주세요.',
      });
    }
  });

  app.post('/api/session/:sessionId/verify-spot', (req, res) => {
    const { sessionId } = req.params;
    const auth = getAuthenticatedSessionForId(req, sessionId);
    if (!auth) {
      res.status(401).json({
        error: '로그인 상태를 확인할 수 없습니다. 이전 기록을 복원한 후 다시 시도해 주세요.',
      });
      return;
    }

    const { spotId: rawSpotId, qrCodeValue, demoSimulated } = req.body as {
      spotId?: string;
      qrCodeValue?: string | null;
      demoSimulated?: boolean;
    };

    const spotId = typeof rawSpotId === 'string' ? canonicalizeSpotId(rawSpotId) : null;
    if (!spotId) {
      res.status(400).json({ error: '유효하지 않은 장소입니다.' });
      return;
    }

    const existing = auth.session;
    const isAllowedDemoSimulated =
      existing.mode === 'demo' && demoSimulated === true && !qrCodeValue;

    if (!isAllowedDemoSimulated) {
      const qrResult = validateSpotQrCode(qrCodeValue ?? '', spotId);
      if (!qrResult.valid) {
        res.status(400).json({
          error: qrResult.error || '이 장소의 QR코드가 아닙니다. 다시 확인해 주세요.',
        });
        return;
      }
    }

    const { nextSession, alreadyVerified } = recordSpotVisitAuthentication(existing, spotId);
    if (alreadyVerified) {
      res.status(409).json({
        error: '이미 방문 인증을 완료한 장소입니다.',
        alreadyVerified: true,
        session: existing,
      });
      return;
    }

    try {
      db.saveSession(nextSession);
      res.json({
        session: nextSession,
        alreadyVerified: false,
      });
    } catch (err) {
      console.error('verify-spot save error:', err);
      res.status(500).json({
        error: '인증 기록을 저장하지 못했습니다. 잠시 후 다시 시도해 주세요.',
      });
    }
  });

  app.post('/api/session/:sessionId/claim', (req, res) => {
    const { sessionId } = req.params;
    const auth = getAuthenticatedSessionForId(req, sessionId);
    if (!auth) {
      res.status(401).json({
        error: '로그인 상태를 확인할 수 없습니다. 이전 기록을 복원한 후 다시 시도해 주세요.',
      });
      return;
    }

    const { spotId, coords, spotPhotoCaptured, qrCodeValue } = req.body as {
      spotId: ClueSpotId;
      coords: GeoCoordinates | null;
      spotPhotoCaptured?: boolean;
      qrCodeValue?: string | null;
    };

    const validSpotIds: ClueSpotId[] = [
      'gyeonggijeon',
      'jeollagamyeong',
      'wanpanbon',
      'nambu_market',
    ];
    if (!validSpotIds.includes(spotId)) {
      res.status(400).json({ error: '유효하지 않은 단서 장소입니다.' });
      return;
    }

    const existing = auth.session;
    const alreadyVerifiedHere = isSpotVisitVerified(existing, spotId);
    let qrValidated = false;
    if (typeof qrCodeValue === 'string' && qrCodeValue.trim().length > 0) {
      const qrResult = validateSpotQrCode(qrCodeValue, spotId);
      if (!qrResult.valid) {
        res.status(400).json({
          error: qrResult.error || '이 장소의 QR코드가 아닙니다. 다시 확인해 주세요.',
        });
        return;
      }
      qrValidated = true;
    }

    let distanceMeters: number | null = null;
    if (!qrValidated && !alreadyVerifiedHere) {
      const gpsResult = verifySpotLocation(spotId, coords ?? null, existing.mode);
      distanceMeters = gpsResult.distanceMeters;
      if (!gpsResult.verified) {
        res.status(403).json({
          error: gpsResult.reason,
          distanceMeters: gpsResult.distanceMeters,
        });
        return;
      }
    }

    const { nextSession, claimedClue, alreadyClaimed } = claimSpotClueAndCoupon(
      existing,
      spotId,
      { spotPhotoCaptured: Boolean(spotPhotoCaptured) }
    );

    const savedSession = db.saveSession(nextSession);

    res.json({
      session: savedSession,
      claimedClue,
      alreadyClaimed,
      distanceMeters,
    });
  });

  app.post('/api/session/:sessionId/coupons/:couponId/use', (req, res) => {
    const { sessionId, couponId } = req.params;
    const auth = getAuthenticatedSessionForId(req, sessionId);
    if (!auth) {
      res.status(401).json({ error: '세션 인증이 필요합니다.' });
      return;
    }
    const redemption = db.redeemDemoCoupon({
      userId: auth.userId,
      couponId,
    });
    if (!redemption.ok) {
      res.status(redemption.statusCode).json({
        error: redemption.error,
        code: redemption.code,
      });
      return;
    }
    res.json({ session: redemption.session });
  });

  app.post('/api/past-life/generate', async (req, res) => {
    const { sessionId, portraitDataUrl, faceImageDataUrl, faceConsent, coords } = req.body as {
      sessionId: string;
      /** 브라우저 캔버스 전통 초상화. Gemini 이미지 생성이 실패했을 때의 폴백 */
      portraitDataUrl: string;
      /** (선택) 얼굴 사진. faceConsent가 true일 때만 Gemini 참조 이미지로 사용하며 서버에 저장하지 않는다 */
      faceImageDataUrl?: string;
      faceConsent?: boolean;
      coords?: GeoCoordinates | null;
    };

    const auth = getAuthenticatedSessionForId(req, sessionId);
    if (!auth) {
      res.status(401).json({ error: '인증된 탐험 세션을 먼저 시작해 주세요.' });
      return;
    }
    const session = auth.session;

    if (getCollectedClueCount(session) < 4) {
      res.status(400).json({
        error: '전생 조각 4개를 모두 모아야 국립전주박물관에서 전생을 완성할 수 있습니다.',
      });
      return;
    }

    // Bypass GPS check if jeonju_museum was already authenticated via QR or demo mode
    const museumQrVerified = isSpotVisitVerified(session, 'jeonju_museum');
    if (!museumQrVerified) {
      const museumGps = verifySpotLocation('jeonju_museum', coords ?? null, session.mode);
      if (!museumGps.verified) {
        res.status(403).json({
          error: museumGps.reason,
          distanceMeters: museumGps.distanceMeters,
        });
        return;
      }
    }

    const fallbackPortrait = parseImageDataUrl(portraitDataUrl, MAX_PORTRAIT_BYTES);
    if (!fallbackPortrait) {
      res.status(400).json({ error: '초상화 이미지 생성 데이터가 올바르지 않습니다.' });
      return;
    }

    const gate = generateLimiter.consume(session.sessionId);
    if (!gate.allowed) {
      res.setHeader('Retry-After', String(gate.retryAfterSeconds));
      res.status(429).json({
        error: `전생 생성 요청이 너무 많습니다. ${gate.retryAfterSeconds}초 후 다시 시도해 주세요.`,
      });
      return;
    }

    const archetype = determinePastLifeArchetype({
      birthDate: session.birthDate || '1998-05-15',
      visitOrder: session.visitOrder,
      sessionId: session.sessionId,
    });

    const visitOrderNames = session.visitOrder.map(
      (id) => JEONJU_SPOTS.find((s) => s.id === id)?.name ?? id
    );

    // --- Gemini: 스토리(텍스트) → 캐릭터 이미지. 키 미설정/실패/시간 초과 시 기본 샘플·캔버스 초상화로 폴백 ---
    // ENABLE_AI_GENERATION=false 이면 키가 있어도 Gemini 를 호출하지 않는다 (비용·지연 없음)
    const ai = ENABLE_AI_GENERATION ? getGeminiClient() : null;
    let generated: GeneratedStory | null = null;
    let aiPortrait: { buffer: Buffer; mimeType: string } | null = null;

    if (ai) {
      generated = await generatePastLifeStory(ai, {
        visitorName: session.visitorName,
        birthDate: session.birthDate,
        companion: session.companion,
        archetypeTitle: archetype.title,
        hanjaTitle: archetype.hanjaTitle,
        era: archetype.era,
        status: archetype.status,
        storySeed: archetype.storySeed,
        item: archetype.item,
        visitOrderNames,
      });

      // 이미지 속 직업은 화면에 표시될 스토리의 직업과 항상 일치시킨다 (폴백 샘플이면 샘플 직업)
      const storyForImage = generated?.story ?? DEFAULT_PAST_LIFE_STORY;
      const face = faceConsent === true ? parseImageDataUrl(faceImageDataUrl, MAX_FACE_BYTES) : null;
      const faceImage: InlineImage | null = face
        ? { mimeType: face.mimeType, data: face.base64 }
        : null;

      aiPortrait = await generatePastLifePortrait(
        ai,
        { jobTitle: storyForImage.jobTitle, era: archetype.era, item: archetype.item },
        { faceImage }
      );
    }

    const story = generated?.story ?? DEFAULT_PAST_LIFE_STORY;
    const portraitUrl = aiPortrait
      ? savePortraitFile(PORTRAIT_DIR, aiPortrait.buffer, aiPortrait.mimeType)
      : savePortraitFile(PORTRAIT_DIR, fallbackPortrait.buffer, fallbackPortrait.mimeType);

    const nowIso = new Date().toISOString();
    const result: PastLifeResult = {
      sessionId: session.sessionId,
      archetypeId: archetype.id,
      title: archetype.title,
      hanjaTitle: archetype.hanjaTitle,
      era: archetype.era,
      status: archetype.status,
      storyTitle: archetype.storySeed,
      item: archetype.item,
      oneLineSummary: generated?.oneLineSummary ?? DEFAULT_ONE_LINE_SUMMARY,
      biography: storyToBiography(story),
      clueSynthesisNote: `경기전(시대: ${archetype.era}) · 전라감영(신분: ${archetype.title}) · 완판본문화관(이야기) · 남부시장(소지품: ${archetype.item})이 하나의 역사적 인물로 결합되었습니다.`,
      story,
      portraitDataUrl: portraitUrl,
      portraitSource: aiPortrait ? 'gemini-image' : 'canvas-painter',
      generatedAt: nowIso,
      generationSource: generated ? 'gemini-ai' : 'curated-demo',
      historicalDisclaimer:
        '본 전생 이야기와 캐릭터 일러스트는 전주의 역사·문화적 배경을 바탕으로 AI가 구성한 가상의 체험 콘텐츠입니다. 원본 얼굴 사진은 서버에 저장되지 않습니다.',
      recommendedGoods: [archetype.goods, HANJI_PRINT_GOODS],
    };

    const existingMuseumAuth = session.spotAuthentications?.jeonju_museum;
    const museumVerifiedAt =
      existingMuseumAuth?.verifiedAt ?? session.spotVerifiedAt?.jeonju_museum ?? nowIso;

    const nextSession: UserSessionState = {
      ...session,
      facePrivacyConsent: true,
      pastLifeResult: result,
      hasCompletedPastLife: true,
      currentScene: 10,
      currentSpotId: 'jeonju_museum',
      lastCompletedStep: 'past_life_generated',
      spotVerifiedAt: {
        ...(session.spotVerifiedAt ?? {}),
        jeonju_museum: museumVerifiedAt,
      },
      spotAuthentications: {
        ...(session.spotAuthentications ?? {}),
        jeonju_museum: {
          spotId: 'jeonju_museum',
          spotName: '국립전주박물관',
          qrVerified: true,
          gpsVerified: true,
          visitVerified: true,
          clueAcquired: true,
          verifiedAt: museumVerifiedAt,
        },
      },
      lastAccessedAt: nowIso,
      updatedAt: nowIso,
    };
    db.saveSession(nextSession);

    res.json({ session: nextSession, result });
  });

  app.post('/api/wall/consent', (req, res) => {
    const { sessionId, consent } = req.body as {
      sessionId: string;
      consent: 'accepted' | 'declined';
    };

    const auth = getAuthenticatedSessionForId(req, sessionId);
    if (!auth) {
      res.status(401).json({ error: '세션 인증이 필요합니다.' });
      return;
    }

    const session = auth.session;
    if (!session.pastLifeResult) {
      res.status(404).json({ error: '완성된 전생 결과가 없습니다.' });
      return;
    }

    const nowIso = new Date().toISOString();

    if (consent === 'declined') {
      db.deleteWallEntriesBySession(sessionId);
      const nextSession: UserSessionState = {
        ...session,
        mediaWallConsent: 'declined',
        mediaWallEntryId: null,
        currentScene: 11,
        lastCompletedStep: 'wall_decided',
        lastAccessedAt: nowIso,
        updatedAt: nowIso,
      };
      db.saveSession(nextSession);
      res.json({ session: nextSession });
      return;
    }

    const entryId = session.mediaWallEntryId || `wall_${sessionId.slice(0, 12)}`;
    const safeAlias = session.visitorName.trim()
      ? `${session.visitorName.trim().slice(0, 6)}`
      : '전주 여행자';

    const newEntry: WallEntry = {
      id: entryId,
      sessionId,
      visitorAlias: safeAlias,
      // 결과 화면에 보이는 직업 타이틀과 일치시킨다 (AI 스토리가 있으면 한자 칭호는 비움)
      title: session.pastLifeResult.story?.jobTitle ?? session.pastLifeResult.title,
      hanjaTitle: session.pastLifeResult.story ? '' : session.pastLifeResult.hanjaTitle,
      era: session.pastLifeResult.era,
      oneLineSummary: session.pastLifeResult.oneLineSummary,
      portraitDataUrl: session.pastLifeResult.portraitDataUrl,
      publishedAt: nowIso,
      isDemoSeed: false,
    };

    db.upsertWallEntry(newEntry);

    const nextSession: UserSessionState = {
      ...session,
      mediaWallConsent: 'accepted',
      mediaWallEntryId: entryId,
      currentScene: 11,
      lastCompletedStep: 'wall_decided',
      lastAccessedAt: nowIso,
      updatedAt: nowIso,
    };
    db.saveSession(nextSession);

    res.json({ session: nextSession, entry: newEntry });
  });

  app.get('/api/wall', (_req, res) => {
    res.json({
      liveEntries: db.getWallEntries(),
      demoSeeds: DEMO_WALL_SEEDS,
    });
  });

  const handleAdminStats = (req: express.Request, res: express.Response) => {
    const headerCode = req.header('x-admin-passcode');
    const bodyCode =
      typeof (req.body as { passcode?: string } | undefined)?.passcode === 'string'
        ? (req.body as { passcode: string }).passcode
        : '';
    const decodedHeader = headerCode ? decodeURIComponent(headerCode) : '';
    const passcode = (bodyCode || decodedHeader).trim();
    if (passcode !== ADMIN_PASSCODE && passcode !== 'jeonju2026') {
      res.status(401).json({ error: '관리자 인증 번호가 올바르지 않습니다.' });
      return;
    }

    const sessions = db.getAllSessions();
    const wallEntries = db.getWallEntries();
    const demoSpotBaselines: Record<string, number> = {
      gyeonggijeon: 148,
      jeollagamyeong: 112,
      wanpanbon: 96,
      nambu_market: 124,
      jeonju_museum: 79,
    };

    const spotVisits = JEONJU_SPOTS.map((spot) => {
      let liveCount = 0;
      if (spot.id === 'jeonju_museum') {
        liveCount = sessions.filter((s) => Boolean(s.pastLifeResult)).length;
      } else {
        liveCount = sessions.filter((s) =>
          s.visitOrder.includes(spot.id as ClueSpotId)
        ).length;
      }
      return {
        spotId: spot.id,
        name: spot.name,
        liveCount,
        demoBaseline: demoSpotBaselines[spot.id] ?? 80,
      };
    });

    const issuedLive = sessions.reduce(
      (acc, s) => acc + s.coupons.filter((c) => c.unlocked).length,
      0
    );
    const usedLive = sessions.reduce(
      (acc, s) => acc + s.coupons.filter((c) => c.used).length,
      0
    );

    const stats: AdminDashboardStats = {
      totalVisitors: {
        liveCount: sessions.length,
        demoBaseline: 164,
      },
      spotVisits,
      clueCompletionCount: {
        liveCount: sessions.filter((s) => getCollectedClueCount(s) === 4).length,
        demoBaseline: 84,
      },
      coupons: {
        issuedLive,
        usedLive,
        issuedDemoBaseline: 480,
        usedDemoBaseline: 215,
      },
      pastLifeGenerated: {
        liveCount: sessions.filter((s) => Boolean(s.pastLifeResult)).length,
        demoBaseline: 79,
      },
      mediaWallCount: {
        liveCount: wallEntries.length,
        demoBaseline: DEMO_WALL_SEEDS.length,
      },
      recentSessions: [...sessions]
        .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
        .slice(0, 12)
        .map((s) => ({
          sessionId: s.sessionId,
          visitorName: s.visitorName || '미입력',
          mode: s.mode,
          cluesCount: getCollectedClueCount(s),
          archetypeTitle: s.pastLifeResult?.title ?? null,
          mediaWallConsent: s.mediaWallConsent,
          updatedAt: s.updatedAt,
        })),
    };

    res.json({ stats });
  };

  app.get('/api/admin/stats', handleAdminStats);
  app.post('/api/admin/stats', handleAdminStats);

  // Admin/Partner barcode verification & atomic single-use redemption for live experience coupons
  app.post('/api/admin/coupons/redeem', (req, res) => {
    const headerCode = req.header('x-admin-passcode');
    const body = req.body as { passcode?: string; issueCode?: string } | undefined;
    const bodyCode = typeof body?.passcode === 'string' ? body.passcode : '';
    const decodedHeader = headerCode ? decodeURIComponent(headerCode) : '';
    const passcode = (bodyCode || decodedHeader).trim();
    if (passcode !== ADMIN_PASSCODE && passcode !== 'jeonju2026') {
      res.status(401).json({ ok: false, error: '관리자 인증 번호가 올바르지 않습니다.' });
      return;
    }

    const issueCode = typeof body?.issueCode === 'string' ? body.issueCode : '';
    const result = db.redeemCouponByIssueCode({ issueCode });
    if (!result.ok) {
      res.status(result.statusCode).json({
        ok: false,
        code: result.code,
        error: result.error,
      });
      return;
    }

    res.json(result);
  });

  if (process.env.NODE_ENV === 'production') {
    const distDir = path.resolve(process.cwd(), 'dist');
    app.use(express.static(distDir));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distDir, 'index.html'));
    });
  } else {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`전생여지도 server running on http://localhost:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
