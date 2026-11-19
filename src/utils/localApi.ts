/**
 * 로컬 단독 실행용 API (서버·DB·Supabase 없이 브라우저만으로 전체 플로우 동작).
 *
 * `apiFetch` 는 `fetch` 와 같은 모양이며, USE_LOCAL_BACKEND 가 true 이면 `/api/*` 요청을
 * 이 파일의 핸들러가 직접 처리해 `Response` 로 돌려준다. (서버 라우트 로직은 순수 함수인
 * pastLifeEngine / qrAllowlist 를 그대로 재사용하므로 검증 규칙이 서버와 같다.)
 *
 * 저장소 정책
 *  - 체험 세션(생년월일 포함)은 sessionStorage — 탭을 닫으면 사라진다. localStorage 에는 개인정보를 두지 않는다.
 *  - 미디어월 전시 목록(별칭·직업·대표 대사만)은 같은 브라우저의 /wall 에서 보이도록 localStorage.
 *  - 어떤 저장소도 쓸 수 없는 환경이면 메모리에만 보관한다 (에러 없이 동작).
 */
import { ENABLE_QUICK_COMPLETE_BUTTON, USE_LOCAL_BACKEND } from '../config/features';
import { COUPON_CATEGORIES, COUPON_TEMPLATES, pickCouponTemplate } from '../data/coupons';
import {
  Character,
  characterToStory,
  clearCurrentCharacter,
  getCurrentCharacterId,
  getOrPickCurrentCharacter,
} from '../data/characters';
import { DEMO_WALL_SEEDS, HANJI_PRINT_GOODS, JEONJU_SPOTS } from '../data/jeonjuSpots';
import { canonicalizeSpotId, validateSpotQrCode } from '../data/qrAllowlist';
import type {
  AppMode,
  ClueSpotId,
  CouponCategory,
  CouponRecord,
  GeoCoordinates,
  PastLifeResult,
  PastLifeStory,
  ProgressMilestone,
  SceneId,
  SpotId,
  UserSessionState,
  WallEntry,
} from '../types/jeonju';
import {
  claimSpotClueAndCoupon,
  createInitialSession,
  determinePastLifeArchetype,
  getCollectedClueCount,
  isSpotClueOrPastLifeCompleted,
  isSpotVisitVerified,
  recordSpotVisitAuthentication,
  toggleCouponUsedState,
  validateBirthDate,
  verifySpotLocation,
} from './pastLifeEngine';
import { computeCouponExpiresAt, generateDemoBarcodeNumber } from './couponBarcode';

/** 스토리를 한 덩어리 전기 문장으로 합친다 (저장 기록용) */
function storyToBiography(story: PastLifeStory): string {
  return `${story.setting.replace(/\n+/g, ' ')} ${story.ending.replace(/\n+/g, ' ')}`.trim();
}

const SESSION_KEY_PREFIX = 'jeonsaeng:local:session:';
const WALL_KEY = 'jeonsaeng:local:wall';

// ---------------------------------------------------------------------------------------------
// 저장소 (storage 를 못 쓰면 메모리로 폴백)
// ---------------------------------------------------------------------------------------------
const memoryStore = new Map<string, string>();

function readStore(kind: 'session' | 'local', key: string): string | null {
  try {
    const store = kind === 'session' ? window.sessionStorage : window.localStorage;
    return store.getItem(key) ?? memoryStore.get(key) ?? null;
  } catch {
    return memoryStore.get(key) ?? null;
  }
}

function writeStore(kind: 'session' | 'local', key: string, value: string | null): void {
  if (value === null) memoryStore.delete(key);
  else memoryStore.set(key, value);
  try {
    const store = kind === 'session' ? window.sessionStorage : window.localStorage;
    if (value === null) store.removeItem(key);
    else store.setItem(key, value);
  } catch {
    // 메모리 보관분만 유효
  }
}

function loadSession(mode: AppMode): UserSessionState | null {
  const raw = readStore('session', SESSION_KEY_PREFIX + mode);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as UserSessionState;
  } catch {
    return null;
  }
}

function persistSession(session: UserSessionState): UserSessionState {
  writeStore('session', SESSION_KEY_PREFIX + session.mode, JSON.stringify(session));
  return session;
}

function findSessionById(sessionId: string): UserSessionState | null {
  const s = loadSession('experience');
  return s && s.sessionId === sessionId ? s : null;
}

/**
 * 새로 잠금 해제된 쿠폰 슬롯에 4대 카테고리 × 3종(12종) 템플릿 중 1종을 무작위로 채운다.
 * 카테고리를 균등 확률로 먼저 고른 뒤 그 안에서 뽑으며, 이미 보유 중인 템플릿은 피한다.
 */
export function assignRandomCoupons(
  coupons: CouponRecord[],
  rng: () => number = Math.random
): CouponRecord[] {
  const held: string[] = coupons.flatMap((c) => (c.unlocked && c.templateId ? [c.templateId] : []));
  return coupons.map((c) => {
    if (!c.unlocked || c.templateId) return c;
    const tpl = pickCouponTemplate(held, rng);
    held.push(tpl.id);
    return {
      ...c,
      templateId: tpl.id,
      category: tpl.category,
      title: tpl.storeName,
      benefit: tpl.benefit,
      locationHint: tpl.locationHint,
      partnerArea: tpl.locationHint,
      condition: '1인 1매 사용 가능 · 제휴 예정 모델(시연용 가상 쿠폰)',
    };
  });
}

/** 새로 잠금 해제된 쿠폰에 랜덤 템플릿·유효기간·시연용 바코드 번호를 채운다 (로컬 모드는 모두 시연용 쿠폰). */
function withCouponBarcodes(session: UserSessionState): UserSessionState {
  const nowIso = new Date().toISOString();
  return {
    ...session,
    coupons: assignRandomCoupons(session.coupons).map((c) => {
      if (!c.unlocked || c.barcodeNumber) return c;
      const unlockedAt = c.unlockedAt ?? nowIso;
      return {
        ...c,
        unlockedAt,
        expiresAt: c.expiresAt ?? computeCouponExpiresAt(c.spotId, unlockedAt),
        barcodeNumber: generateDemoBarcodeNumber(c.spotId, session.sessionId, unlockedAt),
      };
    }),
  };
}

export interface CouponCategoryStat {
  category: CouponCategory;
  /** 발급(잠금 해제)된 쿠폰 수 */
  issued: number;
  /** 사용 처리된 쿠폰 수 */
  used: number;
  /** 발급된 템플릿별 수량 (운영자 대시보드 상세용) */
  byTemplate: Record<string, number>;
}

/** 세션들의 쿠폰을 4대 카테고리별 발급·사용 수로 집계한다. 항상 4개 카테고리를 모두 반환한다. */
export function summarizeCouponsByCategory(sessions: UserSessionState[]): CouponCategoryStat[] {
  const stats: CouponCategoryStat[] = COUPON_CATEGORIES.map((category) => ({
    category,
    issued: 0,
    used: 0,
    byTemplate: Object.fromEntries(
      COUPON_TEMPLATES.filter((t) => t.category === category).map((t) => [t.id, 0])
    ),
  }));
  for (const s of sessions) {
    for (const c of s.coupons) {
      if (!c.unlocked || !c.templateId) continue;
      const stat = stats.find((x) => x.category === c.category);
      if (!stat) continue;
      stat.issued += 1;
      if (c.used) stat.used += 1;
      stat.byTemplate[c.templateId] = (stat.byTemplate[c.templateId] ?? 0) + 1;
    }
  }
  return stats;
}

/** 이 브라우저(로컬 모드)에 저장된 체험 세션 기준 카테고리별 쿠폰 현황. */
export function getLocalCouponCategoryStats(): CouponCategoryStat[] {
  const s = loadSession('experience');
  return summarizeCouponsByCategory(s ? [s] : []);
}

/** 운영자 대시보드가 가상 누적 수치에 +1 합산할 '이 브라우저의 현재 체험 기록' */
export interface AdminLiveSnapshot {
  /** 체험 세션이 시작되어 있는지 (한옥마을 QR 시작 +1) */
  hasSession: boolean;
  /** 방문 인증을 마친 거점 */
  visitedSpotIds: SpotId[];
  issuedByCategory: Record<CouponCategory, number>;
  usedByCategory: Record<CouponCategory, number>;
  issuedByTemplate: Record<string, number>;
  usedByTemplate: Record<string, number>;
  /** 이번 체험에서 뽑힌 전생 캐릭터 id (없으면 null) */
  characterId: string | null;
  mediaWallAccepted: boolean;
  visitorName: string;
}

/** 현재 탭의 체험 기록을 읽어 운영자 대시보드 합산용 스냅샷으로 만든다. (읽기 전용, 서버 호출 없음) */
export function getAdminLiveSnapshot(): AdminLiveSnapshot {
  const s = loadSession('experience');
  const zero = () => Object.fromEntries(COUPON_CATEGORIES.map((c) => [c, 0])) as Record<CouponCategory, number>;
  const snap: AdminLiveSnapshot = {
    hasSession: Boolean(s?.sessionId),
    visitedSpotIds: [],
    issuedByCategory: zero(),
    usedByCategory: zero(),
    issuedByTemplate: {},
    usedByTemplate: {},
    characterId: getCurrentCharacterId(),
    mediaWallAccepted: s?.mediaWallConsent === 'accepted',
    visitorName: s?.visitorName ?? '',
  };
  if (!s?.sessionId) return snap;
  snap.visitedSpotIds = JEONJU_SPOTS.filter((spot) => isSpotVisitVerified(s, spot.id)).map((spot) => spot.id);
  for (const c of s.coupons) {
    if (!c.unlocked || !c.templateId) continue;
    snap.issuedByCategory[c.category] += 1;
    snap.issuedByTemplate[c.templateId] = (snap.issuedByTemplate[c.templateId] ?? 0) + 1;
    if (c.used) {
      snap.usedByCategory[c.category] += 1;
      snap.usedByTemplate[c.templateId] = (snap.usedByTemplate[c.templateId] ?? 0) + 1;
    }
  }
  return snap;
}

function loadWall(): WallEntry[] {
  const raw = readStore('local', WALL_KEY);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as WallEntry[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveWall(entries: WallEntry[]): void {
  writeStore('local', WALL_KEY, JSON.stringify(entries.slice(0, 50)));
}

// ---------------------------------------------------------------------------------------------
// 응답 도우미
// ---------------------------------------------------------------------------------------------
function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

const AUTH_REQUIRED_MSG =
  '로그인 상태를 확인할 수 없습니다. 이전 기록을 복원한 후 다시 시도해 주세요.';

const VALID_SCENES: SceneId[] = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11];
const VALID_SPOTS: SpotId[] = ['gyeonggijeon', 'jeollagamyeong', 'wanpanbon', 'nambu_market', 'jeonju_museum'];
const VALID_MILESTONES: ProgressMilestone[] = [
  'registered',
  'exploring',
  'all_clues_collected',
  'past_life_generated',
  'wall_decided',
];

function parseBody(init?: RequestInit): Record<string, unknown> {
  if (!init?.body || typeof init.body !== 'string') return {};
  try {
    const parsed = JSON.parse(init.body);
    return parsed && typeof parsed === 'object' ? (parsed as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}

// ---------------------------------------------------------------------------------------------
// 라우트 핸들러 (server.ts 와 같은 규칙)
// ---------------------------------------------------------------------------------------------
function handleRegister(body: Record<string, unknown>): Response {
  const mode: AppMode = 'experience';
  const birthDate = typeof body.birthDate === 'string' ? body.birthDate.trim() : '';
  const dateCheck = validateBirthDate(birthDate);
  if (!dateCheck.valid) {
    return json(400, { error: dateCheck.error ?? '생년월일을 확인해 주세요.' });
  }
  const perms = body.permissionsAcknowledged as { location?: boolean; camera?: boolean } | undefined;
  if (!perms?.location || !perms?.camera) {
    return json(400, { error: '위치와 카메라 권한 허용 안내에 모두 체크해 주세요.' });
  }

  const visitorName = typeof body.visitorName === 'string' ? body.visitorName.trim().slice(0, 16) : '';
  const companion = body.companion === 'together' ? 'together' : 'alone';
  const userId = `usr_${crypto.randomUUID()}`;

  const session: UserSessionState = {
    ...createInitialSession({ sessionId: userId, mode, visitorName, birthDate, companion }),
    permissionsAcknowledged: { location: true, camera: true },
    currentScene: 3,
    currentSpotId: 'gyeonggijeon',
    lastCompletedStep: 'registered',
    recoveryCodeIssued: false, // 로컬 모드는 복구 코드를 발급하지 않는다
  };

  clearCurrentCharacter(); // 새 체험이므로 캐릭터를 새로 뽑는다
  persistSession(session);
  return json(201, { userId, session, recoveryCode: null });
}

function handleSessionPut(sessionId: string, body: Record<string, unknown>): Response {
  const existing = findSessionById(sessionId);
  if (!existing) return json(401, { error: '저장 권한이 없습니다. 다시 로그인하거나 기록을 불러와 주세요.' });

  const nowIso = new Date().toISOString();
  const scene = body.currentScene as SceneId | undefined;
  const spot = body.currentSpotId as SpotId | undefined;
  const step = body.lastCompletedStep as ProgressMilestone | undefined;
  const updated: UserSessionState = {
    ...existing,
    companion: body.companion === 'together' ? 'together' : existing.companion,
    facePrivacyConsent:
      typeof body.facePrivacyConsent === 'boolean' ? body.facePrivacyConsent : existing.facePrivacyConsent,
    currentScene: scene && VALID_SCENES.includes(scene) ? scene : existing.currentScene,
    currentSpotId: spot && VALID_SPOTS.includes(spot) ? spot : existing.currentSpotId,
    lastCompletedStep: step && VALID_MILESTONES.includes(step) ? step : existing.lastCompletedStep,
    lastAccessedAt: nowIso,
    updatedAt: nowIso,
  };
  return json(200, { session: persistSession(updated) });
}

function handleVerifyQr(sessionId: string, body: Record<string, unknown>): Response {
  const existing = findSessionById(sessionId);
  if (!existing) return json(401, { error: AUTH_REQUIRED_MSG });

  const spotId = typeof body.spotId === 'string' ? canonicalizeSpotId(body.spotId) : null;
  if (!spotId) return json(400, { error: '유효하지 않은 장소입니다.' });

  const qrCodeValue = typeof body.qrCodeValue === 'string' ? body.qrCodeValue : '';
  const qr = validateSpotQrCode(qrCodeValue, spotId);
  if (!qr.valid) {
    return json(400, { error: qr.error || '이 장소의 QR코드가 아닙니다. 다시 확인해 주세요.' });
  }

  if (spotId === 'jeonju_museum') {
    if (getCollectedClueCount(existing) < 4) {
      return json(400, { error: '전생 조각 4개를 모두 모아야 국립전주박물관 QR 인증을 진행할 수 있습니다.' });
    }
    if (isSpotVisitVerified(existing, 'jeonju_museum')) {
      return json(409, { error: '이미 방문 인증을 완료한 장소입니다.', alreadyVerified: true, session: existing });
    }
    const { nextSession } = recordSpotVisitAuthentication(existing, 'jeonju_museum');
    const saved = persistSession({ ...nextSession, currentScene: 3, currentSpotId: 'jeonju_museum' });
    return json(200, { session: saved, spotId, alreadyVerified: false, justClaimed: false });
  }

  const clueSpotId = spotId as ClueSpotId;
  if (isSpotVisitVerified(existing, clueSpotId) || isSpotClueOrPastLifeCompleted(existing, clueSpotId)) {
    return json(409, { error: '이미 방문 인증을 완료한 장소입니다.', alreadyVerified: true, session: existing });
  }
  const { nextSession, claimedClue } = claimSpotClueAndCoupon(existing, clueSpotId);
  const saved = persistSession(withCouponBarcodes({ ...nextSession, currentScene: 3, currentSpotId: clueSpotId }));
  return json(200, { session: saved, spotId: clueSpotId, claimedClue, alreadyVerified: false, justClaimed: true });
}

function handleVerifySpot(sessionId: string, body: Record<string, unknown>): Response {
  const existing = findSessionById(sessionId);
  if (!existing) return json(401, { error: AUTH_REQUIRED_MSG });

  const spotId = typeof body.spotId === 'string' ? canonicalizeSpotId(body.spotId) : null;
  if (!spotId) return json(400, { error: '유효하지 않은 장소입니다.' });

  const qrCodeValue = typeof body.qrCodeValue === 'string' ? body.qrCodeValue : '';
  const qr = validateSpotQrCode(qrCodeValue, spotId);
  if (!qr.valid) {
    return json(400, { error: qr.error || '이 장소의 QR코드가 아닙니다. 다시 확인해 주세요.' });
  }

  const { nextSession, alreadyVerified } = recordSpotVisitAuthentication(existing, spotId);
  if (alreadyVerified) {
    return json(409, { error: '이미 방문 인증을 완료한 장소입니다.', alreadyVerified: true, session: existing });
  }
  return json(200, { session: persistSession(nextSession), alreadyVerified: false });
}

function handleClaim(sessionId: string, body: Record<string, unknown>): Response {
  const existing = findSessionById(sessionId);
  if (!existing) return json(401, { error: AUTH_REQUIRED_MSG });

  const spotId = body.spotId as ClueSpotId;
  const validClueSpots: ClueSpotId[] = ['gyeonggijeon', 'jeollagamyeong', 'wanpanbon', 'nambu_market'];
  if (!validClueSpots.includes(spotId)) return json(400, { error: '유효하지 않은 단서 장소입니다.' });

  const alreadyVerifiedHere = isSpotVisitVerified(existing, spotId);
  let qrValidated = false;
  if (typeof body.qrCodeValue === 'string' && body.qrCodeValue.trim().length > 0) {
    const qr = validateSpotQrCode(body.qrCodeValue, spotId);
    if (!qr.valid) return json(400, { error: qr.error || '이 장소의 QR코드가 아닙니다. 다시 확인해 주세요.' });
    qrValidated = true;
  }

  let distanceMeters: number | null = null;
  if (!qrValidated && !alreadyVerifiedHere) {
    const gps = verifySpotLocation(spotId, (body.coords as GeoCoordinates | null) ?? null, existing.mode);
    distanceMeters = gps.distanceMeters;
    if (!gps.verified) return json(403, { error: gps.reason, distanceMeters: gps.distanceMeters });
  }

  const { nextSession, claimedClue, alreadyClaimed } = claimSpotClueAndCoupon(existing, spotId, {
    spotPhotoCaptured: Boolean(body.spotPhotoCaptured),
  });
  return json(200, { session: persistSession(withCouponBarcodes(nextSession)), claimedClue, alreadyClaimed, distanceMeters });
}

/**
 * [시연·검수용] 4개 거점의 방문·QR 인증과 조각·쿠폰 발급을 한 번에 완료로 반영한다.
 * ENABLE_QUICK_COMPLETE_BUTTON 이 false 이면 동작하지 않는다.
 */
function handleCompleteAllStamps(sessionId: string): Response {
  if (!ENABLE_QUICK_COMPLETE_BUTTON) return json(404, { error: '지원하지 않는 요청입니다.' });
  const existing = findSessionById(sessionId);
  if (!existing) return json(401, { error: AUTH_REQUIRED_MSG });

  const clueSpots: ClueSpotId[] = ['gyeonggijeon', 'jeollagamyeong', 'wanpanbon', 'nambu_market'];
  let next = existing;
  for (const spotId of clueSpots) {
    if (isSpotClueOrPastLifeCompleted(next, spotId)) continue;
    next = claimSpotClueAndCoupon(next, spotId).nextSession;
  }
  const saved = persistSession(
    withCouponBarcodes({ ...next, currentScene: 3, currentSpotId: 'jeonju_museum' })
  );
  return json(200, { session: saved });
}

function handleCouponUse(sessionId: string, couponId: string): Response {
  const existing = findSessionById(sessionId);
  if (!existing) return json(401, { error: '세션 인증이 필요합니다.' });

  const coupon = existing.coupons.find((c) => c.id === couponId);
  if (!coupon) return json(404, { error: '쿠폰을 찾을 수 없습니다.', code: 'NOT_FOUND' });
  if (!coupon.unlocked) return json(409, { error: '아직 잠금 해제되지 않은 쿠폰입니다.', code: 'LOCKED' });
  if (coupon.used) return json(409, { error: '이미 사용 처리된 쿠폰입니다.', code: 'ALREADY_USED' });

  return json(200, { session: persistSession(toggleCouponUsedState(existing, couponId)) });
}

/** 고정 10종 캐릭터로 결과를 만든다. (Gemini·서버 호출 없음) */
function handleGenerate(body: Record<string, unknown>): Response {
  const sessionId = typeof body.sessionId === 'string' ? body.sessionId : '';
  const session = findSessionById(sessionId);
  if (!session) return json(401, { error: '인증된 탐험 세션을 먼저 시작해 주세요.' });

  if (getCollectedClueCount(session) < 4) {
    return json(400, { error: '전생 조각 4개를 모두 모아야 국립전주박물관에서 전생을 완성할 수 있습니다.' });
  }

  const museumQrVerified = isSpotVisitVerified(session, 'jeonju_museum');
  if (!museumQrVerified) {
    const gps = verifySpotLocation('jeonju_museum', (body.coords as GeoCoordinates | null) ?? null, session.mode);
    if (!gps.verified) return json(403, { error: gps.reason, distanceMeters: gps.distanceMeters });
  }

  const archetype = determinePastLifeArchetype({
    birthDate: session.birthDate || '1998-05-15',
    visitOrder: session.visitOrder,
    sessionId: session.sessionId,
  });
  const character = getOrPickCurrentCharacter();
  const story = characterToStory(character);
  const nowIso = new Date().toISOString();

  const result: PastLifeResult = {
    sessionId: session.sessionId,
    archetypeId: archetype.id,
    title: character.title,
    hanjaTitle: '',
    era: archetype.era,
    status: archetype.status,
    storyTitle: archetype.storySeed,
    item: archetype.item,
    oneLineSummary: character.quote,
    biography: storyToBiography(story),
    clueSynthesisNote: `경기전(시대: ${archetype.era}) · 전라감영(신분: ${archetype.title}) · 완판본문화관(이야기) · 남부시장(소지품: ${archetype.item})이 하나의 인물로 결합되었습니다.`,
    story,
    portraitDataUrl: character.imageUrl,
    portraitSource: undefined,
    generatedAt: nowIso,
    generationSource: 'curated-demo',
    historicalDisclaimer:
      '본 전생 이야기와 캐릭터 일러스트는 전주의 역사·문화적 배경을 바탕으로 구성한 가상의 체험 콘텐츠입니다. 촬영한 얼굴 사진은 어디에도 저장·전송되지 않습니다.',
    recommendedGoods: [archetype.goods, HANJI_PRINT_GOODS],
  };

  const existingMuseumAuth = session.spotAuthentications?.jeonju_museum;
  const museumVerifiedAt = existingMuseumAuth?.verifiedAt ?? session.spotVerifiedAt?.jeonju_museum ?? nowIso;

  const nextSession: UserSessionState = {
    ...session,
    facePrivacyConsent: true,
    pastLifeResult: result,
    hasCompletedPastLife: true,
    currentScene: 10,
    currentSpotId: 'jeonju_museum',
    lastCompletedStep: 'past_life_generated',
    spotVerifiedAt: { ...(session.spotVerifiedAt ?? {}), jeonju_museum: museumVerifiedAt },
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
  persistSession(nextSession);
  return json(200, { session: nextSession, result });
}

function handleWallConsent(body: Record<string, unknown>): Response {
  const sessionId = typeof body.sessionId === 'string' ? body.sessionId : '';
  const session = findSessionById(sessionId);
  if (!session) return json(401, { error: '세션 인증이 필요합니다.' });
  if (!session.pastLifeResult) return json(404, { error: '완성된 전생 결과가 없습니다.' });

  const nowIso = new Date().toISOString();

  if (body.consent === 'declined') {
    saveWall(loadWall().filter((e) => e.sessionId !== sessionId));
    const next: UserSessionState = {
      ...session,
      mediaWallConsent: 'declined',
      mediaWallEntryId: null,
      currentScene: 11,
      lastCompletedStep: 'wall_decided',
      lastAccessedAt: nowIso,
      updatedAt: nowIso,
    };
    return json(200, { session: persistSession(next) });
  }

  // '다른 전생 확인하기'로 바꿔 본 경우까지 반영하려고, 전시는 화면에 고정된 현재 캐릭터 기준으로 만든다
  const character: Character = getOrPickCurrentCharacter();
  const entryId = session.mediaWallEntryId || `wall_${sessionId.slice(0, 12)}`;
  const alias = session.visitorName.trim() ? session.visitorName.trim().slice(0, 6) : '전주 여행자';
  const entry: WallEntry = {
    id: entryId,
    sessionId,
    visitorAlias: alias,
    title: character.title,
    hanjaTitle: '',
    era: session.pastLifeResult.era,
    oneLineSummary: character.quote,
    portraitDataUrl: character.imageUrl,
    publishedAt: nowIso,
    isDemoSeed: false,
  };
  saveWall([entry, ...loadWall().filter((e) => e.id !== entryId)]);

  const next: UserSessionState = {
    ...session,
    mediaWallConsent: 'accepted',
    mediaWallEntryId: entryId,
    currentScene: 11,
    lastCompletedStep: 'wall_decided',
    lastAccessedAt: nowIso,
    updatedAt: nowIso,
  };
  return json(200, { session: persistSession(next), entry });
}

function routeLocal(url: URL, init?: RequestInit): Response {
  const method = (init?.method ?? 'GET').toUpperCase();
  const path = url.pathname;
  const body = parseBody(init);

  if (path === '/api/config/map' && method === 'GET') {
    const id = ((import.meta.env?.VITE_NAVER_MAP_CLIENT_ID as string | undefined) ?? '').trim();
    return json(200, { naverMapClientId: id, configured: id.length > 0 });
  }

  if (path === '/api/auth/me' && method === 'GET') {
    const session = loadSession('experience');
    return json(200, session ? { authenticated: true, session } : { authenticated: false, session: null });
  }
  if (path === '/api/auth/register' && method === 'POST') return handleRegister(body);
  if (path === '/api/auth/recover' && method === 'POST') {
    return json(404, { error: '로컬 모드에서는 복구 코드를 사용할 수 없습니다. 같은 탭에서는 기록이 유지됩니다.' });
  }
  if (path === '/api/auth/logout' && method === 'POST') return json(200, { ok: true });

  if (path === '/api/past-life/generate' && method === 'POST') return handleGenerate(body);
  if (path === '/api/wall/consent' && method === 'POST') return handleWallConsent(body);
  if (path === '/api/wall' && method === 'GET') {
    const live = [...loadWall()].sort((a, b) => b.publishedAt.localeCompare(a.publishedAt));
    return json(200, { liveEntries: live, demoSeeds: DEMO_WALL_SEEDS });
  }

  const sessionMatch = path.match(/^\/api\/session\/([^/]+)(?:\/(.*))?$/);
  if (sessionMatch) {
    const sessionId = decodeURIComponent(sessionMatch[1]);
    const rest = sessionMatch[2] ?? '';
    if (rest === '' && method === 'GET') {
      const s = findSessionById(sessionId);
      return s ? json(200, { session: s }) : json(401, { error: '세션 인증이 필요합니다.', session: null });
    }
    if (rest === '' && method === 'PUT') return handleSessionPut(sessionId, body);
    if (rest === 'verify-qr' && method === 'POST') return handleVerifyQr(sessionId, body);
    if (rest === 'verify-spot' && method === 'POST') return handleVerifySpot(sessionId, body);
    if (rest === 'claim' && method === 'POST') return handleClaim(sessionId, body);
    if (rest === 'complete-all-stamps' && method === 'POST') return handleCompleteAllStamps(sessionId);
    const couponMatch = rest.match(/^coupons\/([^/]+)\/use$/);
    if (couponMatch && method === 'POST') return handleCouponUse(sessionId, decodeURIComponent(couponMatch[1]));
  }

  if (path.startsWith('/api/admin/')) {
    return json(503, { error: '로컬 모드에서는 관리자 통계를 사용할 수 없습니다.' });
  }

  return json(404, { error: '로컬 모드에서 지원하지 않는 요청입니다.' });
}

/**
 * `fetch` 대체 함수. USE_LOCAL_BACKEND 이면 서버 없이 로컬에서 처리하고, 아니면 실제 fetch 를 호출한다.
 */
export async function apiFetch(input: string, init?: RequestInit): Promise<Response> {
  if (!USE_LOCAL_BACKEND || !input.startsWith('/api/')) {
    return fetch(input, init);
  }
  try {
    return routeLocal(new URL(input, window.location.origin), init);
  } catch (err) {
    console.error('[localApi] unexpected error', err);
    return json(500, { error: '로컬 처리 중 오류가 발생했습니다. 새로고침 후 다시 시도해 주세요.' });
  }
}
