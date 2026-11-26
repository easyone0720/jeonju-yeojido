import { ReactNode, useEffect, useRef } from 'react';
import { X } from 'lucide-react';

/** 운영자 대시보드 v2.0 팔레트 */
export const C = {
  bg: '#EAE2D0',
  card: '#F4F0E8',
  border: '#D1C8B8',
  navy: '#1D2A3A',
  navy2: '#2E4057',
  navy3: '#4A627A',
  text: '#172638',
  orange: '#F28C18',
  orange2: '#FFAD60',
  blue: '#A7BFF5',
  green: '#39B86C',
  gold: '#F5C451',
  menuActive: '#364F6B',
} as const;

export const SANS = "'Pretendard Variable', 'Pretendard', 'Noto Sans KR', 'Malgun Gothic', 'Apple SD Gothic Neo', system-ui, sans-serif";

/** 카드 공통: 주황 원형 번호 배지(1~8) + 제목 */
export function CardShell({
  num,
  title,
  right,
  children,
  className = '',
}: {
  num?: number;
  title: string;
  right?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={`h-full min-w-0 rounded-2xl border border-[#D1C8B8] bg-[#F4F0E8] p-4 shadow-xs ${className}`}>
      <div className="mb-3 flex items-center justify-between gap-2">
        <h2 className="flex min-w-0 items-center gap-2 text-[15px] font-bold text-[#172638]">
          {num !== undefined && (
            <span
              aria-hidden="true"
              className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#F28C18] text-[13px] font-bold text-white"
            >
              {num}
            </span>
          )}
          <span className="min-w-0 break-keep">{title}</span>
        </h2>
        {right}
      </div>
      {children}
    </section>
  );
}

/** 공통 모달: Esc·바깥 클릭으로 닫힘, 열릴 때 닫기 버튼에 포커스 */
export function Modal({
  title,
  onClose,
  children,
  widthClass = 'max-w-lg',
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
  widthClass?: string;
}) {
  const closeRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-[80] flex items-center justify-center bg-[#172638]/55 p-4"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className={`max-h-[88vh] w-full ${widthClass} overflow-y-auto rounded-2xl border border-[#D1C8B8] bg-[#F4F0E8] p-5 shadow-2xl`}
      >
        <div className="mb-3 flex items-start justify-between gap-3">
          <h3 className="text-lg font-bold text-[#172638]">{title}</h3>
          <button
            ref={closeRef}
            type="button"
            onClick={onClose}
            aria-label="닫기"
            className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-[#D1C8B8] bg-[#EAE2D0] text-[#172638] hover:bg-[#D1C8B8]"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

/** 전통 기와 건축물 라인 아이콘 */
export function BrandIcon({ className = 'h-8 w-8' }: { className?: string }) {
  return (
    <svg viewBox="0 0 40 40" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      <path d="M3 17c7 0 11-5 17-11 6 6 10 11 17 11" />
      <path d="M8 19h24" />
      <path d="M10 19v14M16 19v14M24 19v14M30 19v14" />
      <path d="M6 33h28" />
      <path d="M20 6v-2" />
    </svg>
  );
}

/** 헤더 배경: 다중 산 능선 · 보름달 달무리 · 정자 실루엣 (저투명도) */
export function HeaderArt() {
  return (
    <svg
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 h-full w-full"
      viewBox="0 0 1200 120"
      preserveAspectRatio="xMidYMid slice"
    >
      <defs>
        <radialGradient id="moonHalo" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#F5E6B3" stopOpacity="0.5" />
          <stop offset="55%" stopColor="#F5E6B3" stopOpacity="0.12" />
          <stop offset="100%" stopColor="#F5E6B3" stopOpacity="0" />
        </radialGradient>
      </defs>
      <circle cx="770" cy="44" r="62" fill="url(#moonHalo)" />
      <circle cx="770" cy="44" r="19" fill="#F5E6B3" fillOpacity="0.55" />
      <path d="M0 120V84c60-24 110-30 170-8 50 18 90 8 140-18 60-28 110-14 170 14 56 26 110 22 160-6 70-38 130-20 190 10 60 28 120 24 180-4 70-32 130-22 190 6V120z" fill="#2E4057" fillOpacity="0.35" />
      <path d="M0 120V100c80-18 150-10 230 6 70 14 130 4 200-12 80-18 150-6 220 10 90 20 170 6 260-12 80-16 160-4 290 12V120z" fill="#364F6B" fillOpacity="0.3" />
      <g fill="#10192A" fillOpacity="0.55">
        <path d="M1015 86h70l-8-8h-54zM1022 86v-14h56v14zM1032 72l18-14 18 14zM1034 86v10M1066 86v10" />
        <rect x="1030" y="94" width="40" height="3" />
      </g>
    </svg>
  );
}

/** 사이드바 하단: 전통 산 능선 · 한옥 · 소나무 네이비 단색 일러스트 */
export function SidebarArt() {
  return (
    <svg aria-hidden="true" viewBox="0 0 240 120" className="block w-full" preserveAspectRatio="xMidYMax meet">
      <g fill="#2E4057">
        <path d="M0 120V70c24-16 44-12 66 4 18 14 36 4 56-14 22-20 44-14 62 6 20 22 40 14 56-4V120z" fillOpacity="0.8" />
        <path d="M0 120V94c30-10 56-6 84 6 30 12 60 2 90-8 24-8 46-6 66 4V120z" fillOpacity="0.6" />
      </g>
      <g fill="#10192A" fillOpacity="0.7">
        <path d="M118 96h54l-6-8h-42zM124 96V84h42v12zM132 84l13-11 13 11z" />
        <rect x="120" y="96" width="50" height="3" />
      </g>
      <g fill="#10192A" fillOpacity="0.75">
        <path d="M40 100V82M40 70l-10 14h20zM40 62l-8 12h16zM40 55l-6 10h12z" />
        <rect x="38" y="82" width="4" height="18" />
        <path d="M205 100V86M205 76l-8 12h16zM205 69l-6 10h12z" />
        <rect x="203" y="86" width="4" height="14" />
      </g>
    </svg>
  );
}
