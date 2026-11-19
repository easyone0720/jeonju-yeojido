import { useState } from 'react';
import { JEONJU_SPOTS } from '../data/jeonjuSpots';
import { ClueRecord, CouponRecord } from '../types/jeonju';
import { CouponCategoryBadge } from './CouponCategoryBadge';

interface SceneClueRevealProps {
  clue: ClueRecord;
  coupon: CouponRecord | undefined;
  collectedCount: number;
  alreadyClaimed: boolean;
  onGoToMap: () => void;
  onGoToCoupons: () => void;
  onGoToMuseumFace: () => void;
}

export function SceneClueReveal({
  clue,
  coupon,
  collectedCount,
  alreadyClaimed,
  onGoToMap,
  onGoToCoupons,
  onGoToMuseumFace,
}: SceneClueRevealProps) {
  const [couponReceived, setCouponReceived] = useState(false);
  const spot = JEONJU_SPOTS.find((s) => s.id === clue.spotId) ?? JEONJU_SPOTS[0];
  const allCollected = collectedCount >= 4;

  const handleReceiveCoupon = () => {
    setCouponReceived(true);
    if (allCollected) {
      onGoToMuseumFace();
    } else {
      onGoToMap();
    }
  };

  return (
    <div className="min-h-app hanji-texture flex flex-col pb-28">
      <main className="flex-1 mx-auto w-full max-w-md sm:max-w-lg px-5 py-6 sm:py-10 flex flex-col justify-between gap-6">
        {/* Top Badge: 조각 N matching Scene 8 wireframe */}
        <div className="flex items-center justify-between">
          <span className="inline-flex items-center px-3.5 py-1.5 rounded-lg border border-[#D6CEBE] bg-white font-serif-kr text-sm font-bold text-[#1C1917]">
            조각 {spot.orderNumber}
          </span>
          <span className="font-mono-tabular text-xs font-semibold text-[#78716C]">
            {collectedCount} / 4
          </span>
        </div>

        {/* Center: Unfurling Scroll Animation matching Scene 8 wireframe */}
        <div className="space-y-3 my-auto">
          {alreadyClaimed && (
            <p className="text-xs text-[#78716C] text-center">
              이미 획득한 조각입니다. 두루마리를 다시 펼쳐 확인합니다.
            </p>
          )}

          {/* Horizontal Scroll with left/right wooden rods matching wireframe */}
          <div className="relative flex items-stretch justify-center">
            <div className="w-3.5 rounded-full bg-gradient-to-r from-[#5C4428] to-[#8C6D46] border border-[#44311B] shrink-0 shadow-sm" />

            <div className="animate-scroll-unfurl flex-1 bg-[#FBF5E8] border-y-2 border-[#C7B596] px-5 sm:px-7 py-8 sm:py-10 text-center space-y-4 shadow-md">
              <p className="text-xs font-medium text-[#9A3412]">
                {spot.name} · {clue.label}
              </p>

              <p className="text-sm text-[#57534E]">{spot.clueQuestion}...</p>

              <h1 className="font-serif-kr text-2xl sm:text-3xl font-bold text-[#1C1917] leading-snug">
                {clue.value}
              </h1>

              <p className="text-sm text-[#44403C] leading-relaxed">
                {clue.detail}
              </p>

              <p className="text-xs text-[#57534E] pt-2 border-t border-[#E5D8BE]">
                다음 힌트: {allCollected ? '모든 조각을 모았습니다. 국립전주박물관으로 향하시오.' : spot.nextHint}
              </p>
            </div>

            <div className="w-3.5 rounded-full bg-gradient-to-l from-[#5C4428] to-[#8C6D46] border border-[#44311B] shrink-0 shadow-sm" />
          </div>
        </div>

        {/* Bottom: (쿠폰) + 받기 button matching Scene 8 wireframe */}
        <div className="space-y-3 pb-4 safe-pb">
          {coupon && (
            <div className="rounded-2xl border border-[#D6CEBE] bg-white p-4 flex items-center justify-between gap-3 shadow-sm">
              <div className="min-w-0">
                <p className="flex items-center gap-1.5 text-xs font-semibold text-[#9A3412]">
                  <CouponCategoryBadge category={coupon.category} />
                  <span>쿠폰 · 시연용</span>
                </p>
                <p className="font-serif-kr text-sm sm:text-base font-bold text-[#1C1917] truncate">
                  {coupon.title}
                </p>
                <p className="text-xs text-[#57534E] truncate">{coupon.benefit}</p>
                {coupon.locationHint && (
                  <p className="text-[11px] text-[#78716C] truncate">{coupon.locationHint}</p>
                )}
              </div>
              <button
                type="button"
                onClick={handleReceiveCoupon}
                className="min-h-[44px] px-5 py-2 rounded-xl bg-[#9A3412] text-white text-sm font-semibold hover:bg-[#7C2D12] whitespace-nowrap shrink-0"
              >
                {couponReceived ? '완료' : '받기'}
              </button>
            </div>
          )}

          <div className="flex items-center justify-between gap-3 text-xs">
            <button
              type="button"
              onClick={onGoToCoupons}
              className="min-h-[40px] px-2 text-[#57534E] hover:text-[#1C1917] underline underline-offset-4"
            >
              쿠폰함에서 보기
            </button>
            <button
              type="button"
              onClick={allCollected ? onGoToMuseumFace : onGoToMap}
              className="min-h-[44px] px-4 py-2 rounded-xl border border-[#D6CEBE] bg-white font-semibold text-[#1C1917] hover:bg-[#F5EFE6]"
            >
              {allCollected ? '국립전주박물관 전생 완성하기' : '지도로 돌아가기'}
            </button>
          </div>
        </div>
      </main>
    </div>
  );
}
