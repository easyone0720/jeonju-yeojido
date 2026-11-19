import { Gift, Map as MapIcon, ScrollText, Ticket } from 'lucide-react';
import { HomeTab } from '../types/jeonju';

/** 하단 바 탭: 홈 3개 탭 + 기념품 스토어 */
export type NavTab = HomeTab | 'goods';

interface BottomNavProps {
  /** 현재 강조할 탭. 탭에 속하지 않는 화면(결과 등)에서는 null */
  activeTab: NavTab | null;
  onChangeTab: (tab: NavTab) => void;
}

const TABS: { id: NavTab; label: string; Icon: typeof MapIcon }[] = [
  { id: 'map', label: '지도', Icon: MapIcon },
  { id: 'clues', label: '내 조각', Icon: ScrollText },
  { id: 'coupons', label: '쿠폰', Icon: Ticket },
  { id: 'goods', label: '기념품', Icon: Gift },
];

/**
 * 체험 화면 공통 하단 내비게이션 (지도 / 내 조각 / 쿠폰 / 기념품).
 * 시작 · 개인정보 입력 · 미디어월 · 관리자 화면에서는 사용하지 않는다.
 * 폭은 상단 콘텐츠 카드(max-w-5xl, 모바일 100%)에 맞추고, 좌우 가장자리는 한지 배경으로 서서히 사라진다.
 * 이 바를 쓰는 화면은 하단 콘텐츠가 가려지지 않도록 pb-28 이상의 여백을 둬야 한다.
 */
const EDGE_FADE =
  'linear-gradient(to right, transparent, black 12%, black 88%, transparent)';

export function BottomNav({ activeTab, onChangeTab }: BottomNavProps) {
  return (
    <nav
      aria-label="하단 내비게이션"
      className="fixed bottom-0 left-0 right-0 z-40 pointer-events-none safe-pb"
    >
      <div className="relative mx-auto w-full max-w-5xl pointer-events-auto">
        {/* 배경 레이어: 위쪽은 부드럽게 번지고, 좌우 끝은 테두리 없이 한지 배경으로 사라진다 */}
        <div
          aria-hidden="true"
          className="absolute inset-x-0 bottom-0 -top-5 pointer-events-none"
          style={{
            WebkitMaskImage: EDGE_FADE,
            maskImage: EDGE_FADE,
            background:
              'linear-gradient(to bottom, rgba(251,248,242,0) 0, rgba(251,248,242,0.92) 20px, rgba(251,248,242,0.97) 100%)',
          }}
        />
        <div
          aria-hidden="true"
          className="absolute inset-x-0 bottom-0 top-0 border-t border-[#E5DDD0] pointer-events-none"
          style={{ WebkitMaskImage: EDGE_FADE, maskImage: EDGE_FADE }}
        />
        <div className="relative grid grid-cols-4 min-h-[58px] px-2 sm:px-14">
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
      </div>
    </nav>
  );
}
