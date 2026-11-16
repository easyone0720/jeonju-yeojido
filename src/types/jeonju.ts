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

export interface CouponRecord {
  id: string;
  spotId: ClueSpotId;
  category: '음식점' | '카페' | '전통체험' | '숙박';
  title: string;
  partnerArea: string;
  benefit: string;
  condition: string;
  expiresLabel: string;
  isDemoCoupon: boolean;
  unlocked: boolean;
  unlockedAt?: string;
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
  portraitDataUrl: string;
  generatedAt: string;
  generationSource: 'gemini-ai' | 'curated-demo';
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
