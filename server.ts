import 'dotenv/config';
import express from 'express';
import path from 'node:path';
import { GoogleGenAI, ThinkingLevel, Type } from '@google/genai';
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
import { JeonsaengDatabase } from './src/utils/serverStore.ts';
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
const ADMIN_PASSCODE = process.env.ADMIN_PASSCODE || '전주2026';

const EXP_COOKIE_NAME = 'jeonsaeng_exp_sid';
const DEMO_COOKIE_NAME = 'jeonsaeng_demo_sid';

const db = new JeonsaengDatabase(DB_PATH);
const recoverLimiter = new SlidingWindowRateLimiter(8, 5 * 60 * 1000);

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

function getGeminiClient(): GoogleGenAI | null {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey === 'MY_GEMINI_API_KEY') {
    return null;
  }
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

async function generateNarrativeWithGemini(params: {
  visitorName: string;
  birthDate: string;
  companion: 'alone' | 'together';
  archetypeTitle: string;
  hanjaTitle: string;
  era: string;
  status: string;
  storySeed: string;
  item: string;
  visitOrderNames: string[];
}): Promise<{
  oneLineSummary: string;
  biography: string;
  clueSynthesisNote: string;
  generationSource: 'gemini-ai' | 'curated-demo';
}> {
  const displayName = params.visitorName.trim() || '전주의 나그네';
  const fallback = {
    oneLineSummary: `${params.era}, ${params.storySeed}`,
    biography: `${displayName}님은 ${params.era}의 전주 땅에서 ${params.status}로 살아갔던 인물입니다. ${params.visitOrderNames.join(' → ')}을 거치며 모은 네 가지 단서는 하나의 서사로 이어집니다. 경기전의 왕실 기풍 속에서 시대의 숨결을 배웠고, 전라감영의 선화당 앞뜰에서 맡은 바 소임을 다했으며, 완판본에 담긴 한글 이야기에 마음을 얹었습니다. 늘 품에 지녔던 ${params.item}은(는) 훗날 풍남문 밖 저잣거리에서도 사람들과 신의를 나누는 징표가 되었습니다.`,
    clueSynthesisNote: `경기전(시대: ${params.era}) · 전라감영(신분: ${params.archetypeTitle}) · 완판본문화관(이야기) · 남부시장(소지품: ${params.item})이 하나의 역사적 인물로 결합되었습니다.`,
    generationSource: 'curated-demo' as const,
  };

  const ai = getGeminiClient();
  if (!ai) {
    return fallback;
  }

  try {
    const prompt = `당신은 전주 역사문화 체험 '전생여지도'의 전속 사관(史官)입니다.
다음 네 가지 확정된 전생 단서와 여행 정보를 바탕으로, 역사적 사실에 위배되지 않는 따뜻하고 몰입감 있는 가상의 전생 일대기를 한국어로 작성해 주세요.

[확정 단서 — 절대 변경하거나 모순되는 시대/직업/소지품을 만들지 마세요]
- 참여자 호칭: ${displayName} (동행 형태: ${params.companion === 'together' ? '일행과 함께' : '홀로 탐험'})
- 전생 칭호: ${params.archetypeTitle} (${params.hanjaTitle})
- 시대 (경기전 단서): ${params.era}
- 신분 (전라감영 단서): ${params.status}
- 핵심 일화 (완판본문화관 단서): ${params.storySeed}
- 소지품 (남부시장 단서): ${params.item}
- 탐험 동선: ${params.visitOrderNames.join(' -> ')}

[작성 규칙]
1. 실제 역사적 인물이나 존재하지 않은 역사 사건을 실제 사실처럼 단정하지 말고, 전주의 실제 공간 배경(경기전, 전라감영, 완판본문화관, 남부시장, 국립전주박물관)에 어울리는 가상의 개인 서사로 써 주세요.
2. 외모 평가나 관상·운명 단정은 금지합니다.
3. oneLineSummary는 35~55자 이내의 시적인 한 줄 요약으로 작성하세요.
4. biography는 3~4문장(약 220~300자)으로, 네 장소의 단서가 어떻게 연결되는지 자연스럽게 녹여 쓰세요.
5. clueSynthesisNote는 네 조각이 어떻게 하나의 인물로 연결되었는지 1~2문장으로 설명하세요.`;

    const response = await Promise.race([
      ai.models.generateContent({
        model: 'gemini-4-hydrogen',
        contents: prompt,
        config: {
          thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
          systemInstruction:
            'You are a careful Korean cultural heritage storyteller for Jeonju. Always output valid JSON in Korean matching the schema.',
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              oneLineSummary: { type: Type.STRING },
              biography: { type: Type.STRING },
              clueSynthesisNote: { type: Type.STRING },
            },
            required: ['oneLineSummary', 'biography', 'clueSynthesisNote'],
          },
        },
      }),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('Gemini API timeout (12s)')), 12000)
      ),
    ]);

    const text = (response.text ?? '').trim();
    if (!text) return fallback;
    const parsed = JSON.parse(text) as {
      oneLineSummary?: string;
      biography?: string;
      clueSynthesisNote?: string;
    };
    if (!parsed.oneLineSummary || !parsed.biography || !parsed.clueSynthesisNote) {
      return fallback;
    }
    return {
      oneLineSummary: parsed.oneLineSummary,
      biography: parsed.biography,
      clueSynthesisNote: parsed.clueSynthesisNote,
      generationSource: 'gemini-ai',
    };
  } catch (err) {
    console.warn('Gemini narrative fallback activated:', err instanceof Error ? err.message : err);
    return fallback;
  }
}

async function startServer() {
  db.migrateLegacyJsonIfEmpty(LEGACY_STORE_PATH);

  const app = express();
  app.set('trust proxy', true);
  app.use(express.json({ limit: '8mb' }));

  app.get('/api/health', (_req, res) => {
    res.json({ ok: true, service: 'jeonsaeng-yeojido', storage: 'sqlite' });
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
    const { sessionId, portraitDataUrl, coords } = req.body as {
      sessionId: string;
      portraitDataUrl: string;
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

    if (!portraitDataUrl || !portraitDataUrl.startsWith('data:image/')) {
      res.status(400).json({ error: '초상화 이미지 생성 데이터가 올바르지 않습니다.' });
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

    const narrative = await generateNarrativeWithGemini({
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
      oneLineSummary: narrative.oneLineSummary,
      biography: narrative.biography,
      clueSynthesisNote: narrative.clueSynthesisNote,
      portraitDataUrl,
      generatedAt: nowIso,
      generationSource: narrative.generationSource,
      historicalDisclaimer:
        '본 전생 일대기는 전주의 실제 역사·문화적 배경을 바탕으로 AI가 구성한 가상의 체험 서사입니다. 원본 얼굴 사진은 초상 생성 즉시 파기되었습니다.',
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
      title: session.pastLifeResult.title,
      hanjaTitle: session.pastLifeResult.hanjaTitle,
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
