import { useEffect, useRef } from 'react';
import { ArrowRight, RotateCcw, ScrollText } from 'lucide-react';
import { UserSessionState } from '../types/jeonju';
import { getCollectedClueCount } from '../utils/pastLifeEngine';

interface RestoreSessionModalProps {
  open: boolean;
  session: UserSessionState | null;
  stepSummary: string;
  onResume: () => void;
  onGoHome: () => void;
  onStartDifferent: () => void;
}

export function RestoreSessionModal({
  open,
  session,
  stepSummary,
  onResume,
  onGoHome,
  onStartDifferent,
}: RestoreSessionModalProps) {
  const resumeBtnRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    if (!open) return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    requestAnimationFrame(() => resumeBtnRef.current?.focus());

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onGoHome();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      document.body.style.overflow = prevOverflow;
    };
  }, [open, onGoHome]);

  if (!open || !session) return null;

  const clueCount = getCollectedClueCount(session);
  const displayName = session.visitorName.trim() || '전주의 나그네';

  return (
    <div
      className="fixed inset-0 z-50 bg-[#1C1917]/55 backdrop-blur-xs flex items-center justify-center p-4"
      role="presentation"
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          onGoHome();
        }
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="restore-modal-title"
        className="w-full max-w-md rounded-2xl border-2 border-[#C7B596] bg-[#FBF8F2] p-6 shadow-2xl space-y-5"
      >
        <div className="space-y-2 text-center">
          <span className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-[#9A3412]/10 text-[#9A3412] mx-auto">
            <ScrollText className="w-6 h-6" aria-hidden="true" />
          </span>
          <h2
            id="restore-modal-title"
            className="font-serif-kr text-xl font-bold text-[#1C1917]"
          >
            이전에 진행하던 전생의 기록이 있습니다.
          </h2>
          <p className="text-sm text-[#44403C] leading-relaxed">
            지난번에 멈춘 곳에서 다시 전생의 여정을 이어가시겠습니까?
          </p>
        </div>

        <div className="rounded-xl border border-[#E5DDD0] bg-white p-4 space-y-1.5 text-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs text-[#78716C]">탐험자</span>
            <span className="font-semibold text-[#1C1917]">{displayName}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-xs text-[#78716C]">진행 상태</span>
            <span className="font-semibold text-[#9A3412]">{stepSummary}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-xs text-[#78716C]">수집한 조각</span>
            <span className="font-mono-tabular font-bold text-[#1C1917]">
              {clueCount} / 4
            </span>
          </div>
        </div>

        <div className="space-y-2.5">
          <button
            ref={resumeBtnRef}
            type="button"
            onClick={onResume}
            className="w-full min-h-[48px] px-5 py-3 rounded-xl bg-[#9A3412] text-white font-semibold text-sm sm:text-base hover:bg-[#7C2D12] flex items-center justify-center gap-2 transition-colors"
          >
            <span>이어서 시작하기</span>
            <ArrowRight className="w-4 h-4" aria-hidden="true" />
          </button>

          <button
            type="button"
            onClick={onGoHome}
            className="w-full min-h-[44px] px-5 py-2.5 rounded-xl border border-[#D6CEBE] bg-white text-sm font-semibold text-[#1C1917] hover:bg-[#F5EFE6] flex items-center justify-center gap-2 transition-colors"
          >
            <RotateCcw className="w-4 h-4" aria-hidden="true" />
            <span>처음으로 돌아가기</span>
          </button>

          <button
            type="button"
            onClick={onStartDifferent}
            className="w-full min-h-[36px] py-1 text-xs text-[#57534E] hover:text-[#1C1917] underline underline-offset-4"
          >
            새 체험 시작 또는 다른 복구 코드 불러오기
          </button>
        </div>
      </div>
    </div>
  );
}
