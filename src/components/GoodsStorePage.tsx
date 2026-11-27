import { Lock, X } from 'lucide-react';
import { formatWon, GOODS, type GoodsItem } from '../data/goods';

interface GoodsStorePageProps {
  /** X 버튼: 지도 탭으로 돌아간다 */
  onClose: () => void;
  /** 굿즈 이미지를 누르면 해당 굿즈가 담긴 결제창으로 이동한다 */
  onSelectGoods: (item: GoodsItem) => void;
  /** 하단 내비게이션 위에 표시되는 경우 팝업이 내비에 가리지 않도록 하단 여백을 둔다 */
  withBottomNav?: boolean;
  /** 도장 4개 미만: 목록을 블러 처리하고 잠금 안내 팝업을 띄운다 */
  locked?: boolean;
  /** 현재 모은 도장 수 (잠금 안내 배지용) */
  visitedCount?: number;
  /** 잠금 팝업의 `지도로 돌아가 도장 모으기` */
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
      <main
        aria-hidden={locked || undefined}
        className={`mx-auto w-full max-w-5xl px-4 sm:px-6 py-4 space-y-4 ${
          withBottomNav ? 'pb-[calc(7rem+env(safe-area-inset-bottom))]' : 'pb-10'
        } ${locked ? 'blur-md pointer-events-none select-none opacity-65 max-h-[calc(100dvh-3.5rem)] overflow-hidden' : ''}`}
      >
        {/* 서브 헤더: 공통 상단 배너 바로 아래 */}
        <div className="flex items-center justify-between gap-3 rounded-2xl border border-[#D8CEBE] bg-[#FBF8F1]/95 px-4 py-2.5">
          <div className="min-w-0">
            <h1 className="font-serif-kr text-[clamp(1rem,2.4vw,1.25rem)] font-bold text-[#26201B] truncate">
              전생여지도 기념품 굿즈 스토어
            </h1>
            <p className="text-[11px] text-[#5C5349]">나의 전생을 담은 기념품 14종</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="굿즈 스토어 닫기"
            className="shrink-0 w-10 h-10 flex items-center justify-center rounded-full text-[#5C5349] hover:bg-[#F3ECE0] hover:text-[#26201B] transition-colors"
          >
            <X className="w-5 h-5" aria-hidden="true" />
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 auto-rows-max">
          {GOODS.map((item) => (
            <article
              key={item.id}
              className="rounded-2xl border border-[#D6CBB9] bg-[#FBF8F1] overflow-hidden shadow-sm"
            >
              <button
                type="button"
                onClick={() => onSelectGoods(item)}
                aria-label={`${item.name} 결제하기`}
                className="relative block w-full aspect-video bg-[#EFE5D0] group"
              >
                <img src={item.imageUrl} alt={item.name} loading="lazy" className="w-full h-full object-cover block" />
                <span className="absolute top-2 right-2 rounded-full bg-[#26201B]/60 px-2.5 py-1 text-[11px] font-medium text-[#FBF8F1] backdrop-blur-sm">
                  클릭하여 결제
                </span>
              </button>
              <div className="border-t border-[#D6CBB9]" aria-hidden="true" />
              <div className="flex items-end justify-between gap-3 p-3.5">
                <div className="min-w-0 flex-1">
                  <h2 className="text-[clamp(0.875rem,2vw,1rem)] font-bold text-[#26201B] leading-snug">{item.name}</h2>
                  <p className="mt-1 text-xs text-[#5C5349] leading-relaxed line-clamp-1">{item.desc}</p>
                </div>
                <span className="shrink-0 self-end rounded-lg border border-[#D6CBB9] bg-[#FBF8F1] px-3 py-1.5 text-sm font-bold text-[#8E3524] font-mono-tabular">
                  {formatWon(item.price)}
                </span>
              </div>
            </article>
          ))}
        </div>
      </main>

      {locked && (
        <div
          className={`fixed inset-0 z-20 flex items-center justify-center p-4 pt-20 bg-[#26201B]/45 backdrop-blur-sm ${
            withBottomNav ? 'pb-24' : ''
          }`}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-label="기념품 잠금 안내"
            className="relative bg-[#FBF8F1] border border-[#D8CEBE] ring-1 ring-inset ring-[#E6DEC8] rounded-2xl w-[calc(100vw-2rem)] max-w-[430px] shadow-[0_12px_32px_rgba(38,32,27,0.16)] px-6 pt-9 pb-7 text-center space-y-4"
          >
            <p className="absolute top-3.5 left-5 text-[11px] font-medium tracking-wide text-[#5C5349]/80">
              전생여지도 기념품 방
            </p>
            <button
              type="button"
              onClick={onClose}
              aria-label="기념품 방 닫기"
              className="absolute top-2 right-2 w-10 h-10 flex items-center justify-center rounded-full text-[#5C5349] hover:bg-[#F3ECE0] hover:text-[#26201B] transition-colors"
            >
              <X className="w-5 h-5" aria-hidden="true" />
            </button>
            <span className="mx-auto w-12 h-12 rounded-full bg-[#F3ECE0] border border-[#D6CBB9] text-[#8E3524] flex items-center justify-center">
              <Lock className="w-5 h-5" aria-hidden="true" />
            </span>
            <h2 className="text-[clamp(1.05rem,3vw,1.35rem)] font-bold text-[#26201B] leading-snug">
              아직 전생의 연이 닿지 않았소
            </h2>
            <p className="text-[clamp(0.82rem,2vw,0.95rem)] text-[#5C5349] leading-relaxed">
              네 곳의 전생 도장을 모두 모아야 기념품 방의 빗장이 열리옵니다.
            </p>
            <span className="inline-block rounded-md bg-[#2B3E50]/10 text-[#2B3E50] border border-[#2B3E50]/25 px-3 py-1 text-xs font-semibold">
              현재 모은 도장: {visitedCount} / 4개
            </span>
            {onGoToMap && (
              <button
                type="button"
                onClick={onGoToMap}
                className="block w-full min-h-[48px] px-5 py-3 rounded-xl bg-[#8E3524] text-[#FBF8F1] font-semibold text-sm hover:bg-[#762A1C] transition-colors"
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
