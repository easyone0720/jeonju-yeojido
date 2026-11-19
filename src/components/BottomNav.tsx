import { Map as MapIcon, ScrollText, Ticket } from 'lucide-react';
import { HomeTab } from '../types/jeonju';

interface BottomNavProps {
  /** 현재 강조할 탭. 탭에 속하지 않는 화면(결과 등)에서는 null */
  activeTab: HomeTab | null;
  onChangeTab: (tab: HomeTab) => void;
}

const TABS: { id: HomeTab; label: string; Icon: typeof MapIcon }[] = [
  { id: 'map', label: '지도', Icon: MapIcon },
  { id: 'clues', label: '내 조각', Icon: ScrollText },
  { id: 'coupons', label: '쿠폰', Icon: Ticket },
];

/**
 * 체험 화면 공통 하단 내비게이션 (지도 / 내 조각 / 쿠폰).
 * 시작 · 개인정보 입력 · 미디어월 · 관리자 화면에서는 사용하지 않는다.
 * 이 바를 쓰는 화면은 하단 콘텐츠가 가려지지 않도록 pb-24 이상의 여백을 둬야 한다.
 */
export function BottomNav({ activeTab, onChangeTab }: BottomNavProps) {
  return (
    <nav
      aria-label="하단 내비게이션"
      className="fixed bottom-0 left-0 right-0 max-w-[430px] mx-auto z-40 border-t border-[#E5DDD0] bg-[#FBF8F2]/95 backdrop-blur-md safe-pb"
    >
      <div className="grid grid-cols-3 min-h-[58px]">
        {TABS.map(({ id, label, Icon }) => {
          const active = activeTab === id;
          return (
            <button
              key={id}
              type="button"
              onClick={() => onChangeTab(id)}
              aria-current={active ? 'page' : undefined}
              className={`min-h-[44px] flex flex-col items-center justify-center gap-0.5 text-xs border-t-2 transition-colors ${
                active
                  ? 'border-[#9A3412] text-[#9A3412] font-bold'
                  : 'border-transparent text-[#57534E] font-medium hover:text-[#1C1917]'
              }`}
            >
              <Icon className="w-4 h-4" aria-hidden="true" />
              <span>{label}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
