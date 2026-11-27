import { useEffect, useRef, useState } from 'react';
import {
  ArrowLeft,
  BarChart2,
  CalendarDays,
  ChevronDown,
  ClipboardList,
  Download,
  Home,
  Layers,
  Menu,
  MapPin,
  Settings,
  Ticket,
  Users,
} from 'lucide-react';
import {
  clampRange,
  DEMO_PERIOD_END,
  DEMO_PERIOD_START,
  formatRangeLabel,
  presetRange,
  type DateRange,
  type PeriodPreset,
} from '../../data/adminDashboardData';
import { BrandIcon, HeaderArt, SidebarArt } from './ui';

export type AdminViewId = 'dashboard' | 'stats' | 'visits' | 'coupons' | 'survey' | 'users' | 'content' | 'system';

const MENU: Array<{ id: AdminViewId; label: string; icon: typeof Home }> = [
  { id: 'dashboard', label: '대시보드', icon: Home },
  { id: 'stats', label: '이용 통계', icon: BarChart2 },
  { id: 'visits', label: '방문·인증 분석', icon: MapPin },
  { id: 'coupons', label: '쿠폰·보상 관리', icon: Ticket },
  { id: 'survey', label: '설문·결과 분석', icon: ClipboardList },
  { id: 'users', label: '참가자 관리', icon: Users },
  { id: 'content', label: '콘텐츠 관리', icon: Layers },
  { id: 'system', label: '시스템·로그', icon: Settings },
];

/** 좌측 사이드바 내용 (데스크톱 고정 / 모바일 드로어 공용) */
export function SidebarContent({
  active,
  onSelect,
  onExport,
}: {
  active: AdminViewId;
  onSelect: (id: AdminViewId) => void;
  onExport: () => void;
}) {
  return (
    <div className="flex h-full flex-col bg-[#1D2A3A] text-white">
      <button
        type="button"
        onClick={() => onSelect('dashboard')}
        aria-label="전생여지도 운영자 대시보드 — 메인 대시보드로 이동"
        className="flex items-center gap-3 px-4 py-5 text-left hover:bg-[#2E4057]/40"
      >
        <BrandIcon className="h-9 w-9 shrink-0 text-[#F5E6B3]" />
        <span className="leading-tight">
          <span className="block text-[17px] font-extrabold">전생여지도</span>
          <span className="block text-[13px] font-bold text-[#A7BFF5]">운영자 대시보드</span>
        </span>
      </button>

      <nav aria-label="운영자 메뉴" className="flex-1 space-y-1 overflow-y-auto px-3 py-2">
        {MENU.map(({ id, label, icon: Icon }) => {
          const on = id === active;
          return (
            <button
              key={id}
              type="button"
              aria-current={on ? 'page' : undefined}
              onClick={() => onSelect(id)}
              className={`flex min-h-[44px] w-full items-center gap-3 rounded-lg px-3 text-left text-sm font-semibold transition-colors ${
                on ? 'bg-[#364F6B] text-white' : 'text-[#D8DFEA] hover:bg-[#2E4057]'
              }`}
            >
              <Icon className="h-[18px] w-[18px] shrink-0" aria-hidden="true" />
              <span>{label}</span>
            </button>
          );
        })}
      </nav>

      <div className="border-t border-[#364F6B] px-3 pt-3">
        <button
          type="button"
          onClick={onExport}
          className="flex min-h-[44px] w-full items-center gap-3 rounded-lg px-3 text-left text-sm font-semibold text-[#D8DFEA] hover:bg-[#2E4057]"
        >
          <Download className="h-[18px] w-[18px] shrink-0" aria-hidden="true" />
          <span>보고서 내보내기</span>
        </button>
      </div>
      <div className="mt-2">
        <SidebarArt />
      </div>
    </div>
  );
}

const PRESETS: Array<{ id: Exclude<PeriodPreset, 'custom'>; label: string }> = [
  { id: 'today', label: '오늘' },
  { id: 'last7', label: '최근 7일' },
  { id: 'last30', label: '최근 30일' },
];

function PeriodPicker({
  preset,
  range,
  onChange,
}: {
  preset: PeriodPreset;
  range: DateRange;
  onChange: (preset: PeriodPreset, range: DateRange) => void;
}) {
  const [open, setOpen] = useState(false);
  const [custom, setCustom] = useState(false);
  const [from, setFrom] = useState(range.from);
  const [to, setTo] = useState(range.to);
  const boxRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const pick = (p: Exclude<PeriodPreset, 'custom'>) => {
    const r = presetRange(p);
    onChange(p, r);
    setFrom(r.from);
    setTo(r.to);
    setCustom(false);
    setOpen(false);
  };

  const applyCustom = () => {
    const r = clampRange({ from, to });
    setFrom(r.from);
    setTo(r.to);
    onChange('custom', r);
    setOpen(false);
  };

  return (
    <div ref={boxRef} className="relative">
      <button
        type="button"
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className="inline-flex min-h-[40px] items-center gap-2 rounded-lg border border-[#4A627A] bg-[#2E4057] px-3 text-[13px] font-semibold text-white hover:bg-[#364F6B]"
      >
        <CalendarDays className="h-4 w-4 text-[#F5C451]" aria-hidden="true" />
        <span className="tabular-nums">{formatRangeLabel(range)}</span>
        <ChevronDown className="h-4 w-4" aria-hidden="true" />
      </button>
      {open && (
        <div
          role="dialog"
          aria-label="기간 선택"
          className="absolute right-0 z-[60] mt-2 w-64 rounded-xl border border-[#D1C8B8] bg-[#F4F0E8] p-2 text-[#172638] shadow-xl"
        >
          <ul className="space-y-1">
            {PRESETS.map((p) => (
              <li key={p.id}>
                <button
                  type="button"
                  onClick={() => pick(p.id)}
                  className={`flex min-h-[40px] w-full items-center justify-between rounded-lg px-3 text-sm font-semibold hover:bg-[#EAE2D0] ${
                    preset === p.id ? 'bg-[#EAE2D0]' : ''
                  }`}
                >
                  {p.label}
                  {preset === p.id && <span className="text-[#F28C18]">●</span>}
                </button>
              </li>
            ))}
            <li>
              <button
                type="button"
                onClick={() => setCustom((v) => !v)}
                className={`flex min-h-[40px] w-full items-center justify-between rounded-lg px-3 text-sm font-semibold hover:bg-[#EAE2D0] ${
                  preset === 'custom' || custom ? 'bg-[#EAE2D0]' : ''
                }`}
              >
                직접 기간 선택
                {preset === 'custom' && <span className="text-[#F28C18]">●</span>}
              </button>
            </li>
          </ul>
          {custom && (
            <div className="mt-2 space-y-2 rounded-lg border border-[#D1C8B8] bg-white p-2.5">
              <label className="block text-xs font-semibold">
                시작일
                <input
                  type="date"
                  value={from}
                  min={DEMO_PERIOD_START}
                  max={DEMO_PERIOD_END}
                  onChange={(e) => setFrom(e.target.value)}
                  className="mt-1 block min-h-[38px] w-full rounded-md border border-[#D1C8B8] px-2 text-sm"
                />
              </label>
              <label className="block text-xs font-semibold">
                종료일
                <input
                  type="date"
                  value={to}
                  min={DEMO_PERIOD_START}
                  max={DEMO_PERIOD_END}
                  onChange={(e) => setTo(e.target.value)}
                  className="mt-1 block min-h-[38px] w-full rounded-md border border-[#D1C8B8] px-2 text-sm"
                />
              </label>
              <button
                type="button"
                onClick={applyCustom}
                className="min-h-[38px] w-full rounded-md bg-[#1D2A3A] text-sm font-bold text-white hover:bg-[#2E4057]"
              >
                적용
              </button>
            </div>
          )}
          <p className="mt-2 px-1 text-[11px] leading-snug text-[#4A627A]">
            데모 데이터는 {DEMO_PERIOD_START.replaceAll('-', '.')}부터 {DEMO_PERIOD_END.replaceAll('-', '.')}까지만 있어, 이 범위 밖은 자동으로 맞춰집니다.
          </p>
        </div>
      )}
    </div>
  );
}

/** 최상단 헤더 */
export function AdminHeader({
  preset,
  range,
  onPeriodChange,
  onExport,
  onOpenMenu,
  onBackToApp,
}: {
  preset: PeriodPreset;
  range: DateRange;
  onPeriodChange: (preset: PeriodPreset, range: DateRange) => void;
  onExport: () => void;
  onOpenMenu: () => void;
  onBackToApp: () => void;
}) {
  return (
    <header className="relative z-30 bg-[#1D2A3A] text-white">
      {/* 장식 배경만 잘라 낸다 — 헤더 자체에 overflow-hidden 을 두면 기간 선택 드롭다운이 잘린다 */}
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden">
        <HeaderArt />
      </div>
      <div className="relative flex flex-wrap items-center justify-between gap-x-4 gap-y-3 px-4 py-3 sm:px-6">
        <div className="flex min-w-0 items-center gap-3">
          <button
            type="button"
            onClick={onOpenMenu}
            aria-label="메뉴 열기"
            className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-[#4A627A] hover:bg-[#2E4057] lg:hidden"
          >
            <Menu className="h-5 w-5" aria-hidden="true" />
          </button>
          <div className="min-w-0">
            <p className="text-[11px] font-semibold tracking-[0.18em] text-[#A7BFF5]">JEONJU YEOJIDO · OPERATIONS</p>
            <h1 className="flex flex-wrap items-center gap-x-2.5 gap-y-1 text-xl font-extrabold leading-tight sm:text-2xl">
              <span>전생여지도 운영자 대시보드</span>
              <span className="rounded-full bg-[#F5C451] px-2.5 py-0.5 text-[11px] font-bold text-[#172638]">v2.0 고도화 제안안</span>
            </h1>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <span className="inline-flex min-h-[40px] items-center gap-2 rounded-full border border-[#4A627A] bg-[#1D2A3A]/80 px-3 text-[13px] font-semibold">
            <span className="h-2 w-2 rounded-full bg-[#39B86C]" aria-hidden="true" />
            실시간 운영 상태
          </span>

          <PeriodPicker preset={preset} range={range} onChange={onPeriodChange} />

          <button
            type="button"
            onClick={onExport}
            className="inline-flex min-h-[40px] items-center gap-2 rounded-lg bg-[#F4F0E8] px-3.5 text-[13px] font-bold text-[#172638] hover:bg-white"
          >
            <Download className="h-4 w-4" aria-hidden="true" />
            보고서 내보내기
          </button>

          <button
            type="button"
            onClick={onBackToApp}
            className="inline-flex min-h-[40px] items-center gap-1.5 rounded-lg border border-[#4A627A] px-3 text-[13px] font-semibold hover:bg-[#2E4057]"
          >
            <ArrowLeft className="h-4 w-4" aria-hidden="true" />
            <span className="hidden sm:inline">체험 화면으로</span>
            <span className="sr-only sm:hidden">체험 화면으로</span>
          </button>
        </div>
      </div>
    </header>
  );
}

