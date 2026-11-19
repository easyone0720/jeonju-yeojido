import { useState } from 'react';
import { RotateCcw, UserCircle2 } from 'lucide-react';
import { ENABLE_QUICK_COMPLETE_BUTTON } from '../config/features';

/**
 * 전 페이지 공통 상단 배너: [프로필] {모은 조각}/4 · {이름} · 현장 체험  …  미디어월 · skip · ↻
 * (미디어월 영상 오버레이와 시작 화면에서는 렌더하지 않는다)
 */
export interface TopExperienceHeaderProps {
  clueCount: number;
  visitorName?: string;
  onOpenMediaWall: () => void;
  onGoHome: () => void;
  /** [시연·검수용] 4개 거점 일괄 완료 (ENABLE_QUICK_COMPLETE_BUTTON) */
  onCompleteAllStamps?: () => Promise<void>;
}

export function TopExperienceHeader({
  clueCount,
  visitorName,
  onOpenMediaWall,
  onGoHome,
  onCompleteAllStamps,
}: TopExperienceHeaderProps) {
  const [quickCompleting, setQuickCompleting] = useState(false);
  const [quickCompleteError, setQuickCompleteError] = useState<string | null>(null);

  return (
    <header className="sticky top-0 z-30 border-b border-[#D8CEBE] bg-[#FBF8F1]/95 backdrop-blur-md">
      <div className="mx-auto w-full max-w-5xl px-4 sm:px-6 min-h-14 py-1.5 flex items-center justify-between gap-2 sm:gap-4">
        <div className="flex items-center gap-2 sm:gap-3 min-w-0">
          <div className="flex items-center gap-1.5 sm:gap-2 text-[#26201B] shrink-0">
            <UserCircle2 className="w-6 h-6 sm:w-7 sm:h-7 text-[#5C5349]" aria-hidden="true" />
            <span
              className="font-mono-tabular text-lg font-bold tracking-tight whitespace-nowrap"
              aria-label={`전생 조각 진행도 ${clueCount} / 4`}
            >
              {clueCount} / 4
            </span>
          </div>
          {visitorName && (
            <span className="text-xs text-[#5C5349] hidden sm:inline truncate max-w-[140px]">
              · {visitorName}
            </span>
          )}
          <span className="text-xs text-[#8E3524] font-medium whitespace-nowrap hidden min-[360px]:inline">
            · 현장 체험
          </span>
        </div>

        <div className="flex items-center gap-0.5 sm:gap-2 shrink-0">
          <button
            type="button"
            onClick={onOpenMediaWall}
            className="section-heading text-xs font-bold text-[#26201B] hover:text-[#8E3524] min-h-[44px] px-2 whitespace-nowrap shrink-0"
          >
            미디어월
          </button>
          {/* [QUICK-COMPLETE] 시연자용 초소형 skip. ENABLE_QUICK_COMPLETE_BUTTON 을 false 로 바꾸면 사라진다. */}
          {ENABLE_QUICK_COMPLETE_BUTTON && onCompleteAllStamps && clueCount < 4 && (
            <button
              type="button"
              disabled={quickCompleting}
              onClick={async () => {
                setQuickCompleting(true);
                setQuickCompleteError(null);
                try {
                  await onCompleteAllStamps();
                } catch (err) {
                  setQuickCompleteError(
                    err instanceof Error ? err.message : '스탬프 일괄 완료에 실패했습니다.'
                  );
                } finally {
                  setQuickCompleting(false);
                }
              }}
              aria-label="스탬프 4개 완료로 이동"
              className="px-1.5 min-h-[32px] shrink-0 whitespace-nowrap bg-transparent text-[11px] text-[#5C5349]/55 hover:text-[#26201B] disabled:opacity-50 transition-colors"
            >
              {quickCompleting ? '…' : 'skip'}
            </button>
          )}
          <button
            type="button"
            onClick={onGoHome}
            title="처음 화면으로 (기록은 안전하게 보관됩니다)"
            aria-label="처음으로 돌아가기"
            className="min-w-[40px] min-h-[40px] shrink-0 flex items-center justify-center rounded-lg text-[#5C5349] hover:bg-[#F3ECE0] hover:text-[#26201B]"
          >
            <RotateCcw className="w-4 h-4" aria-hidden="true" />
          </button>
        </div>
      </div>
      {quickCompleteError && (
        <p role="alert" className="mx-auto w-full max-w-5xl px-4 sm:px-6 pb-1 text-[11px] text-[#762A1C] text-right">
          {quickCompleteError}
        </p>
      )}
    </header>
  );
}
