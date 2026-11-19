import { useEffect, useRef, useState } from 'react';
import { Square, CheckSquare, X, Compass, MapPin, Sparkles, Gift } from 'lucide-react';

interface TutorialModalProps {
  open: boolean;
  onCloseWithoutHide: () => void;
  onHideTodayAndProceed: () => void;
}

const TUTORIAL_STEPS = [
  {
    num: '01',
    title: '체험 시작',
    desc: '닉네임과 생년월일을 입력하고 전생 탐험을 시작하세요.',
    icon: Compass,
  },
  {
    num: '02',
    title: '단서 수집 (4곳)',
    desc: '경기전, 전라감영, 완판본문화관, 남부시장을 방문해 QR 코드와 위치 인증으로 전생 조각을 모으세요.',
    icon: MapPin,
  },
  {
    num: '03',
    title: '나만의 전생 확인',
    desc: '모든 조각을 모아 국립전주박물관에서 인증하면 당신만의 전생과 초상화가 바로 완성됩니다.',
    icon: Sparkles,
  },
  {
    num: '04',
    title: '혜택 및 기록',
    desc: '여정 중 발급되는 제휴 쿠폰을 확인하고, 원한다면 전생 결과를 미디어월에 남겨보세요.',
    icon: Gift,
  },
] as const;

export function TutorialModal({
  open,
  onCloseWithoutHide,
  onHideTodayAndProceed,
}: TutorialModalProps) {
  const [checkedHideToday, setCheckedHideToday] = useState(false);
  const dialogRef = useRef<HTMLDivElement | null>(null);
  const closeButtonRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    if (!open) {
      setCheckedHideToday(false);
      return;
    }

    const prevFocused = document.activeElement as HTMLElement | null;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    // Focus the close button for accessible keyboard navigation
    requestAnimationFrame(() => {
      closeButtonRef.current?.focus();
    });

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onCloseWithoutHide();
        return;
      }
      if (e.key === 'Tab' && dialogRef.current) {
        const focusable = dialogRef.current.querySelectorAll<HTMLElement>(
          'button:not([disabled]), [href], input:not([disabled]), [tabindex]:not([tabindex="-1"])'
        );
        if (focusable.length === 0) return;
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = prevOverflow;
      prevFocused?.focus?.();
    };
  }, [open, onCloseWithoutHide]);

  if (!open) return null;

  const handleToggleHideToday = () => {
    setCheckedHideToday(true);
    onHideTodayAndProceed();
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-[#26201B]/45 backdrop-blur-sm flex items-center justify-center p-3 sm:p-5 overflow-y-auto"
      role="presentation"
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          onCloseWithoutHide();
        }
      }}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="tutorial-modal-title"
        aria-describedby="tutorial-modal-desc"
        className="w-[calc(100vw-2rem)] max-w-[430px] rounded-2xl border border-[#D8CEBE] ring-1 ring-inset ring-[#E6DEC8] bg-[#FBF8F1] shadow-2xl overflow-hidden my-auto max-h-[92dvh] flex flex-col"
      >
        {/* Top Utility Row: Today hide checkbox + Close X button */}
        <div className="px-4 sm:px-5 pt-3 pb-2 border-b border-[#D6CBB9] bg-[#F7F1E4]/80 flex items-center justify-between gap-2 shrink-0">
          <button
            type="button"
            role="checkbox"
            aria-checked={checkedHideToday}
            onClick={handleToggleHideToday}
            className="inline-flex items-center gap-2 min-h-[44px] px-2 rounded-lg text-xs sm:text-sm font-medium text-[#5C5349] hover:text-[#26201B] hover:bg-[#EFE8DC]/70 transition-colors"
          >
            {checkedHideToday ? (
              <CheckSquare className="w-4 h-4 text-[#8E3524] shrink-0" aria-hidden="true" />
            ) : (
              <Square className="w-4 h-4 text-[#5C5349] shrink-0" aria-hidden="true" />
            )}
            <span>오늘은 다시 이 창을 보지 않음</span>
          </button>

          <button
            ref={closeButtonRef}
            type="button"
            onClick={onCloseWithoutHide}
            aria-label="튜토리얼 닫기"
            className="min-w-[44px] min-h-[44px] flex items-center justify-center rounded-full text-[#5C5349] hover:text-[#26201B] hover:bg-[#EFE8DC] transition-colors"
          >
            <X className="w-5 h-5" aria-hidden="true" />
          </button>
        </div>

        {/* Scrollable Content */}
        <div className="p-5 sm:p-6 space-y-5 overflow-y-auto">
          {/* Top-Center Visual Header reusing existing Jeonju Hanok illustration */}
          <div className="mx-auto w-full max-w-xs aspect-[16/9] rounded-xl overflow-hidden border border-[#D6CBB9] bg-[#EFE6D4] shadow-xs relative">
            <img
              src="/places/hanok_village.jpg"
              alt="전주 경기전과 전통 한옥 풍경"
              className="w-full h-full object-cover"
            />
            <div
              className="absolute inset-0 bg-gradient-to-t from-[#26201B]/25 via-transparent to-transparent pointer-events-none"
              aria-hidden="true"
            />
          </div>

          {/* Title & Intro Copy */}
          <div className="text-center space-y-2">
            <h2
              id="tutorial-modal-title"
              className="font-serif-kr text-[clamp(1rem,2.4vw,1.25rem)] font-bold text-[#26201B]"
            >
              전생여지도에 오신 것을 환영합니다
            </h2>
            <p
              id="tutorial-modal-desc"
              className="text-xs sm:text-sm text-[#5C5349] leading-relaxed max-w-md mx-auto"
            >
              전주의 명소를 걸으며 잃어버린 나의 전생 조각을 찾아보세요.
              <br />
              4곳의 장소에서 단서를 모으면, 박물관에서 당신만의 전생 초상화가 완성됩니다.
            </p>
          </div>

          {/* 4-Step Guided Usage Grid */}
          <ol className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-left">
            {TUTORIAL_STEPS.map((step) => {
              const Icon = step.icon;
              return (
                <li
                  key={step.num}
                  className="rounded-xl border border-[#D6CBB9] bg-[#F3ECE0] p-3.5 shadow-xs space-y-1.5"
                >
                  <div className="flex items-center gap-2">
                    <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-[#8E3524]/10 text-[#8E3524] font-mono-tabular text-xs font-bold shrink-0">
                      {step.num}
                    </span>
                    <Icon className="w-3.5 h-3.5 text-[#8E3524] shrink-0" aria-hidden="true" />
                    <h3 className="font-serif-kr text-sm font-bold text-[#26201B]">
                      {step.title}
                    </h3>
                  </div>
                  <p className="text-xs text-[#5C5349] leading-relaxed">
                    {step.desc}
                  </p>
                </li>
              );
            })}
          </ol>
        </div>

        {/* Bottom Primary CTA */}
        <div className="px-5 sm:px-6 py-4 border-t border-[#D6CBB9] bg-[#F7F1E4]/60 shrink-0">
          <button
            type="button"
            onClick={onCloseWithoutHide}
            className="w-full min-h-[48px] px-6 py-3 rounded-xl bg-[#8E3524] text-[#FBF8F1] font-semibold text-sm sm:text-base hover:bg-[#762A1C] active:scale-[0.99] transition-all shadow-xs"
          >
            확인하고 시작하기
          </button>
        </div>
      </div>
    </div>
  );
}
