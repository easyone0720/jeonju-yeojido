import { INITIAL_DEMO_COUPONS, JEONJU_SPOTS, PAST_LIFE_ARCHETYPES } from '../data/jeonjuSpots.ts';
import { validateSpotQrCode } from '../data/qrAllowlist.ts';
import type {
  ArchetypeId,
  ClueCategory,
  ClueRecord,
  ClueSpotId,
  GeoCoordinates,
  PastLifeArchetype,
  SpotAuthRecord,
  SpotDefinition,
  SpotId,
  UserSessionState,
} from '../types/jeonju.ts';

const EARTH_RADIUS_METERS = 6371000;

export function getSpotById(spotId: SpotId): SpotDefinition {
  const found = JEONJU_SPOTS.find((spot) => spot.id === spotId);
  if (!found) {
    throw new Error(`Unknown spotId: ${spotId}`);
  }
  return found;
}

export function calculateDistanceMeters(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) *
      Math.cos(toRad(lat2)) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(EARTH_RADIUS_METERS * c);
}

export function verifySpotLocation(
  spotId: SpotId,
  coords: GeoCoordinates | null,
  mode: 'experience' | 'demo'
): { verified: boolean; distanceMeters: number | null; reason: string } {
  const spot = getSpotById(spotId);

  if (mode === 'demo') {
    return {
      verified: true,
      distanceMeters: 18,
      reason: '시연 모드 가상 GPS 인증이 완료되었습니다.',
    };
  }

  if (!coords || !Number.isFinite(coords.lat) || !Number.isFinite(coords.lng)) {
    return {
      verified: false,
      distanceMeters: null,
      reason: '현재 위치 좌표를 확인할 수 없습니다. 위치 권한과 GPS 수신 상태를 확인해 주세요.',
    };
  }

  const distance = calculateDistanceMeters(
    coords.lat,
    coords.lng,
    spot.coordinates.lat,
    spot.coordinates.lng
  );

  if (distance <= spot.verifyRadiusMeters) {
    return {
      verified: true,
      distanceMeters: distance,
      reason: `${spot.name} 반경 ${spot.verifyRadiusMeters}m 이내(약 ${distance}m) 도착이 확인되었습니다.`,
    };
  }

  return {
    verified: false,
    distanceMeters: distance,
    reason: `현재 위치가 ${spot.name}에서 약 ${distance.toLocaleString()}m 떨어져 있습니다. 현장(${spot.verifyRadiusMeters}m 이내)에서 다시 시도하거나 시연 모드로 체험해 보세요.`,
  };
}

export function parseSpotQrPayload(
  rawText: string,
  expectedSpotId?: SpotId
): {
  valid: boolean;
  spotId?: SpotId;
  canonicalQrUrl?: string;
  errorCode?: 'EMPTY_QR' | 'UNREGISTERED_QR' | 'WRONG_SPOT_QR';
  error?: string;
} {
  const result = validateSpotQrCode(rawText, expectedSpotId);
  return {
    valid: result.valid,
    spotId: result.matchedSpotId,
    canonicalQrUrl: result.canonicalQrUrl,
    errorCode: result.errorCode,
    error: result.error,
  };
}

export function validateBirthDate(birthDate: string): {
  valid: boolean;
  error?: string;
} {
  if (!birthDate || !/^\d{4}-\d{2}-\d{2}$/.test(birthDate)) {
    return { valid: false, error: '생년월일을 연도-월-일 형식으로 입력해 주세요.' };
  }
  const [yearStr, monthStr, dayStr] = birthDate.split('-');
  const year = Number(yearStr);
  const month = Number(monthStr);
  const day = Number(dayStr);
  const currentYear = new Date().getFullYear();

  if (year < 1910 || year > currentYear) {
    return {
      valid: false,
      error: `출생 연도는 1910년부터 ${currentYear}년 사이로 입력해 주세요.`,
    };
  }
  const testDate = new Date(year, month - 1, day);
  if (
    testDate.getFullYear() !== year ||
    testDate.getMonth() !== month - 1 ||
    testDate.getDate() !== day
  ) {
    return { valid: false, error: '존재하지 않는 날짜입니다. 다시 확인해 주세요.' };
  }
  return { valid: true };
}

function hashSeed(input: string): number {
  let hash = 2166136261;
  for (let i = 0; i < input.length; i += 1) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

const ARCHETYPE_ORDER: ArchetypeId[] = [
  'royal_inspector',
  'gamyeong_official',
  'woodblock_artisan',
  'market_merchant',
  'gate_guardian',
];

export function determinePastLifeArchetype(params: {
  birthDate: string;
  visitOrder: ClueSpotId[];
  sessionId: string;
}): PastLifeArchetype {
  const firstSpot = params.visitOrder[0] ?? 'gyeonggijeon';
  const seedKey = `${params.birthDate}|${firstSpot}|${params.sessionId.slice(0, 8)}`;
  const idx = hashSeed(seedKey) % ARCHETYPE_ORDER.length;
  const archetypeId = ARCHETYPE_ORDER[idx];
  return PAST_LIFE_ARCHETYPES[archetypeId];
}

export function buildClueForSpot(params: {
  spotId: ClueSpotId;
  archetype: PastLifeArchetype;
  spotPhotoCaptured?: boolean;
  nowIso?: string;
}): ClueRecord {
  const spot = getSpotById(params.spotId);
  const now = params.nowIso ?? new Date().toISOString();

  switch (params.spotId) {
    case 'gyeonggijeon':
      return {
        spotId: 'gyeonggijeon',
        category: 'era',
        label: '당신의 시대',
        value: params.archetype.era,
        detail: `${spot.clueConnectionText} 당신의 인연은 '${params.archetype.era}'와 맞닿아 있습니다.`,
        historicalNote: spot.historicalSummary,
        acquiredAt: now,
        spotPhotoCaptured: params.spotPhotoCaptured,
      };
    case 'jeollagamyeong':
      return {
        spotId: 'jeollagamyeong',
        category: 'status',
        label: '당신의 신분',
        value: `${params.archetype.title} (${params.archetype.hanjaTitle})`,
        detail: params.archetype.status,
        historicalNote: spot.historicalSummary,
        acquiredAt: now,
        spotPhotoCaptured: params.spotPhotoCaptured,
      };
    case 'wanpanbon':
      return {
        spotId: 'wanpanbon',
        category: 'story',
        label: '당신의 이야기',
        value: params.archetype.storySeed,
        detail: `완판본 책자 사이에서 발견된 기록: ${params.archetype.storySeed}.`,
        historicalNote: spot.historicalSummary,
        acquiredAt: now,
        spotPhotoCaptured: params.spotPhotoCaptured,
      };
    case 'nambu_market':
      return {
        spotId: 'nambu_market',
        category: 'item',
        label: '당신의 소지품',
        value: params.archetype.item,
        detail: `남부시장 저잣거리에서 되찾은 물건은 '${params.archetype.item}'입니다.`,
        historicalNote: spot.historicalSummary,
        acquiredAt: now,
        spotPhotoCaptured: params.spotPhotoCaptured,
      };
  }
}

export function createInitialSession(params: {
  sessionId: string;
  mode?: 'experience' | 'demo';
  visitorName?: string;
  birthDate?: string;
  companion?: 'alone' | 'together';
  nowIso?: string;
}): UserSessionState {
  const now = params.nowIso ?? new Date().toISOString();
  return {
    sessionId: params.sessionId,
    mode: params.mode ?? 'experience',
    visitorName: params.visitorName ?? '',
    birthDate: params.birthDate ?? '',
    companion: params.companion ?? 'alone',
    permissionsAcknowledged: {
      location: false,
      camera: false,
    },
    facePrivacyConsent: false,
    visitOrder: [],
    clues: {},
    coupons: INITIAL_DEMO_COUPONS.map((c) => ({ ...c })),
    pastLifeResult: null,
    mediaWallConsent: 'pending',
    mediaWallEntryId: null,
    currentScene: 3,
    currentSpotId: 'wanpanbon',
    lastCompletedStep: 'registered',
    spotVerifiedAt: {},
    spotAuthentications: {},
    hasCompletedPastLife: false,
    recoveryCodeIssued: params.mode !== 'demo',
    createdAt: now,
    lastAccessedAt: now,
    updatedAt: now,
  };
}

export function getCollectedClueCount(session: UserSessionState): number {
  const categories: ClueCategory[] = ['era', 'status', 'story', 'item'];
  return categories.filter((cat) => Boolean(session.clues[cat])).length;
}

export function isMuseumUnlocked(session: UserSessionState): boolean {
  return getCollectedClueCount(session) === 4;
}

export function isSpotVisitVerified(session: UserSessionState, spotId: SpotId): boolean {
  const auth = session.spotAuthentications?.[spotId];
  if (auth?.visitVerified) {
    return true;
  }
  if (spotId === 'jeonju_museum') {
    return Boolean(session.pastLifeResult || session.spotVerifiedAt?.jeonju_museum);
  }
  const spot = getSpotById(spotId);
  return Boolean(
    session.spotVerifiedAt?.[spotId] ||
      session.visitOrder.includes(spotId as ClueSpotId) ||
      (spot.clueCategory && session.clues[spot.clueCategory])
  );
}

export function isSpotClueOrPastLifeCompleted(
  session: UserSessionState,
  spotId: SpotId
): boolean {
  if (spotId === 'jeonju_museum') {
    return Boolean(session.pastLifeResult);
  }
  const spot = getSpotById(spotId);
  return Boolean(spot.clueCategory && session.clues[spot.clueCategory]);
}

export function recordSpotVisitAuthentication(
  session: UserSessionState,
  spotId: SpotId,
  nowIso = new Date().toISOString()
): { nextSession: UserSessionState; authRecord: SpotAuthRecord; alreadyVerified: boolean } {
  const existingAuth = session.spotAuthentications?.[spotId];
  if (existingAuth?.visitVerified || isSpotVisitVerified(session, spotId)) {
    const spot = getSpotById(spotId);
    const preserved: SpotAuthRecord = existingAuth ?? {
      spotId,
      spotName: spot.name,
      qrVerified: true,
      gpsVerified: true,
      visitVerified: true,
      clueAcquired: isSpotClueOrPastLifeCompleted(session, spotId),
      verifiedAt: session.spotVerifiedAt?.[spotId] ?? nowIso,
    };
    return {
      nextSession: session,
      authRecord: preserved,
      alreadyVerified: true,
    };
  }

  const spot = getSpotById(spotId);
  const authRecord: SpotAuthRecord = {
    spotId,
    spotName: spot.name,
    qrVerified: true,
    gpsVerified: true,
    visitVerified: true,
    clueAcquired: isSpotClueOrPastLifeCompleted(session, spotId),
    verifiedAt: nowIso,
  };

  const nextSession: UserSessionState = {
    ...session,
    currentSpotId: spotId,
    spotVerifiedAt: {
      ...(session.spotVerifiedAt ?? {}),
      [spotId]: nowIso,
    },
    spotAuthentications: {
      ...(session.spotAuthentications ?? {}),
      [spotId]: authRecord,
    },
    lastAccessedAt: nowIso,
    updatedAt: nowIso,
  };

  return {
    nextSession,
    authRecord,
    alreadyVerified: false,
  };
}

export function claimSpotClueAndCoupon(
  session: UserSessionState,
  spotId: ClueSpotId,
  options?: { spotPhotoCaptured?: boolean; nowIso?: string }
): {
  nextSession: UserSessionState;
  claimedClue: ClueRecord;
  alreadyClaimed: boolean;
} {
  const nowIso = options?.nowIso ?? new Date().toISOString();
  const spot = getSpotById(spotId);
  const category = spot.clueCategory!;
  const existingClue = session.clues[category];

  if (existingClue) {
    return {
      nextSession: session,
      claimedClue: existingClue,
      alreadyClaimed: true,
    };
  }

  const nextVisitOrder = session.visitOrder.includes(spotId)
    ? session.visitOrder
    : [...session.visitOrder, spotId];

  // Determine archetype deterministically from first visit + birthdate + sessionId
  const archetype = determinePastLifeArchetype({
    birthDate: session.birthDate || '1998-05-15',
    visitOrder: nextVisitOrder,
    sessionId: session.sessionId,
  });

  const newClue = buildClueForSpot({
    spotId,
    archetype,
    spotPhotoCaptured: options?.spotPhotoCaptured,
    nowIso,
  });

  const nextCoupons = session.coupons.map((coupon) =>
    coupon.spotId === spotId
      ? { ...coupon, unlocked: true, unlockedAt: coupon.unlockedAt ?? nowIso }
      : coupon
  );

  const nextClues = {
    ...session.clues,
    [category]: newClue,
  };
  const collectedAfter = (['era', 'status', 'story', 'item'] as ClueCategory[]).filter(
    (cat) => Boolean(nextClues[cat])
  ).length;

  const existingAuth = session.spotAuthentications?.[spotId];
  const verifiedAt = existingAuth?.verifiedAt ?? session.spotVerifiedAt?.[spotId] ?? nowIso;

  const nextSession: UserSessionState = {
    ...session,
    visitOrder: nextVisitOrder,
    clues: nextClues,
    coupons: nextCoupons,
    currentSpotId: spotId,
    currentScene: 8,
    lastCompletedStep: collectedAfter === 4 ? 'all_clues_collected' : 'exploring',
    spotVerifiedAt: {
      ...(session.spotVerifiedAt ?? {}),
      [spotId]: verifiedAt,
    },
    spotAuthentications: {
      ...(session.spotAuthentications ?? {}),
      [spotId]: {
        spotId,
        spotName: spot.name,
        qrVerified: true,
        gpsVerified: true,
        visitVerified: true,
        clueAcquired: true,
        verifiedAt,
      },
    },
    lastAccessedAt: nowIso,
    updatedAt: nowIso,
  };

  return {
    nextSession,
    claimedClue: newClue,
    alreadyClaimed: false,
  };
}

export function toggleCouponUsedState(
  session: UserSessionState,
  couponId: string,
  nowIso = new Date().toISOString()
): UserSessionState {
  return {
    ...session,
    coupons: session.coupons.map((coupon) => {
      if (coupon.id !== couponId || !coupon.unlocked || coupon.used) {
        return coupon;
      }
      return {
        ...coupon,
        used: true,
        usedAt: nowIso,
      };
    }),
    updatedAt: nowIso,
    lastAccessedAt: nowIso,
  };
}

export function getResumeNavigationState(session: UserSessionState): {
  scene: 3 | 4 | 5 | 9 | 10 | 11;
  homeTab: 'map' | 'clues' | 'coupons';
  selectedSpotId: SpotId;
  stepSummary: string;
} {
  const clueCount = getCollectedClueCount(session);

  if (session.pastLifeResult) {
    if (session.currentScene === 11) {
      return {
        scene: 11,
        homeTab: 'map',
        selectedSpotId: 'jeonju_museum',
        stepSummary: '미디어월 전시 선택 단계',
      };
    }
    if (session.currentScene === 10 || session.mediaWallConsent === 'pending') {
      return {
        scene: 10,
        homeTab: 'map',
        selectedSpotId: 'jeonju_museum',
        stepSummary: `전생 결과 완성 (${session.pastLifeResult.title})`,
      };
    }
  }

  if (clueCount === 4 && !session.pastLifeResult && session.currentScene === 9) {
    return {
      scene: 9,
      homeTab: 'map',
      selectedSpotId: 'jeonju_museum',
      stepSummary: '국립전주박물관 전생 결과 확인 대기 (4 / 4)',
    };
  }

  const savedTab =
    session.currentScene === 4
      ? 'clues'
      : session.currentScene === 5
        ? 'coupons'
        : 'map';

  const fallbackSpot: SpotId =
    clueCount === 4
      ? 'jeonju_museum'
      : (JEONJU_SPOTS.find(
          (s) => s.id !== 'jeonju_museum' && !session.visitOrder.includes(s.id as ClueSpotId)
        )?.id ?? 'wanpanbon');

  // 아직 아무 거점도 방문하지 않았다면(처음 진입·초기화) 항상 1번 완판본문화관부터 시작한다.
  const selectedSpotId: SpotId =
    session.visitOrder.length === 0 && !session.pastLifeResult
      ? 'wanpanbon'
      : (session.currentSpotId ?? fallbackSpot);
  const selectedSpotName =
    JEONJU_SPOTS.find((s) => s.id === selectedSpotId)?.name ?? '전주 여지도';
  const tabScene = savedTab === 'clues' ? 4 : savedTab === 'coupons' ? 5 : 3;

  return {
    scene: tabScene,
    homeTab: savedTab,
    selectedSpotId,
    stepSummary:
      clueCount === 4
        ? '조각 4/4 완료 · 박물관 이동 단계'
        : savedTab === 'clues'
          ? `내 조각 보관함 (${selectedSpotName})`
          : savedTab === 'coupons'
            ? '제휴 쿠폰함'
            : `${selectedSpotName} 탐색 중`,
  };
}
