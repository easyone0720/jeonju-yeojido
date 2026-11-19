import { Gift, Lock, Map as MapIcon, ScrollText, Ticket } from 'lucide-react';
import { HomeTab } from '../types/jeonju';

/** 하단 바 탭: 홈 3개 탭 + 기념품 스토어 */
export type NavTab = HomeTab | 'goods';

interface BottomNavProps {
  /** 현재 강조할 탭. 탭에 속하지 않는 화면(결과 등)에서는 null */
  activeTab: NavTab | null;
  onChangeTab: (tab: NavTab) => void;
  /** 도장 4개 미만이면 '기념품' 탭에 자물쇠 배지를 표시한다 */
  goodsLocked?: boolean;
}

const TABS: { id: NavTab; label: string; Icon: typeof MapIcon }[] = [
  { id: 'map', label: '지도', Icon: MapIcon },
  { id: 'clues', label: '내 조각', Icon: ScrollText },
  { id: 'coupons', label: '쿠폰', Icon: Ticket },
  { id: 'goods', label: '기념품', Icon: Gift },
];

export function BottomNav({ activeTab, onChangeTab, goodsLocked = false }: BottomNavProps) {
  return (
    <nav
      aria-label="하단 내비게이션"
      className="fixed bottom-0 left-0 right-0 z-40 border-t border-[#C9C1B1] bg-[#FBF8F2]/95 backdrop-blur-sm pb-[env(safe-area-inset-bottom)]"
    >
      {/* 상단 헤더와 같은 컨테이너 규격 (max-w-5xl 동일 규격) */}
      <div className="mx-auto w-full max-w-5xl px-4 sm:px-6">
        <div className="grid grid-cols-4 min-h-[58px]">
          {TABS.map(({ id, label, Icon }) => {
            const active = activeTab === id;
            const showLock = id === 'goods' && goodsLocked;
            return (
              <button
                key={id}
                type="button"
                onClick={() => onChangeTab(id)}
                aria-current={active ? 'page' : undefined}
                aria-label={showLock ? `${label} (잠김)` : label}
                className={`min-h-[44px] min-w-0 px-0.5 flex flex-col items-center justify-center gap-0.5 text-xs whitespace-nowrap border-t-2 transition-colors ${
                  active
                    ? 'border-[#9A3412] text-[#9A3412] font-bold'
                    : 'border-transparent text-[#57534E] font-medium hover:text-[#1C1917]'
                }`}
              >
                <span className="relative inline-flex">
                  <Icon className="w-4 h-4" aria-hidden="true" />
                  {showLock && (
                    <span
                      data-testid="goods-lock-badge"
                      className="absolute -top-1.5 -right-2.5 w-3.5 h-3.5 rounded-full bg-[#A35139] text-[#EEE9DF] flex items-center justify-center"
                    >
                      <Lock className="w-2 h-2" aria-hidden="true" />
                    </span>
                  )}
                </span>
                <span className="max-w-full truncate">{label}</span>
              </button>
            );
          })}
        </div>
      </div>
    </nav>
  );
}
