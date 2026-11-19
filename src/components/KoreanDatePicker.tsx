import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';
import { CalendarDays, ChevronLeft, ChevronRight } from 'lucide-react';

/**
 * 한국어 달력 선택기. 값 형식은 기존 <input type="date"> 와 동일한 'YYYY-MM-DD' 문자열.
 * 브라우저 기본 달력(영문 표기)을 쓰지 않으므로 어떤 환경에서도 한국어로 표시된다.
 */
export interface KoreanDatePickerProps {
  id?: string;
  value: string;
  onChange: (value: string) => void;
  /** 'YYYY-MM-DD' */
  min?: string;
  /** 'YYYY-MM-DD' */
  max?: string;
  required?: boolean;
  placeholder?: string;
  className?: string;
  'aria-describedby'?: string;
}

const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토'];

function pad(n: number): string {
  return String(n).padStart(2, '0');
}

function toIso(y: number, m: number, d: number): string {
  return `${y}-${pad(m + 1)}-${pad(d)}`;
}

/** 기기 로컬 기준 오늘 (UTC 기준 날짜 어긋남 방지) */
function localTodayIso(): string {
  const n = new Date();
  return toIso(n.getFullYear(), n.getMonth(), n.getDate());
}

function parseIso(v: string | undefined): { y: number; m: number; d: number } | null {
  if (!v) return null;
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(v);
  if (!match) return null;
  const y = Number(match[1]);
  const m = Number(match[2]) - 1;
  const d = Number(match[3]);
  const dt = new Date(y, m, d);
  if (dt.getFullYear() !== y || dt.getMonth() !== m || dt.getDate() !== d) return null;
  return { y, m, d };
}

function formatKorean(v: string): string {
  const p = parseIso(v);
  return p ? `${p.y}년 ${p.m + 1}월 ${p.d}일` : '';
}

export function KoreanDatePicker({
  id,
  value,
  onChange,
  min = '1940-01-01',
  max,
  required,
  placeholder = '생년월일을 선택해 주세요',
  className = '',
  'aria-describedby': describedBy,
}: KoreanDatePickerProps) {
  const autoId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);

  const todayIso = useMemo(() => localTodayIso(), [open]);
  const maxIso = max ?? todayIso;
  const minP = parseIso(min) ?? { y: 1940, m: 0, d: 1 };
  const maxP = parseIso(maxIso) ?? parseIso(todayIso)!;
  const selected = parseIso(value);
  const todayP = parseIso(todayIso)!;

  const clampView = useCallback(
    (y: number, m: number) => {
      let yy = Math.min(Math.max(y, minP.y), maxP.y);
      let mm = m;
      if (yy === minP.y && mm < minP.m) mm = minP.m;
      if (yy === maxP.y && mm > maxP.m) mm = maxP.m;
      return { y: yy, m: mm };
    },
    [minP.y, minP.m, maxP.y, maxP.m]
  );

  const [view, setView] = useState(() => {
    const base = selected ?? todayP;
    return clampView(base.y, base.m);
  });

  // 열 때마다 선택값(없으면 오늘)의 달로 이동
  useEffect(() => {
    if (open) {
      const base = parseIso(value) ?? todayP;
      setView(clampView(base.y, base.m));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // 바깥 클릭 / Esc 로 닫기
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent | TouchEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setOpen(false);
        triggerRef.current?.focus();
      }
    };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('touchstart', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('touchstart', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const years: number[] = [];
  for (let y = maxP.y; y >= minP.y; y -= 1) years.push(y);

  const firstMonth = view.y === minP.y ? minP.m : 0;
  const lastMonth = view.y === maxP.y ? maxP.m : 11;
  const months: number[] = [];
  for (let m = firstMonth; m <= lastMonth; m += 1) months.push(m);

  const viewKey = view.y * 12 + view.m;
  const canPrev = viewKey > minP.y * 12 + minP.m;
  const canNext = viewKey < maxP.y * 12 + maxP.m;
  const shift = (delta: number) => {
    const k = viewKey + delta;
    setView(clampView(Math.floor(k / 12), ((k % 12) + 12) % 12));
  };

  const firstWeekday = new Date(view.y, view.m, 1).getDay();
  const daysInMonth = new Date(view.y, view.m + 1, 0).getDate();
  const cells: Array<number | null> = [
    ...Array.from({ length: firstWeekday }, () => null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];
  while (cells.length % 7 !== 0) cells.push(null);

  const isDisabled = (d: number) => {
    const iso = toIso(view.y, view.m, d);
    return iso < toIso(minP.y, minP.m, minP.d) || iso > toIso(maxP.y, maxP.m, maxP.d);
  };

  const pick = (iso: string) => {
    onChange(iso);
    setOpen(false);
    triggerRef.current?.focus();
  };

  const selectCls =
    'min-h-[36px] rounded-lg border border-[#D6CBB9] bg-[#F3ECE0] px-2 text-sm font-semibold text-[#1B2632] focus:border-[#8E3524] focus:outline-none';
  const arrowCls =
    'w-9 h-9 flex items-center justify-center rounded-lg text-[#1B2632] hover:bg-[#F3ECE0] disabled:opacity-30 disabled:hover:bg-transparent transition-colors';

  const todayDisabled = todayIso < toIso(minP.y, minP.m, minP.d) || todayIso > toIso(maxP.y, maxP.m, maxP.d);

  return (
    <div ref={rootRef} className="relative">
      <button
        ref={triggerRef}
        id={id}
        type="button"
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-describedby={describedBy}
        aria-required={required}
        onClick={() => setOpen((o) => !o)}
        className={
          className ||
          'w-full min-h-[48px] px-4 py-2.5 rounded-xl border border-[#D6CEBE] bg-[#F3ECE0] text-base text-left'
        }
        style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}
      >
        <span className={value ? 'text-[#1C1917]' : 'text-[#78716C]'}>
          {value ? formatKorean(value) : placeholder}
        </span>
        <CalendarDays className="w-4 h-4 text-[#57534E] shrink-0" aria-hidden="true" />
      </button>

      {open && (
        <div
          role="dialog"
          aria-label="날짜 선택"
          id={`${autoId}-pop`}
          className="absolute left-0 top-full mt-2 z-50 w-full min-w-[min(18rem,calc(100vw-2rem))] max-w-[min(22rem,calc(100vw-2rem))] rounded-2xl border border-[#D8CEBE] ring-1 ring-inset ring-[#E6DEC8] bg-[#FBF8F1] p-3 shadow-xl"
        >
          <div className="flex items-center gap-1.5">
            <button type="button" className={arrowCls} aria-label="이전 달" disabled={!canPrev} onClick={() => shift(-1)}>
              <ChevronLeft className="w-5 h-5" aria-hidden="true" />
            </button>
            <div className="flex-1 flex items-center justify-center gap-1.5">
              <select
                aria-label="연도 선택"
                className={selectCls}
                value={view.y}
                onChange={(e) => setView(clampView(Number(e.target.value), view.m))}
              >
                {years.map((y) => (
                  <option key={y} value={y}>
                    {y}년
                  </option>
                ))}
              </select>
              <select
                aria-label="월 선택"
                className={selectCls}
                value={view.m}
                onChange={(e) => setView(clampView(view.y, Number(e.target.value)))}
              >
                {months.map((m) => (
                  <option key={m} value={m}>
                    {m + 1}월
                  </option>
                ))}
              </select>
            </div>
            <button type="button" className={arrowCls} aria-label="다음 달" disabled={!canNext} onClick={() => shift(1)}>
              <ChevronRight className="w-5 h-5" aria-hidden="true" />
            </button>
          </div>

          <p className="mt-2 text-center text-sm font-bold text-[#1B2632]" aria-live="polite">
            {view.y}년 {view.m + 1}월
          </p>

          <div className="mt-1 grid grid-cols-7 text-center" role="grid" aria-label={`${view.y}년 ${view.m + 1}월`}>
            {WEEKDAYS.map((w, i) => (
              <div
                key={w}
                role="columnheader"
                className="py-1.5 text-xs font-semibold"
                style={{ color: i === 0 ? '#8E3524' : '#5C5349' }}
              >
                {w}
              </div>
            ))}
            {cells.map((d, i) => {
              if (d === null) return <div key={`e${i}`} role="gridcell" />;
              const iso = toIso(view.y, view.m, d);
              const isSel = iso === value;
              const isToday = iso === todayIso;
              const disabled = isDisabled(d);
              const sunday = i % 7 === 0;
              return (
                <div key={iso} role="gridcell" className="flex items-center justify-center p-0.5">
                  <button
                    type="button"
                    disabled={disabled}
                    aria-label={`${view.y}년 ${view.m + 1}월 ${d}일`}
                    aria-pressed={isSel}
                    onClick={() => pick(iso)}
                    className="w-9 h-9 rounded-full text-sm font-medium transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                    style={{
                      background: isSel ? '#8E3524' : 'transparent',
                      color: isSel ? '#FBF8F1' : sunday ? '#8E3524' : '#1B2632',
                      border: isToday && !isSel ? '1px solid #1B2632' : '1px solid transparent',
                    }}
                  >
                    {d}
                  </button>
                </div>
              );
            })}
          </div>

          <div className="mt-2 flex items-center justify-between border-t border-[#D8CEBE] pt-2">
            <button
              type="button"
              onClick={() => {
                onChange('');
                setOpen(false);
              }}
              className="min-h-[36px] px-3 rounded-lg text-sm font-semibold text-[#5C5349] hover:bg-[#F3ECE0]"
            >
              초기화
            </button>
            <button
              type="button"
              disabled={todayDisabled}
              onClick={() => pick(todayIso)}
              className="min-h-[36px] px-3 rounded-lg text-sm font-semibold text-[#8E3524] hover:bg-[#F3ECE0] disabled:opacity-40"
            >
              오늘
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default KoreanDatePicker;
