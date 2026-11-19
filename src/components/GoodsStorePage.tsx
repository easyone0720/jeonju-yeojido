import { X } from 'lucide-react';
import { formatWon, GOODS, type GoodsItem } from '../data/goods';

interface GoodsStorePageProps {
  /** 결과 화면(SceneResult)으로 돌아간다 */
  onClose: () => void;
  /** 굿즈 이미지를 누르면 해당 굿즈가 담긴 결제창으로 이동한다 */
  onSelectGoods: (item: GoodsItem) => void;
}

export function GoodsStorePage({ onClose, onSelectGoods }: GoodsStorePageProps) {
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

        <main className="flex-1 px-4 py-4 space-y-4 pb-10 safe-pb">
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
    </div>
  );
}
