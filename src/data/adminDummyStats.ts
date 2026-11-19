/**
 * 운영자 대시보드(/admin) 발표·시연용 하드코딩 가상 누적 데이터.
 *
 * - 실제 운영 기록이 아니라 기획서의 기대 효과(관광객 분산·지역 소비)를 보여주기 위한 가상 수치다.
 * - 현재 브라우저에서 방금 체험한 기록은 `getAdminLiveSnapshot()` (localApi) 이 읽어 와
 *   이 수치에 +1 씩 합산한다. (대시보드의 '내 시연 기록 실시간 합산' 토글)
 * - 서로 모순되지 않도록 아래 합계 관계를 지켜서 수정할 것:
 *     · 쿠폰 4대 카테고리 사용 합계 / 발급 합계 = KPI 쿠폰 실사용률(41.5%)
 *     · 비식음료(숙박권+상품권) 발급 비중 = 46%
 *     · 박물관 도착(424명) / 기준 참여자(1,240명) = 34.2%
 *     · 캐릭터 배정 합계 = 박물관 도착(424명)
 */
import type { CouponCategory } from '../types/jeonju';

/** 기준 누적 참여자(한옥마을 QR 시작) */
export const ADMIN_BASE_PARTICIPANTS = 1240;

// ---------------------------------------------------------------------------------------------
// 1단: 4대 핵심 성과 지표 (발표용 고정 수치 — 실시간 합산 대상 아님)
// ---------------------------------------------------------------------------------------------
export interface AdminKpi {
  id: string;
  label: string;
  value: string;
  unit?: string;
  description: string;
}

export const ADMIN_KPIS: AdminKpi[] = [
  {
    id: 'dispersion',
    label: '원도심·박물관 분산 유입률',
    value: '68.4',
    unit: '%',
    description: '한옥마을 외 거점 이동률 · 박물관 유입 기존 3% → 34.2% 상승',
  },
  {
    id: 'completion',
    label: '4개 거점 일대기 완주율',
    value: '52.0',
    unit: '%',
    description: '평균 원도심 체류 시간 2시간 40분',
  },
  {
    id: 'coupon-use',
    label: '박물관 방면 쿠폰 실사용률',
    value: '41.5',
    unit: '%',
    description: '발급 쿠폰 중 제휴 상점 현장 사용 완료',
  },
  {
    id: 'satisfaction',
    label: '만족도 조사 & 아크릴 키링 지급',
    value: '4.8',
    unit: ' / 5.0점',
    description: '설문 응답률 79.0% · 키링 980개 증정 완료',
  },
];

// ---------------------------------------------------------------------------------------------
// 2단: 거점별 QR 인증 현황 / 이동 경로 퍼널
// ---------------------------------------------------------------------------------------------
export type AdminSpotKey =
  | 'hanok_village'
  | 'gyeonggijeon'
  | 'jeollagamyeong'
  | 'wanpanbon'
  | 'nambu_market'
  | 'jeonju_museum';

export interface AdminSpotVisit {
  key: AdminSpotKey;
  name: string;
  /** 부제 (출발 / 숨은 전생 등) */
  tag?: string;
  count: number;
}

export const ADMIN_SPOT_VISITS: AdminSpotVisit[] = [
  { key: 'hanok_village', name: '한옥마을', tag: '출발', count: 1240 },
  { key: 'gyeonggijeon', name: '경기전', count: 842 },
  { key: 'jeollagamyeong', name: '전라감영', count: 695 },
  { key: 'wanpanbon', name: '완판본문화관', count: 580 },
  { key: 'nambu_market', name: '남부시장', count: 648 },
  { key: 'jeonju_museum', name: '국립전주박물관', tag: '숨은 전생', count: 424 },
];

export interface AdminFunnelStep {
  step: number;
  title: string;
  percent: number;
}

export const ADMIN_FUNNEL: AdminFunnelStep[] = [
  { step: 1, title: '한옥마을 QR 시작', percent: 100 },
  { step: 2, title: '원도심 4대 거점 순회', percent: 68.4 },
  { step: 3, title: '박물관 방면 쿠폰 발급·사용', percent: 41.5 },
  { step: 4, title: '국립전주박물관 최종 도착', percent: 34.2 },
];

export const ADMIN_FUNNEL_INSIGHT = '박물관 방면 쿠폰 수령자의 74%가 실제 박물관 권역으로 이동';

// ---------------------------------------------------------------------------------------------
// 3단: 제휴 상점 쿠폰·소비 분산
// ---------------------------------------------------------------------------------------------
export interface AdminCouponCategoryStat {
  category: CouponCategory;
  issued: number;
  used: number;
}

/** 합계 발급 2,000건 / 사용 830건 (= 41.5%) */
export const ADMIN_COUPON_CATEGORY_STATS: AdminCouponCategoryStat[] = [
  { category: '카페', issued: 520, used: 240 },
  { category: '식당', issued: 560, used: 266 },
  { category: '숙박권', issued: 380, used: 126 },
  { category: '전주 지역 상품권', issued: 540, used: 198 },
];

/** 식음료(카페·식당)에 쏠려 있던 기존 소비 구조 */
export const ADMIN_FNB_SHARE_BEFORE = 60;
export const ADMIN_NON_FNB_CATEGORIES: CouponCategory[] = ['숙박권', '전주 지역 상품권'];

export interface AdminPartnerStore {
  /** coupons.ts 의 COUPON_TEMPLATES id — 내 시연 기록 합산 매칭용 */
  templateId: string;
  name: string;
  area: string;
  category: CouponCategory;
  issued: number;
  used: number;
}

export const ADMIN_PARTNER_STORES: AdminPartnerStore[] = [
  {
    templateId: 'cafe-1',
    name: '한옥창가 다실 (박물관길점)',
    area: '경기전~국립전주박물관 방면',
    category: '카페',
    issued: 214,
    used: 108,
  },
  {
    templateId: 'food-1',
    name: '전라감영 놋그릇비빔밥',
    area: '전라감영~국립전주박물관 방면',
    category: '식당',
    issued: 198,
    used: 97,
  },
  {
    templateId: 'voucher-1',
    name: '전주사랑 원도심 상생 상품권',
    area: '원도심 및 박물관 인근 제휴처',
    category: '전주 지역 상품권',
    issued: 176,
    used: 66,
  },
  {
    templateId: 'food-2',
    name: '남부시장 옛길 콩나물국밥',
    area: '남부시장~국립전주박물관 방면',
    category: '식당',
    issued: 168,
    used: 84,
  },
  {
    templateId: 'stay-1',
    name: '경기전 돌담길 고택 스테이',
    area: '원도심 한옥 숙박 제휴처',
    category: '숙박권',
    issued: 142,
    used: 49,
  },
];

// ---------------------------------------------------------------------------------------------
// 4단: 전생 캐릭터 10종 누적 배정 (합계 424 = 박물관 최종 도착자)
// ---------------------------------------------------------------------------------------------
export const ADMIN_CHARACTER_COUNTS: Record<string, number> = {
  '01': 43,
  '02': 40,
  '03': 36,
  '04': 48,
  '05': 43,
  '06': 33,
  '07': 47,
  '08': 42,
  '09': 34,
  '10': 58,
};

// ---------------------------------------------------------------------------------------------
// 5단: 만족도 키워드 / 미디어월 송출 대기·승인 목록
// ---------------------------------------------------------------------------------------------
export const ADMIN_POSITIVE_KEYWORDS: string[] = [
  '#박물관까지_자연스러운_동선',
  '#전생_캐릭터_음성_재밌음',
  '#쿠폰으로_국밥_할인',
  '#아이와_역사_공부',
];

export interface AdminWallQueueItem {
  id: string;
  alias: string;
  characterTitle: string;
  submittedLabel: string;
  approved: boolean;
}

export const ADMIN_WALL_QUEUE: AdminWallQueueItem[] = [
  { id: 'w1', alias: '한옥길 산책자', characterTitle: '마패를 숨긴 암행어사', submittedLabel: '오늘 14:32', approved: true },
  { id: 'w2', alias: '비빔밥 수집가', characterTitle: '수라간 반항아 숙수', submittedLabel: '오늘 14:05', approved: true },
  { id: 'w3', alias: '콩나물국밥 순례단', characterTitle: '수다쟁이 보부상', submittedLabel: '오늘 13:48', approved: false },
  { id: 'w4', alias: '박물관 지킴이', characterTitle: '빗속의 어진 수문장', submittedLabel: '오늘 13:20', approved: false },
  { id: 'w5', alias: '추임새 대장', characterTitle: '관객보다 추임새가 큰 소리꾼', submittedLabel: '오늘 12:51', approved: true },
];
