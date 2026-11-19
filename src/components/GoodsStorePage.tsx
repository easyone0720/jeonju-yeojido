import { Lock, X } from 'lucide-react';
import { formatWon, GOODS, type GoodsItem } from '../data/goods';

interface GoodsStorePageProps {
  /** 결과 화면(SceneResult)으로 돌아간다 */
  onClose: () => void;
  /** 굿즈 이미지를 누르면 해당 굿즈가 담긴 결제창으로 이동한다 */
  onSelectGoods: (item: GoodsItem) => void;
  /** 하단 내비게이션 위에 표시되는 경우 하단 여백을 넉넉히 둔다 */
  withBottomNav?: boolean;
  /** 도장 4개 미만: 목록을 블러 처리하고 잠금 안내 카드를 띄운다 */
  locked?: boolean;
  /** 현재 모은 도장 수 (잠금 안내 배지용) */
  visitedCount?: number;
  /** 잠금 카드의 `지도로 돌아가 도장 모으기` */
  onGoToMap?: () => void;
}

export function GoodsStorePage({
  onClose,
  onSelectGoods,
  withBottomNav = false,
  locked = false,
  visitedCount = 0,
  onGoToMap,
}: GoodsStorePageProps) {
  return (
    <div className="min-h-app hanji-texture">
      <div className="w-full max-w-[430px] mx-auto min-h-app flex flex-col">
        <header className="sticky top-0 z-30 flex items-center justify-between gap-3 border-b border-[#E5DDD0] bg-[#FBF8F2]/95 backdrop-blur-md px-4 h-14">
          <div className="min-w-0">
            <h1 className="font-serif-kr text-base font-bold text-[#1C1917] truncate">
              전생여지도 기념품 굿즈 스토어
            </h1>
            <p className="text-[11px] text-[#78716C]">나의 전생을 담은 기념품 14종</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="굿즈 스토어 닫기"
            className="shrink-0 min-w-[44px] min-h-[44px] flex items-center justify-center rounded-lg text-[#57534E] hover:bg-[#EFE8DC] hover:text-[#1C1917]"
          >
            <X className="w-5 h-5" aria-hidden="true" />
          </button>
        </header>

        <main
          aria-hidden={locked || undefined}
          className={`flex-1 px-4 py-4 space-y-4 safe-pb ${withBottomNav ? 'pb-24' : 'pb-10'} ${
            locked
              ? 'blur-md pointer-events-none select-none opacity-65 max-h-[calc(100dvh-3.5rem)] overflow-hidden'
              : ''
          }`}
        >
          {GOODS.map((item) => (
            <article
              key={item.id}
              className="rounded-2xl border border-[#D6CEBE] bg-white overflow-hidden shadow-sm"
            >
              <button
                type="button"
                onClick={() => onSelectGoods(item)}
                aria-label={`${item.name} 결제하기`}
                className="relative block w-full aspect-video bg-[#EFE5D0] group"
              >
                <img
                  src={item.imageUrl}
                  alt={item.name}
                  loading="lazy"
                  className="w-full h-full object-cover block"
                />
                <span className="absolute top-2 right-2 rounded-full bg-[#1C1917]/55 px-2.5 py-1 text-[11px] font-medium text-white backdrop-blur-sm">
                  클릭하여 결제
                </span>
              </button>

              <div className="border-t border-[#E5DDD0]" aria-hidden="true" />

              <div className="flex items-end justify-between gap-3 p-3.5">
                <div className="min-w-0 flex-1">
                  <h2 className="text-sm font-bold text-[#1C1917] leading-snug">{item.name}</h2>
                  <p className="mt-1 text-xs text-[#57534E] leading-relaxed line-clamp-1">
                    {item.desc}
                  </p>
                </div>
                <span className="shrink-0 self-end rounded-lg border border-[#C7B596] bg-[#FBF8F2] px-3 py-1.5 text-sm font-bold text-[#9A3412] font-mono-tabular">
                  {formatWon(item.price)}
                </span>
              </div>
            </article>
          ))}
        </main>
      </div>

      {locked && (
        <div
          role="dialog"
          aria-label="기념품 잠금 안내"
          className={`fixed inset-0 flex items-center justify-center p-6 z-20 ${
            withBottomNav ? 'pb-24' : ''
          }`}
        >
          <div className="w-full max-w-sm rounded-2xl border border-[#C9C1B1] bg-[#EEE9DF]/95 shadow-xl px-6 py-7 text-center space-y-4">
            <span className="mx-auto w-11 h-11 rounded-full bg-[#1B2632] text-[#EEE9DF] flex items-center justify-center">
              <Lock className="w-5 h-5" aria-hidden="true" />
            </span>
            <h2 className="text-[clamp(1.05rem,3.2vw,1.4rem)] font-bold text-[#1B2632] leading-snug">
              아직 전생의 연이 닿지 않았소
            </h2>
            <p className="text-[clamp(0.82rem,2.2vw,0.98rem)] text-[#2C3B4D] leading-relaxed">
              네 곳의 전생 도장을 모두 모아야 기념품 방의 빗장이 열리옵니다.
            </p>
            <span className="inline-block rounded-md bg-[#A35139] text-[#EEE9DF] px-3 py-1 text-xs font-medium">
              현재 모은 도장: {visitedCount} / 4개
            </span>
            {onGoToMap && (
              <button
                type="button"
                onClick={onGoToMap}
                className="block w-full min-h-[48px] px-5 py-3 rounded-xl bg-[#1B2632] text-[#EEE9DF] font-semibold text-sm hover:bg-[#2C3B4D] transition-colors"
              >
                지도로 돌아가 도장 모으기
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
