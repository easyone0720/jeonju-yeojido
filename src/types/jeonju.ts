export type ClueSpotId =
  | 'gyeonggijeon'
  | 'jeollagamyeong'
  | 'wanpanbon'
  | 'nambu_market';

export type SpotId = ClueSpotId | 'jeonju_museum';

export type ClueCategory = 'era' | 'status' | 'story' | 'item';

export type AppMode = 'experience' | 'demo';

export type CompanionType = 'alone' | 'together';

export type SceneId = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11;

export type HomeTab = 'map' | 'clues' | 'coupons';

export type ArchetypeId =
  | 'royal_inspector'
  | 'gamyeong_official'
  | 'woodblock_artisan'
  | 'market_merchant'
  | 'gate_guardian';

export interface GeoCoordinates {
  lat: number;
  lng: number;
  accuracy?: number;
}

export interface SpotDefinition {
  id: SpotId;
  orderNumber: number;
  name: string;
  hanjaName: string;
  address: string;
  coordinates: GeoCoordinates;
  verifyRadiusMeters: number;
  clueCategory?: ClueCategory;
  clueQuestion?: string;
  shortSubtitle: string;
  historicalSummary: string;
  historicalStory: string;
  clueConnectionText: string;
  nextHint: string;
  mapPositionPercent: { x: number; y: number };
  qrCodeValue: string;
}

export interface ClueRecord {
  spotId: ClueSpotId;
  category: ClueCategory;
  label: string;
  value: string;
  detail: string;
  historicalNote: string;
  acquiredAt: string;
  spotPhotoCaptured?: boolean;
}

/** 쿠폰 4대 카테고리 (운영자 대시보드 소비 분산 지표용) */
export type CouponCategory = '카페' | '식당' | '숙박권' | '전주 지역 상품권';

export interface CouponRecord {
  id: string;
  spotId: ClueSpotId;
  category: CouponCategory;
  /** 발급된 쿠폰 템플릿 id (예: 'cafe-1'). 랜덤 발급 전(잠금 상태)에는 없다 */
  templateId?: string;
  /** 위치 안내 (예: '경기전~국립전주박물관 방면') */
  locationHint?: string;
  title: string;
  partnerArea: string;
  benefit: string;
  condition: string;
  expiresLabel: string;
  isDemoCoupon: boolean;
  unlocked: boolean;
  unlockedAt?: string;
  /** 발급 시 계산되는 유효기간 (ISO). 없으면 expiresLabel 안내 문구를 쓴다 */
  expiresAt?: string;
  /** 발급 시 생성되는 바코드 번호 (시연용은 JSYJ-DEMO-… 형식) */
  barcodeNumber?: string;
  used: boolean;
  usedAt?: string;
}

export interface GoodsItem {
  id: string;
  archetypeId: ArchetypeId | 'all';
  name: string;
  subtitle: string;
  description: string;
  priceLabel: string;
  isDemoGoods: boolean;
}

export interface PastLifeArchetype {
  id: ArchetypeId;
  title: string;
  hanjaTitle: string;
  era: string;
  status: string;
  storySeed: string;
  item: string;
  attireStyle: 'official_robe' | 'scholar_gat' | 'artisan_vest' | 'merchant_coat' | 'guard_armor';
  primarySealText: string;
  goods: GoodsItem;
}

/** 그날의 대화 한 줄. speaker가 빈 문자열이면 지문(괄호 연출)으로 렌더링한다. */
export interface StoryDialogueLine {
  speaker: string;
  text: string;
}

/** 결과 화면의 4개 섹션(전생 설정 / 그날의 대화 / 전생 결과 / 인생 마무리) 본문 */
export interface PastLifeStory {
  /** 전생 직업 타이틀 (예: 몰락 직전 양반가 주막 사장) */
  jobTitle: string;
  /** 📜 전생 설정 */
  setting: string;
  /** 🎬 그날의 대화 */
  dialogue: StoryDialogueLine[];
  /** 🏆 전생 결과 */
  outcome: {
    job: string;
    reputation: string;
    achievement: string;
  };
  /** ⚰️ 인생 마무리 */
  ending: string;
}

export interface PastLifeResult {
  sessionId: string;
  archetypeId: ArchetypeId;
  title: string;
  hanjaTitle: string;
  era: string;
  status: string;
  storyTitle: string;
  item: string;
  oneLineSummary: string;
  biography: string;
  clueSynthesisNote: string;
  /** charactersData.json 의 id. 이미지·음성·스토리는 이 id 로 조회한다. */
  characterId?: string;
  portraitDataUrl: string;
  generatedAt: string;
  generationSource: 'gemini-ai' | 'curated-demo';
  /** 4개 섹션 구조의 전생 스토리. 이 필드가 없는 이전 기록은 기본 샘플로 표시한다. */
  story?: PastLifeStory;
  /** 초상 이미지 출처: Gemini 이미지 모델 / 브라우저 캔버스 전통 초상화(폴백) */
  portraitSource?: 'gemini-image' | 'canvas-painter';
  historicalDisclaimer: string;
  recommendedGoods: GoodsItem[];
}

export type ProgressMilestone =
  | 'registered'
  | 'exploring'
  | 'all_clues_collected'
  | 'past_life_generated'
  | 'wall_decided';

export interface SpotAuthRecord {
  spotId: SpotId;
  spotName: string;
  qrVerified: boolean;
  gpsVerified: boolean;
  visitVerified: boolean;
  clueAcquired: boolean;
  verifiedAt: string;
}

export interface UserSessionState {
  sessionId: string;
  mode: AppMode;
  visitorName: string;
  birthDate: string;
  companion: CompanionType;
  permissionsAcknowledged: {
    location: boolean;
    camera: boolean;
  };
  facePrivacyConsent: boolean;
  visitOrder: ClueSpotId[];
  clues: Partial<Record<ClueCategory, ClueRecord>>;
  coupons: CouponRecord[];
  pastLifeResult: PastLifeResult | null;
  mediaWallConsent: 'pending' | 'accepted' | 'declined';
  mediaWallEntryId: string | null;
  currentScene?: SceneId;
  currentSpotId?: SpotId;
  lastCompletedStep?: ProgressMilestone;
  spotVerifiedAt?: Partial<Record<SpotId, string>>;
  spotAuthentications?: Partial<Record<SpotId, SpotAuthRecord>>;
  hasCompletedPastLife?: boolean;
  recoveryCodeIssued?: boolean;
  createdAt?: string;
  lastAccessedAt?: string;
  updatedAt: string;
}

export interface WallEntry {
  id: string;
  sessionId: string;
  visitorAlias: string;
  title: string;
  hanjaTitle: string;
  era: string;
  oneLineSummary: string;
  /** charactersData.json 의 id (있으면 이미지는 이 id 로 조회) */
  characterId?: string;
  portraitDataUrl: string;
  publishedAt: string;
  isDemoSeed: boolean;
}

export interface AdminDashboardStats {
  totalVisitors: {
    liveCount: number;
    demoBaseline: number;
  };
  spotVisits: Array<{
    spotId: SpotId;
    name: string;
    liveCount: number;
    demoBaseline: number;
  }>;
  clueCompletionCount: {
    liveCount: number;
    demoBaseline: number;
  };
  coupons: {
    issuedLive: number;
    usedLive: number;
    issuedDemoBaseline: number;
    usedDemoBaseline: number;
  };
  pastLifeGenerated: {
    liveCount: number;
    demoBaseline: number;
  };
  mediaWallCount: {
    liveCount: number;
    demoBaseline: number;
  };
  recentSessions: Array<{
    sessionId: string;
    visitorName: string;
    mode: AppMode;
    cluesCount: number;
    archetypeTitle: string | null;
    mediaWallConsent: 'pending' | 'accepted' | 'declined';
    updatedAt: string;
  }>;
}
