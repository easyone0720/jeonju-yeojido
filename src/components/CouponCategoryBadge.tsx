import type { CouponCategory } from '../types/jeonju';

const BADGE_STYLES: Record<CouponCategory, { bg: string; fg: string; border: string }> = {
  카페: { bg: '#FEF3C7', fg: '#92400E', border: '#FCD34D' },
  식당: { bg: '#FFE4E6', fg: '#BE123C', border: '#FDA4AF' },
  숙박권: { bg: '#E0E7FF', fg: '#3730A3', border: '#A5B4FC' },
  '전주 지역 상품권': { bg: '#DCFCE7', fg: '#166534', border: '#86EFAC' },
};

interface CouponCategoryBadgeProps {
  category: CouponCategory;
  className?: string;
}

/** 쿠폰 카테고리(카페/식당/숙박권/전주 지역 상품권)를 색으로 구분해 보여주는 배지. */
export function CouponCategoryBadge({ category, className = '' }: CouponCategoryBadgeProps) {
  const s = BADGE_STYLES[category];
  return (
    <span
      data-testid="coupon-category-badge"
      className={`inline-flex items-center px-2 py-0.5 rounded-md border text-[11px] font-bold whitespace-nowrap ${className}`}
      style={{ backgroundColor: s.bg, color: s.fg, borderColor: s.border }}
    >
      {category}
    </span>
  );
}
