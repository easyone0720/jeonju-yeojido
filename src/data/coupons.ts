/**
 * 쿠폰 마스터 데이터: 4대 카테고리 × 각 3종 = 12종.
 * - 실제 상호가 아닌 '제휴 예정 모델'이며, 원도심 거점 → 국립전주박물관 방면 상권 유도 콘셉트다.
 * - 거점 QR 인증으로 쿠폰이 열릴 때 localApi 가 `pickCouponTemplate()` 로 이 중 1종을 무작위 발급한다.
 */
import type { CouponCategory } from '../types/jeonju';

export interface CouponTemplate {
  id: string;
  category: CouponCategory;
  /** 매장(또는 상품권)명 — 제휴 예정 모델 */
  storeName: string;
  /** 혜택 */
  benefit: string;
  /** 위치 안내 */
  locationHint: string;
}

export const COUPON_CATEGORIES: CouponCategory[] = ['카페', '식당', '숙박권', '전주 지역 상품권'];

export const COUPON_TEMPLATES: CouponTemplate[] = [
  // 카페
  {
    id: 'cafe-1',
    category: '카페',
    storeName: '한옥창가 다실 (박물관길점)',
    benefit: '전통 쌍화차·아메리카노 20% 할인권',
    locationHint: '경기전~국립전주박물관 방면',
  },
  {
    id: 'cafe-2',
    category: '카페',
    storeName: '완산 서재 로스터리',
    benefit: '수제 한과 디저트 세트 3,000원 할인권',
    locationHint: '전라감영~국립전주박물관 방면',
  },
  {
    id: 'cafe-3',
    category: '카페',
    storeName: '전주천변 연꽃다방',
    benefit: '전생 체험자 전용 음료 1+1 이용권',
    locationHint: '남부시장~국립전주박물관 방면',
  },
  // 식당
  {
    id: 'food-1',
    category: '식당',
    storeName: '전라감영 놋그릇비빔밥',
    benefit: '전주 전통 비빔밥 정식 15% 할인권',
    locationHint: '전라감영~국립전주박물관 방면',
  },
  {
    id: 'food-2',
    category: '식당',
    storeName: '남부시장 옛길 콩나물국밥',
    benefit: '모주 1잔 무료 및 국밥 2,000원 할인권',
    locationHint: '남부시장~국립전주박물관 방면',
  },
  {
    id: 'food-3',
    category: '식당',
    storeName: '효자동 반상 한정식',
    benefit: '2인 이상 식사 시 5,000원 할인권',
    locationHint: '국립전주박물관 인근 권역',
  },
  // 숙박권
  {
    id: 'stay-1',
    category: '숙박권',
    storeName: '경기전 돌담길 고택 스테이',
    benefit: '평일 한옥 숙박 20,000원 할인권',
    locationHint: '원도심 한옥 숙박 제휴처',
  },
  {
    id: 'stay-2',
    category: '숙박권',
    storeName: '완산칠봉 자락 한옥 게스트하우스',
    benefit: '1박 예약 시 조식 무료 + 15,000원 할인권',
    locationHint: '완산구·박물관 권역 제휴처',
  },
  {
    id: 'stay-3',
    category: '숙박권',
    storeName: '전주천 야경 부티크 한옥호텔',
    benefit: '레이트 체크아웃(13시) + 숙박 10% 할인권',
    locationHint: '전주천변 제휴 숙박처',
  },
  // 전주 지역 상품권
  {
    id: 'voucher-1',
    category: '전주 지역 상품권',
    storeName: '전주사랑 원도심 상생 상품권 (5,000원권)',
    benefit: '완산구·박물관 권역 제휴 가맹점 통합 사용',
    locationHint: '원도심 및 박물관 인근 제휴처',
  },
  {
    id: 'voucher-2',
    category: '전주 지역 상품권',
    storeName: '전주사랑 전통공예·기념품 전용권 (5,000원권)',
    benefit: '원도심 공방·소품샵 전용 5,000원 결제권',
    locationHint: '완판본문화관·원도심 공방 거리',
  },
  {
    id: 'voucher-3',
    category: '전주 지역 상품권',
    storeName: '전주사랑 문화·여가 패스 상품권 (10,000원권)',
    benefit: '제휴 체험·문화시설 2만 원 이상 결제 시 사용',
    locationHint: '전주시 원도심 문화 제휴처',
  },
];

function pickOne<T>(items: T[], rng: () => number): T {
  return items[Math.min(items.length - 1, Math.floor(rng() * items.length))];
}

/**
 * 쿠폰 1종을 무작위로 뽑는다.
 * 1) 4개 카테고리 중 1개를 균등 확률로 고르고, 2) 그 안의 3종 중 1개를 무작위로 고른다.
 * 이미 보유 중인 템플릿 id(`heldTemplateIds`)는 피한다: 카테고리 안의 3종을 모두 보유 중이면
 * 아직 보유하지 않은 템플릿이 남은 카테고리 중에서 다시 균등하게 고른다(보유 쿠폰은 최대 4장이라 항상 가능).
 */
export function pickCouponTemplate(
  heldTemplateIds: readonly string[] = [],
  rng: () => number = Math.random
): CouponTemplate {
  const held = new Set(heldTemplateIds);
  // 한 사용자의 쿠폰은 카테고리가 겹치지 않게: 이미 쿠폰을 가진 카테고리는 먼저 제외한다
  const heldCategories = new Set(COUPON_TEMPLATES.filter((t) => held.has(t.id)).map((t) => t.category));
  const hasFresh = (cat: CouponCategory) => COUPON_TEMPLATES.some((t) => t.category === cat && !held.has(t.id));
  const unused = COUPON_CATEGORIES.filter((cat) => !heldCategories.has(cat) && hasFresh(cat));
  // 4개 카테고리를 모두 한 번씩 받은 뒤(5번째 이후)에만 이미 받은 카테고리에서 다시 뽑는다
  const available = unused.length > 0 ? unused : COUPON_CATEGORIES.filter(hasFresh);
  const pool = available.length > 0 ? available : COUPON_CATEGORIES;
  const category = pickOne(pool, rng);
  const inCategory = COUPON_TEMPLATES.filter((t) => t.category === category);
  const fresh = inCategory.filter((t) => !held.has(t.id));
  return pickOne(fresh.length > 0 ? fresh : inCategory, rng);
}
