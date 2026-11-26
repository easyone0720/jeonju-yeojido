/**
 * 운영자 대시보드 v2.0 — 데모 데이터 모델과 기간 집계 로직 (순수 함수, UI 의존 없음).
 *
 * 실제 서버 지표가 아직 연결되어 있지 않으므로 아래 수치는 모두 '데모 데이터'이다.
 * (헤더 배지에 `데모 모드`로 표기한다.)
 *
 * 설계 원칙
 *  - 기간 전체(11/01~11/23)를 합산하면 시안 수치와 정확히 일치하도록 일별 값을 만든다.
 *      참가자 1,240 · 1곳 이상 842 · 4곳 모두 648 · 박물관 424 · 쿠폰 발급 2,000 / 사용 830
 *  - 기간을 바꾸면 일별 값을 다시 합산하고, 비율은 항상 합산값에서 다시 계산한다(수학 우선).
 *  - 거점·쿠폰·제휴 상점 기준값은 기존 `adminDummyStats.ts`(coupons.ts 와 상점명 일치)를 재사용한다.
 */
import type { CouponCategory } from '../types/jeonju';
import {
  ADMIN_BASE_PARTICIPANTS,
  ADMIN_COUPON_CATEGORY_STATS,
  ADMIN_PARTNER_STORES,
  ADMIN_SPOT_VISITS,
  type AdminSpotKey,
} from './adminDummyStats';

// ---------------------------------------------------------------------------------------------
// 기간
// ---------------------------------------------------------------------------------------------
export const DEMO_PERIOD_START = '2026-11-01';
export const DEMO_PERIOD_END = '2026-11-23';
export const DEMO_DAYS: string[] = Array.from(
  { length: 23 },
  (_, i) => `2026-11-${String(i + 1).padStart(2, '0')}`
);

export interface DateRange {
  from: string;
  to: string;
}

export type PeriodPreset = 'today' | 'last7' | 'last30' | 'custom';

export const FULL_RANGE: DateRange = { from: DEMO_PERIOD_START, to: DEMO_PERIOD_END };

export function presetRange(preset: Exclude<PeriodPreset, 'custom'>): DateRange {
  if (preset === 'today') return { from: DEMO_PERIOD_END, to: DEMO_PERIOD_END };
  if (preset === 'last7') return { from: '2026-11-17', to: DEMO_PERIOD_END };
  // '최근 30일'은 데모 데이터 시작일(11/01)에서 잘리므로 전체 기간과 같다.
  return FULL_RANGE;
}

/** 데모 데이터 범위 안으로 맞추고, from > to 이면 서로 바꾼다. */
export function clampRange(range: DateRange): DateRange {
  const clamp = (d: string) => (d < DEMO_PERIOD_START ? DEMO_PERIOD_START : d > DEMO_PERIOD_END ? DEMO_PERIOD_END : d);
  const a = clamp(range.from || DEMO_PERIOD_START);
  const b = clamp(range.to || DEMO_PERIOD_END);
  return a <= b ? { from: a, to: b } : { from: b, to: a };
}

export function formatDotDate(iso: string): string {
  return iso.replaceAll('-', '.');
}

export function formatRangeLabel(range: DateRange): string {
  return `${formatDotDate(range.from)} ~ ${formatDotDate(range.to)}`;
}

/** 'YYYY-MM-DD' → 'M/D' */
export function shortDate(iso: string): string {
  return `${Number(iso.slice(5, 7))}/${Number(iso.slice(8, 10))}`;
}

// ---------------------------------------------------------------------------------------------
// 정수 배분 (합계를 정확히 보존)
// ---------------------------------------------------------------------------------------------
/**
 * total 을 weights 비율로 정수 배분한다. caps 가 있으면 칸마다 상한을 지킨다.
 * (내림 후, 남은 수량을 '목표 대비 부족분'이 큰 칸부터 1씩 채운다.)
 */
export function allocate(total: number, weights: number[], caps?: number[]): number[] {
  const sum = weights.reduce((a, b) => a + b, 0);
  const raw = weights.map((w) => (sum > 0 ? (total * w) / sum : 0));
  const cap = (i: number) => (caps ? caps[i] : Number.POSITIVE_INFINITY);
  const out = raw.map((r, i) => Math.min(Math.floor(r), cap(i)));
  let rest = total - out.reduce((a, b) => a + b, 0);
  while (rest > 0) {
    let best = -1;
    let bestGap = -Infinity;
    for (let i = 0; i < out.length; i++) {
      if (out[i] >= cap(i)) continue;
      const gap = raw[i] - out[i];
      if (gap > bestGap) {
        bestGap = gap;
        best = i;
      }
    }
    if (best < 0) break;
    out[best] += 1;
    rest -= 1;
  }
  return out;
}

// ---------------------------------------------------------------------------------------------
// 기준 합계 (전체 기간)
// ---------------------------------------------------------------------------------------------
export const DEMO_TOTAL_PARTICIPANTS = ADMIN_BASE_PARTICIPANTS; // 1,240
/** 퍼널 단계별 전체 기간 인원 (시안 기준) */
export const DEMO_FUNNEL_TOTALS = { anyVerified: 842, allVerified: 648, museum: 424 } as const;

export const FUNNEL_TITLES = [
  '한옥마을 QR 시작',
  '4개 거점 중 1곳 이상 인증',
  '4개 거점 모두 인증',
  '박물관 도착(최종 완료)',
] as const;

/** '4개 거점' = 경기전·전라감영·완판본문화관·남부시장 */
export const FOUR_HERITAGE_SPOTS: AdminSpotKey[] = ['gyeonggijeon', 'jeollagamyeong', 'wanpanbon', 'nambu_market'];

export interface SurveyGroupDef {
  id: string;
  label: string;
  /** 전체 기간 점유율(%) — 합계 100.0 */
  share: number;
  color: string;
}

export const SURVEY_GROUPS: SurveyGroupDef[] = [
  { id: 'scholar', label: '학자·문인형', share: 34.2, color: '#1D2A3A' },
  { id: 'leader', label: '무장·리더형', share: 28.1, color: '#6F9BE8' },
  { id: 'artist', label: '예술가형', share: 17.0, color: '#B7A9E8' },
  { id: 'merchant', label: '상인·실무형', share: 12.6, color: '#F28C7C' },
  { id: 'etc', label: '기타', share: 8.1, color: '#E3D2A6' },
];

/** 기간 비교(▲)·고정 지표 — 일별 집계가 불가능한 값이라 전체 기간 기준 데모 상수로만 쓴다. */
export const DEMO_STATIC = {
  satisfaction: 4.8,
  responseRate: 79.0,
  avgStayLabel: '2시간 40분',
  deltaParticipants: '+3.0%',
  deltaCompletion: '+5.4%p',
  deltaCoupon: '+6.2%p',
  deltaStay: '+18분',
} as const;

// ---------------------------------------------------------------------------------------------
// 일별 데이터 생성 (결정적 — 새로고침해도 같은 값)
// ---------------------------------------------------------------------------------------------
export interface DayMetrics {
  date: string;
  participants: number;
  anyVerified: number;
  allVerified: number;
  museum: number;
  spots: Record<AdminSpotKey, number>;
  categories: Record<CouponCategory, { issued: number; used: number }>;
  /** templateId → 발급/사용 */
  stores: Record<string, { issued: number; used: number }>;
  /** SURVEY_GROUPS 순서. 합 = participants */
  groups: number[];
}

/** 홍보 캠페인 시작일 이후 방문 증가 폭 (일별 가중치 배수) */
const CAMPAIGN_LIFT = 1.256;
export const EVENT_WEEKEND_PEAK = '2026-11-14';
export const EVENT_CAMPAIGN_START = '2026-11-19';

function dayWeight(index: number, date: string): number {
  const dow = index % 7; // 2026-11-01 = 일요일(0)
  let w = dow === 6 ? 82 : dow === 0 ? 68 : 38;
  w += ((index * 7) % 5) * 2; // 완만한 결정적 요철
  if (date === EVENT_WEEKEND_PEAK) w = 112; // 주말 방문 급증
  if (date >= EVENT_CAMPAIGN_START) w *= CAMPAIGN_LIFT;
  return w;
}

function buildDays(): DayMetrics[] {
  const weights = DEMO_DAYS.map((d, i) => dayWeight(i, d));
  const participants = allocate(DEMO_TOTAL_PARTICIPANTS, weights);

  const anyVerified = allocate(DEMO_FUNNEL_TOTALS.anyVerified, participants, participants);
  const allVerified = allocate(DEMO_FUNNEL_TOTALS.allVerified, anyVerified, anyVerified);
  const museum = allocate(DEMO_FUNNEL_TOTALS.museum, allVerified, allVerified);

  const spotTotals = Object.fromEntries(ADMIN_SPOT_VISITS.map((s) => [s.key, s.count])) as Record<AdminSpotKey, number>;
  const spotSeries = {} as Record<AdminSpotKey, number[]>;
  (Object.keys(spotTotals) as AdminSpotKey[]).forEach((key) => {
    if (key === 'hanok_village') spotSeries[key] = participants;
    else if (key === 'jeonju_museum') spotSeries[key] = museum;
    else if (key === 'gyeonggijeon') spotSeries[key] = anyVerified; // 842 = 1곳 이상 인증 (시안)
    else spotSeries[key] = allocate(spotTotals[key], participants, participants);
  });

  const categorySeries = {} as Record<CouponCategory, { issued: number[]; used: number[] }>;
  ADMIN_COUPON_CATEGORY_STATS.forEach((c) => {
    const issued = allocate(c.issued, participants);
    categorySeries[c.category] = { issued, used: allocate(c.used, issued, issued) };
  });
  const storeSeries: Record<string, { issued: number[]; used: number[] }> = {};
  ADMIN_PARTNER_STORES.forEach((s) => {
    const issued = allocate(s.issued, participants);
    storeSeries[s.templateId] = { issued, used: allocate(s.used, issued, issued) };
  });

  // 유형 분포: 하루 합이 그날 참가자 수와 같도록 '남은 필요량'을 상한으로 순차 배분한다.
  const groupTotals = allocate(
    DEMO_TOTAL_PARTICIPANTS,
    SURVEY_GROUPS.map((g) => g.share)
  );
  const need = [...groupTotals];
  const groupsByDay: number[][] = participants.map((p) => {
    const day = allocate(p, need, need);
    day.forEach((v, gi) => {
      need[gi] -= v;
    });
    return day;
  });

  return DEMO_DAYS.map((date, i) => ({
    date,
    participants: participants[i],
    anyVerified: anyVerified[i],
    allVerified: allVerified[i],
    museum: museum[i],
    spots: Object.fromEntries((Object.keys(spotSeries) as AdminSpotKey[]).map((k) => [k, spotSeries[k][i]])) as Record<
      AdminSpotKey,
      number
    >,
    categories: Object.fromEntries(
      ADMIN_COUPON_CATEGORY_STATS.map((c) => [
        c.category,
        { issued: categorySeries[c.category].issued[i], used: categorySeries[c.category].used[i] },
      ])
    ) as DayMetrics['categories'],
    stores: Object.fromEntries(
      ADMIN_PARTNER_STORES.map((s) => [
        s.templateId,
        { issued: storeSeries[s.templateId].issued[i], used: storeSeries[s.templateId].used[i] },
      ])
    ),
    groups: groupsByDay[i],
  }));
}

export const DEMO_DAILY: DayMetrics[] = buildDays();

// ---------------------------------------------------------------------------------------------
// 내 시연 기록 합산(선택) — 마지막 날(11/23)에 +1 씩 더한다.
// ---------------------------------------------------------------------------------------------
export interface LiveOverlay {
  hasSession: boolean;
  visitedSpotIds: readonly string[];
  issuedByCategory: Record<CouponCategory, number>;
  usedByCategory: Record<CouponCategory, number>;
  issuedByTemplate: Record<string, number>;
  usedByTemplate: Record<string, number>;
}

function applyOverlay(days: DayMetrics[], live: LiveOverlay): DayMetrics[] {
  const last = days[days.length - 1];
  if (!last || last.date !== DEMO_PERIOD_END) return days;
  const visited = new Set(live.visitedSpotIds);
  const heritageDone = FOUR_HERITAGE_SPOTS.filter((k) => visited.has(k)).length;
  const next: DayMetrics = {
    ...last,
    participants: last.participants + (live.hasSession ? 1 : 0),
    anyVerified: last.anyVerified + (heritageDone >= 1 ? 1 : 0),
    allVerified: last.allVerified + (heritageDone === FOUR_HERITAGE_SPOTS.length ? 1 : 0),
    museum: last.museum + (visited.has('jeonju_museum') ? 1 : 0),
    spots: { ...last.spots },
    categories: { ...last.categories },
    stores: { ...last.stores },
    groups: last.groups,
  };
  if (live.hasSession) next.spots.hanok_village += 1;
  (Object.keys(next.spots) as AdminSpotKey[]).forEach((k) => {
    if (k !== 'hanok_village' && visited.has(k)) next.spots[k] += 1;
  });
  (Object.keys(next.categories) as CouponCategory[]).forEach((c) => {
    next.categories[c] = {
      issued: next.categories[c].issued + (live.issuedByCategory[c] ?? 0),
      used: next.categories[c].used + (live.usedByCategory[c] ?? 0),
    };
  });
  Object.keys(next.stores).forEach((id) => {
    next.stores[id] = {
      issued: next.stores[id].issued + (live.issuedByTemplate[id] ?? 0),
      used: next.stores[id].used + (live.usedByTemplate[id] ?? 0),
    };
  });
  return [...days.slice(0, -1), next];
}

// ---------------------------------------------------------------------------------------------
// 기간 집계
// ---------------------------------------------------------------------------------------------
export const pct = (part: number, whole: number): number => (whole > 0 ? (part / whole) * 100 : 0);
export const fmt = (n: number): string => n.toLocaleString('ko-KR');
export const fmtPct = (n: number): string => `${n.toFixed(1)}%`;

export interface SpotRow {
  key: AdminSpotKey;
  name: string;
  tag?: string;
  count: number;
  rate: number;
}
export interface FunnelRow {
  step: number;
  title: string;
  count: number;
  rate: number; // 시작 대비 %
  stepRate: number; // 직전 단계 대비 %
  dropped: number; // 직전 단계 대비 이탈 인원
}
export interface CategoryRow {
  category: CouponCategory;
  issued: number;
  used: number;
  rate: number;
}
export interface StoreRow {
  templateId: string;
  name: string;
  area: string;
  category: CouponCategory;
  issued: number;
  used: number;
  rate: number;
}
export interface GroupRow {
  id: string;
  label: string;
  color: string;
  count: number;
  rate: number;
}
export interface DailyPoint {
  date: string;
  label: string;
  participants: number;
  completionRate: number;
}

export interface PeriodSummary {
  range: DateRange;
  dayCount: number;
  isFullPeriod: boolean;
  participants: number;
  completionRate: number;
  couponIssued: number;
  couponUsed: number;
  couponUseRate: number;
  spots: SpotRow[];
  funnel: FunnelRow[];
  categories: CategoryRow[];
  stores: StoreRow[];
  groups: GroupRow[];
  surveyN: number;
  daily: DailyPoint[];
  /** 최근 7일(선택 기간 끝 기준) vs 그 직전 7일 참가자 증감(%). 비교 기간이 데이터 밖이면 null */
  weekOverWeek: number | null;
}

export function summarize(rangeInput: DateRange, live?: LiveOverlay | null): PeriodSummary {
  const range = clampRange(rangeInput);
  let all = DEMO_DAILY;
  if (live) all = applyOverlay(all, live);
  const days = all.filter((d) => d.date >= range.from && d.date <= range.to);

  const sum = (pick: (d: DayMetrics) => number) => days.reduce((a, d) => a + pick(d), 0);
  const participants = sum((d) => d.participants);
  const anyVerified = sum((d) => d.anyVerified);
  const allVerified = sum((d) => d.allVerified);
  const museum = sum((d) => d.museum);

  const spots: SpotRow[] = ADMIN_SPOT_VISITS.map((s) => {
    const count = sum((d) => d.spots[s.key]);
    return { key: s.key, name: s.name, tag: s.tag, count, rate: pct(count, participants) };
  });

  const counts = [participants, anyVerified, allVerified, museum];
  const funnel: FunnelRow[] = counts.map((count, i) => ({
    step: i + 1,
    title: FUNNEL_TITLES[i],
    count,
    rate: pct(count, participants),
    stepRate: i === 0 ? 100 : pct(count, counts[i - 1]),
    dropped: i === 0 ? 0 : Math.max(0, counts[i - 1] - count),
  }));

  const categories: CategoryRow[] = ADMIN_COUPON_CATEGORY_STATS.map((c) => {
    const issued = sum((d) => d.categories[c.category].issued);
    const used = sum((d) => d.categories[c.category].used);
    return { category: c.category, issued, used, rate: pct(used, issued) };
  });
  const couponIssued = categories.reduce((a, c) => a + c.issued, 0);
  const couponUsed = categories.reduce((a, c) => a + c.used, 0);

  const stores: StoreRow[] = ADMIN_PARTNER_STORES.map((s) => {
    const issued = sum((d) => d.stores[s.templateId].issued);
    const used = sum((d) => d.stores[s.templateId].used);
    return {
      templateId: s.templateId,
      name: s.name,
      area: s.area,
      category: s.category,
      issued,
      used,
      rate: pct(used, issued),
    };
  });

  const surveyN = days.reduce((a, d) => a + d.groups.reduce((x, y) => x + y, 0), 0);
  const groups: GroupRow[] = SURVEY_GROUPS.map((g, gi) => {
    const count = sum((d) => d.groups[gi]);
    return { id: g.id, label: g.label, color: g.color, count, rate: pct(count, surveyN) };
  });

  const daily: DailyPoint[] = days.map((d) => ({
    date: d.date,
    label: shortDate(d.date),
    participants: d.participants,
    completionRate: Number(pct(d.allVerified, d.participants).toFixed(1)),
  }));

  // 주간 증감: 선택 기간의 마지막 날 기준 최근 7일 vs 직전 7일 (전체 데이터에서 계산)
  let weekOverWeek: number | null = null;
  const endIdx = DEMO_DAYS.indexOf(range.to);
  if (endIdx >= 13) {
    const cur = all.slice(endIdx - 6, endIdx + 1).reduce((a, d) => a + d.participants, 0);
    const prev = all.slice(endIdx - 13, endIdx - 6).reduce((a, d) => a + d.participants, 0);
    weekOverWeek = prev > 0 ? ((cur - prev) / prev) * 100 : null;
  }

  return {
    range,
    dayCount: days.length,
    isFullPeriod: range.from === DEMO_PERIOD_START && range.to === DEMO_PERIOD_END,
    participants,
    completionRate: pct(allVerified, participants),
    couponIssued,
    couponUsed,
    couponUseRate: pct(couponUsed, couponIssued),
    spots,
    funnel,
    categories,
    stores,
    groups,
    surveyN,
    daily,
    weekOverWeek,
  };
}

// ---------------------------------------------------------------------------------------------
// CSV (UTF-8 BOM 은 다운로드 시점에 붙인다)
// ---------------------------------------------------------------------------------------------
const csvCell = (v: string | number): string => {
  const s = String(v);
  return /[",\n]/.test(s) ? `"${s.replaceAll('"', '""')}"` : s;
};

export function buildReportCsv(s: PeriodSummary): { csv: string; rowCount: number; sections: string[] } {
  const rows: Array<Array<string | number>> = [];
  const sections: string[] = [];
  const section = (name: string, header: string[], body: Array<Array<string | number>>) => {
    sections.push(name);
    rows.push([`[${name}]`]);
    rows.push(header);
    body.forEach((r) => rows.push(r));
    rows.push([]);
  };

  rows.push(['전생여지도 운영자 대시보드 보고서 (데모 데이터)']);
  rows.push(['기간', formatRangeLabel(s.range)]);
  rows.push([]);

  section('핵심 지표', ['지표', '값'], [
    ['총 참가자(명)', s.participants],
    ['4개 거점 인증 완료율(%)', s.completionRate.toFixed(1)],
    ['쿠폰 발급(건)', s.couponIssued],
    ['쿠폰 사용(건)', s.couponUsed],
    ['쿠폰 사용률(%)', s.couponUseRate.toFixed(1)],
    ['만족도(5점 만점)', `${DEMO_STATIC.satisfaction} (전체 기간 고정 데모값)`],
    ['평균 체류 시간', `${DEMO_STATIC.avgStayLabel} (전체 기간 고정 데모값)`],
  ]);
  section('일별 참가자', ['날짜', '참가자(명)', '4개 거점 완료율(%)'], s.daily.map((d) => [d.date, d.participants, d.completionRate]));
  section('여정 단계별 전환', ['단계', '인원(명)', '시작 대비(%)', '직전 단계 대비(%)', '이탈(명)'], s.funnel.map((f) => [f.title, f.count, f.rate.toFixed(1), f.stepRate.toFixed(1), f.dropped]));
  section('거점별 방문·인증', ['거점', '방문(명)', '인증률(%)'], s.spots.map((p) => [p.name, p.count, p.rate.toFixed(1)]));
  section('쿠폰 카테고리', ['카테고리', '발급(건)', '사용(건)', '사용률(%)'], s.categories.map((c) => [c.category, c.issued, c.used, c.rate.toFixed(1)]));
  section('제휴 상점', ['상점', '권역', '발급(건)', '사용(건)', '사용률(%)'], s.stores.map((t) => [t.name, t.area, t.issued, t.used, t.rate.toFixed(1)]));
  section('전생 유형 분포', ['유형', '인원(명)', '비중(%)'], s.groups.map((g) => [g.label, g.count, g.rate.toFixed(1)]));

  const csv = rows.map((r) => r.map(csvCell).join(',')).join('\r\n');
  return { csv, rowCount: rows.filter((r) => r.length > 0).length, sections };
}

// ---------------------------------------------------------------------------------------------
// 데모 활동 로그 / 메뉴 안내 / 확장 기능 카드
// ---------------------------------------------------------------------------------------------
export interface ActivityLog {
  time: string;
  text: string;
  user: string;
}

const STORE_NAME_FOR_LOG = ADMIN_PARTNER_STORES[0].name.replace(/\s*\(.*\)$/, '');

export const DEMO_ACTIVITY_LOG: ActivityLog[] = [
  { time: '14:32', text: '한옥마을 QR 시작', user: '#A832' },
  { time: '14:30', text: '경기전 인증 완료', user: '#A831' },
  { time: '14:28', text: `쿠폰 사용 (${STORE_NAME_FOR_LOG})`, user: '#A831' },
  { time: '14:25', text: '박물관 도착', user: '#A830' },
  { time: '14:21', text: '전라감영 인증 완료', user: '#A829' },
];

/** 시스템·로그 화면용 확장 목록 (모두 데모) */
export const DEMO_SYSTEM_LOG: Array<ActivityLog & { level: 'INFO' | 'WARN' }> = (() => {
  const texts: Array<[string, 'INFO' | 'WARN']> = [
    ['한옥마을 QR 시작', 'INFO'],
    ['경기전 인증 완료', 'INFO'],
    ['전라감영 인증 완료', 'INFO'],
    ['완판본문화관 인증 완료', 'INFO'],
    ['남부시장 인증 완료', 'INFO'],
    ['쿠폰 발급', 'INFO'],
    ['쿠폰 사용', 'INFO'],
    ['박물관 도착', 'INFO'],
    ['GPS 오차 범위 초과 후 재시도', 'WARN'],
    ['미등록 QR 스캔 차단', 'WARN'],
  ];
  const out: Array<ActivityLog & { level: 'INFO' | 'WARN' }> = [];
  for (let i = 0; i < 30; i++) {
    const [text, level] = texts[(i * 7 + 3) % texts.length];
    const minutes = 14 * 60 + 32 - i * 4;
    const hh = String(Math.floor(minutes / 60)).padStart(2, '0');
    const mm = String(minutes % 60).padStart(2, '0');
    out.push({ time: `${hh}:${mm}`, text, user: `#A${String(832 - i).padStart(3, '0')}`, level });
  }
  return out;
})();

export interface MenuInfo {
  id: string;
  label: string;
  purpose: string;
  planned: string[];
  status: string;
}

export const ADMIN_MENU_INFO: Record<string, MenuInfo> = {
  stats: {
    id: 'stats',
    label: '이용 통계',
    purpose: '일·주·월 단위 이용 추이와 시간대·요일별 방문 패턴을 한곳에서 비교하는 화면입니다.',
    planned: ['시간대·요일 히트맵', '신규/재방문 비율', '기기·유입 경로별 이용'],
    status: '개발 준비 단계 — 서버 집계 API 연동 전입니다.',
  },
  visits: {
    id: 'visits',
    label: '방문·인증 분석',
    purpose: '거점별 QR·GPS 인증 성공/실패 원인과 거점 간 이동 경로를 분석하는 화면입니다.',
    planned: ['거점별 인증 실패 사유', '거점 간 이동 시간', '인증 방식(QR/GPS) 비교'],
    status: '개발 준비 단계 — 인증 로그 수집 연동 전입니다.',
  },
  coupons: {
    id: 'coupons',
    label: '쿠폰·보상 관리',
    purpose: '쿠폰 발급·사용 현황과 제휴 상점별 정산·재고를 관리하는 화면입니다.',
    planned: ['제휴 상점별 정산 내역', '쿠폰 유효기간·재고 관리', '보상(아크릴 키링 등) 지급 이력'],
    status: '개발 준비 단계 — 현재는 대시보드의 쿠폰 카드와 하단 바코드 검증 도구만 제공합니다.',
  },
  survey: {
    id: 'survey',
    label: '설문·결과 분석',
    purpose: '만족도 설문과 전생 유형 결과를 교차 분석해 콘텐츠 개선점을 찾는 화면입니다.',
    planned: ['문항별 응답 분포', '유형×만족도 교차표', '자유 응답 키워드 분석'],
    status: '개발 준비 단계 — 설문 응답 저장소 연동 전입니다.',
  },
  users: {
    id: 'users',
    label: '참가자 관리',
    purpose: '참가자 세션 조회와 복구 코드 안내 등 문의 대응을 지원하는 화면입니다.',
    planned: ['세션·복구 코드 조회', '쿠폰 보유/사용 상태 확인', '개인정보 최소 수집 원칙 점검'],
    status: '개발 준비 단계 — 개인정보 접근 권한 정책 확정 후 개발합니다.',
  },
  content: {
    id: 'content',
    label: '콘텐츠 관리',
    purpose: '거점 콘텐츠, 전생 캐릭터, 미디어월 송출 목록을 관리하는 화면입니다.',
    planned: ['거점 안내문·이미지 관리', '캐릭터 10종 문구 관리', '미디어월 송출 승인'],
    status: '일부 제공 — 아래 캐릭터 배정 통계와 미디어월 승인 목록은 기존 대시보드에서 옮겨 온 데모 화면입니다.',
  },
  system: {
    id: 'system',
    label: '시스템·로그',
    purpose: '서비스 활동 로그와 오류·경고 이력을 확인하는 화면입니다.',
    planned: ['실시간 로그 스트림', '오류·경고 알림 규칙', '운영자 접근 이력'],
    status: '데모 로그만 표시 — 실제 서버 로그와 연결되어 있지 않습니다.',
  },
};

export interface ExpansionFeature {
  id: string;
  title: string;
  summary: string;
  detail: string;
  status: string;
}

export const EXPANSION_FEATURES: ExpansionFeature[] = [
  {
    id: 'ab',
    title: 'A/B 테스트',
    summary: '쿠폰 문구·UI·튜토리얼 등 효과 비교',
    detail: '쿠폰 안내 문구, 버튼 위치, 튜토리얼 길이를 두 가지 이상 만들어 방문자에게 나누어 보여주고 인증 완료율·쿠폰 사용률 차이를 비교하는 기능입니다.',
    status: '미구현 — 방문자 그룹 배정과 실험 결과 저장 구조가 아직 없습니다.',
  },
  {
    id: 'return',
    title: '재방문 분석',
    summary: '닉네임 기반 재방문율·방문 간격 분석',
    detail: '같은 참가자가 다시 방문한 비율과 첫 방문~재방문 간격을 분석해 재방문을 부르는 보상 구조를 찾는 기능입니다.',
    status: '미구현 — 참가자를 식별하는 최소 정보 수집 정책 확정이 선행되어야 합니다.',
  },
  {
    id: 'forecast',
    title: '예측 분석',
    summary: '향후 참가자·쿠폰 사용량 예측(시계열 모델)',
    detail: '일별 참가자 추이를 바탕으로 다음 주 방문자와 쿠폰 사용량을 예측해 제휴 상점 재고·인력 배치에 활용하는 기능입니다.',
    status: '미구현 — 충분한 실제 운영 데이터가 쌓인 뒤 모델을 검토합니다.',
  },
  {
    id: 'anomaly',
    title: '이상 탐지',
    summary: '비정상 인증·쿠폰 사용 등 부정 이용 탐지',
    detail: '짧은 시간 내 반복 인증, 거점 이동 속도가 비현실적인 인증, 같은 쿠폰의 중복 사용 시도를 찾아 운영자에게 알리는 기능입니다.',
    status: '미구현 — 현재는 서버에서 QR 허용 목록 검증과 쿠폰 1회 사용 제한만 적용됩니다.',
  },
  {
    id: 'report',
    title: '리포트 자동화',
    summary: '주간·월간 리포트(PDF) 자동 생성 및 이메일 발송',
    detail: '주간·월간 지표를 PDF로 만들어 지정한 담당자에게 자동 발송하는 기능입니다.',
    status: '부분 제공 — 선택 기간 CSV 내보내기만 가능합니다. PDF 생성과 이메일 발송은 미구현입니다.',
  },
  {
    id: 'live-map',
    title: '지도 실시간 현황',
    summary: '거점별 혼잡도(실시간), 안내 메시지 발송(대안 거점 추천)',
    detail: '거점별 현재 체류 인원과 혼잡도를 지도에 실시간으로 보여주고, 혼잡한 거점의 방문자에게 다른 거점을 안내하는 기능입니다.',
    status: '미구현 — 실시간 위치·체류 데이터 수집이 연결되어 있지 않습니다.',
  },
];
