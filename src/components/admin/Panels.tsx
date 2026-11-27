import { useMemo, useState, type ReactNode } from 'react';
import {
  Bar,
  CartesianGrid,
  ComposedChart,
  Line,
  ReferenceDot,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { CheckCircle2, FileText, Hourglass, Landmark, Star, Ticket, Users } from 'lucide-react';
import type { AdminSpotKey } from '../../data/adminDummyStats';
import {
  DEMO_ACTIVITY_LOG,
  DEMO_STATIC,
  EVENT_CAMPAIGN_START,
  EVENT_WEEKEND_PEAK,
  fmt,
  fmtPct,
  shortDate,
  type PeriodSummary,
} from '../../data/adminDashboardData';
import { C, CardShell, Modal } from './ui';

const deltaText = (s: PeriodSummary, v: string, suffix = '') =>
  s.isFullPeriod ? (
    <span className="text-[#1F8F52]">▲ {v}{suffix}</span>
  ) : (
    <span className="text-[#6B7C93]">선택 기간 기준</span>
  );

/* ------------------------------------------------------------------ KPI 5종 */
type KpiId = 'participants' | 'completion' | 'coupon' | 'satisfaction' | 'stay';

export function KpiRow({ summary }: { summary: PeriodSummary }) {
  const [open, setOpen] = useState<KpiId | null>(null);
  const avg = summary.dayCount > 0 ? summary.participants / summary.dayCount : 0;

  const cards: Array<{ id: KpiId; label: string; value: ReactNode; sub: ReactNode; icon: ReactNode }> = [
    {
      id: 'participants',
      label: '총 참가자',
      value: (
        <>
          {fmt(summary.participants)}
          <span className="ml-0.5 text-base font-bold">명</span>
        </>
      ),
      sub: summary.isFullPeriod ? <>{deltaText(summary, DEMO_STATIC.deltaParticipants)} (전월 대비)</> : deltaText(summary, ''),
      icon: <Users className="h-7 w-7" aria-hidden="true" />,
    },
    {
      id: 'completion',
      label: '4개 거점 인증 완료율',
      value: fmtPct(summary.completionRate),
      sub: deltaText(summary, DEMO_STATIC.deltaCompletion),
      icon: <CheckCircle2 className="h-7 w-7" aria-hidden="true" />,
    },
    {
      id: 'coupon',
      label: '쿠폰 발급·사용률',
      value: fmtPct(summary.couponUseRate),
      sub: (
        <>
          {deltaText(summary, DEMO_STATIC.deltaCoupon)}
          <span className="ml-1 text-[#6B7C93]">
            ({fmt(summary.couponUsed)} / {fmt(summary.couponIssued)}건)
          </span>
        </>
      ),
      icon: <Ticket className="h-7 w-7" aria-hidden="true" />,
    },
    {
      id: 'satisfaction',
      label: '만족도 (5점 만점)',
      value: (
        <>
          {DEMO_STATIC.satisfaction}
          <span className="ml-0.5 text-base font-bold">점</span>
        </>
      ),
      sub: <span className="text-[#6B7C93]">(응답률 {DEMO_STATIC.responseRate.toFixed(1)}%)</span>,
      icon: <Star className="h-7 w-7 fill-[#F28C18] text-[#F28C18]" aria-hidden="true" />,
    },
    {
      id: 'stay',
      label: '평균 체류 시간',
      value: DEMO_STATIC.avgStayLabel,
      sub: deltaText(summary, DEMO_STATIC.deltaStay),
      icon: <Hourglass className="h-7 w-7" aria-hidden="true" />,
    },
  ];

  const active = cards.find((c) => c.id === open);

  return (
    <>
      <section aria-label="핵심 지표" className="grid grid-cols-1 gap-3 min-[520px]:grid-cols-2 min-[900px]:grid-cols-3 min-[1360px]:grid-cols-5">
        {cards.map((c) => (
          <button
            key={c.id}
            type="button"
            onClick={() => setOpen(c.id)}
            className="flex min-w-0 items-center gap-3 rounded-2xl border border-[#D1C8B8] bg-[#F4F0E8] p-4 text-left shadow-xs transition duration-200 hover:scale-[1.02] hover:shadow-md motion-reduce:transition-none motion-reduce:hover:scale-100"
          >
            <span className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[#EAE2D0] text-[#1D2A3A]">
              {c.icon}
            </span>
            <span className="min-w-0">
              <span className="block text-[12.5px] font-bold text-[#2E4057]">{c.label}</span>
              <span className="block whitespace-nowrap text-[24px] font-extrabold leading-tight tabular-nums text-[#172638]">{c.value}</span>
              <span className="block text-[11.5px] font-semibold">{c.sub}</span>
            </span>
          </button>
        ))}
      </section>

      {active && (
        <Modal title={`${active.label} 상세`} onClose={() => setOpen(null)}>
          <KpiDetail id={active.id} summary={summary} avg={avg} />
        </Modal>
      )}
    </>
  );
}

function Row({ k, v }: { k: string; v: ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-3 border-b border-[#D1C8B8] py-2 text-sm last:border-0">
      <dt className="text-[#2E4057]">{k}</dt>
      <dd className="font-bold tabular-nums text-[#172638]">{v}</dd>
    </div>
  );
}

function KpiDetail({ id, summary, avg }: { id: KpiId; summary: PeriodSummary; avg: number }) {
  const peak = summary.daily.reduce((a, d) => (d.participants > a.participants ? d : a), summary.daily[0] ?? { date: '', participants: 0, label: '-', completionRate: 0 });
  const period = `${summary.range.from.replaceAll('-', '.')} ~ ${summary.range.to.replaceAll('-', '.')}`;
  return (
    <div className="space-y-3">
      <p className="text-xs text-[#4A627A]">조회 기간 {period} · 데모 데이터</p>
      <dl>
        {id === 'participants' && (
          <>
            <Row k="총 참가자" v={`${fmt(summary.participants)}명`} />
            <Row k="일평균" v={`${avg.toFixed(1)}명`} />
            <Row k="최다 방문일" v={`${shortDate(peak.date)} · ${fmt(peak.participants)}명`} />
            <Row
              k="직전 7일 대비"
              v={summary.weekOverWeek === null ? '비교 기간 없음' : `${summary.weekOverWeek >= 0 ? '+' : ''}${summary.weekOverWeek.toFixed(1)}%`}
            />
          </>
        )}
        {id === 'completion' &&
          summary.funnel.map((f) => <Row key={f.step} k={f.title} v={`${fmt(f.count)}명 (${fmtPct(f.rate)})`} />)}
        {id === 'coupon' && (
          <>
            {summary.categories.map((c) => (
              <Row key={c.category} k={c.category} v={`발급 ${fmt(c.issued)} · 사용 ${fmt(c.used)} (${fmtPct(c.rate)})`} />
            ))}
            <Row k="전체" v={`발급 ${fmt(summary.couponIssued)} · 사용 ${fmt(summary.couponUsed)} (${fmtPct(summary.couponUseRate)})`} />
          </>
        )}
        {id === 'satisfaction' && (
          <>
            <Row k="만족도" v={`${DEMO_STATIC.satisfaction} / 5.0점`} />
            <Row k="설문 응답률" v={`${DEMO_STATIC.responseRate.toFixed(1)}%`} />
          </>
        )}
        {id === 'stay' && <Row k="평균 체류 시간" v={DEMO_STATIC.avgStayLabel} />}
      </dl>
      {(id === 'satisfaction' || id === 'stay') && (
        <p className="rounded-lg bg-[#EAE2D0] px-3 py-2 text-xs text-[#2E4057]">
          이 지표는 일별 집계 데이터가 없어 기간을 바꿔도 전체 기간 데모 값으로 고정됩니다.
        </p>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ [1] 일별 추이 */
export function TrendCard({ summary }: { summary: PeriodSummary }) {
  const events = useMemo(
    () =>
      [
        { date: EVENT_WEEKEND_PEAK, label: '11/14 주말(방문 급증)' },
        { date: EVENT_CAMPAIGN_START, label: '11/19 홍보 캠페인 시작' },
      ]
        .map((e) => ({ ...e, point: summary.daily.find((d) => d.date === e.date) }))
        .filter((e) => e.point),
    [summary.daily]
  );

  return (
    <CardShell
      num={1}
      title="일별 참가자 추이 및 주요 이벤트"
      right={
        <span className="flex shrink-0 items-center gap-3 text-[11px] font-semibold text-[#2E4057]">
          <span className="inline-flex items-center gap-1">
            <span className="h-2.5 w-2.5 rounded-sm bg-[#A7BFF5]" aria-hidden="true" />
            참가자 수(명)
          </span>
          <span className="inline-flex items-center gap-1">
            <span className="h-0.5 w-4 bg-[#1D2A3A]" aria-hidden="true" />
            4개 거점 완료율(%)
          </span>
        </span>
      }
    >
      <div className="mb-1 flex min-h-[28px] flex-wrap gap-2">
        {events.length === 0 ? (
          <span className="text-[11px] text-[#6B7C93]">선택 기간에는 표시할 주요 이벤트가 없습니다.</span>
        ) : (
          events.map((e) => (
            <span key={e.date} className="inline-flex items-center gap-1 rounded-full border border-[#F28C18] bg-white px-2.5 py-0.5 text-[11px] font-bold text-[#172638]">
              <span className="h-2 w-2 rounded-full bg-[#F28C18]" aria-hidden="true" />
              {e.label}
            </span>
          ))
        )}
      </div>
      <div className="h-[260px] w-full" role="img" aria-label="일별 참가자 수 막대와 4개 거점 완료율 꺾은선 결합 차트">
        <ResponsiveContainer width="100%" height="100%" minWidth={0}>
          <ComposedChart data={summary.daily} margin={{ top: 10, right: 0, left: -16, bottom: 0 }}>
            <CartesianGrid stroke="#D1C8B8" strokeDasharray="3 3" vertical={false} />
            <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#4A627A' }} interval="preserveStartEnd" minTickGap={10} tickLine={false} />
            <YAxis yAxisId="left" tick={{ fontSize: 11, fill: '#4A627A' }} allowDecimals={false} tickLine={false} axisLine={false} />
            <YAxis
              yAxisId="right"
              orientation="right"
              domain={[0, 100]}
              ticks={[0, 20, 40, 60, 80, 100]}
              tickFormatter={(v) => `${v}%`}
              tick={{ fontSize: 11, fill: '#4A627A' }}
              tickLine={false}
              axisLine={false}
            />
            <Tooltip
              contentStyle={{ borderRadius: 10, border: '1px solid #D1C8B8', background: '#F4F0E8', fontSize: 12 }}
              formatter={(value, name) => (String(name).includes('%') ? [`${value}%`, name] : [`${value}명`, name])}
            />
            <Bar yAxisId="left" dataKey="participants" name="참가자 수(명)" fill="#A7BFF5" radius={[4, 4, 0, 0]} maxBarSize={26} />
            <Line yAxisId="right" type="monotone" dataKey="completionRate" name="4개 거점 완료율(%)" stroke="#1D2A3A" strokeWidth={2} dot={{ r: 2.5, fill: '#1D2A3A' }} />
            {events.map((e) => (
              <ReferenceDot key={e.date} yAxisId="right" x={shortDate(e.date)} y={e.point!.completionRate} r={7} fill="#F28C18" stroke="#fff" strokeWidth={2} />
            ))}
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </CardShell>
  );
}

/* ------------------------------------------------------------------ [2] 퍼널 */
const FUNNEL_FILL = ['#1D2A3A', '#2E4057', '#4A627A', '#F5C451'];
const FUNNEL_WIDTH = [100, 86, 72, 58];

export function FunnelCard({ summary }: { summary: PeriodSummary }) {
  const last = summary.funnel[3];
  return (
    <CardShell
      num={2}
      title="여정 단계별 전환율(퍼널)"
      right={<span className="shrink-0 text-[11px] font-semibold text-[#2E4057]">최종 전환 {fmtPct(last.rate)}</span>}
    >
      <ol className="flex flex-col items-center">
        {summary.funnel.map((f, i) => (
          <li key={f.step} className="flex w-full flex-col items-center">
            {i > 0 && (
              <div className="flex items-center gap-1.5 py-0.5 text-[11px] text-[#2E4057]" aria-hidden="true">
                <span className="text-[#F28C18]">▼</span>
                <span className="tabular-nums">
                  전환 {fmtPct(f.stepRate)} (이탈 {fmt(f.dropped)}명)
                </span>
              </div>
            )}
            <div className="group relative" style={{ width: `${FUNNEL_WIDTH[i]}%` }}>
              <button
                type="button"
                className="flex min-h-[58px] w-full flex-col items-center justify-center px-4 py-1.5 text-center outline-none focus-visible:ring-2 focus-visible:ring-[#F28C18]"
                style={{
                  backgroundColor: FUNNEL_FILL[i],
                  color: i === 3 ? C.text : '#fff',
                  clipPath: 'polygon(0 0, 100% 0, 95% 100%, 5% 100%)',
                }}
                aria-label={`${f.step}단계 ${f.title} ${fmt(f.count)}명, 시작 대비 ${fmtPct(f.rate)}`}
              >
                <span className="flex items-center gap-1.5 text-[13px] font-bold">
                  {i === 3 && <Landmark className="h-4 w-4" aria-hidden="true" />}
                  {f.title}
                </span>
                <span className="text-[13px] font-semibold tabular-nums">
                  {fmt(f.count)}명 ({fmtPct(f.rate)})
                </span>
              </button>
              <div
                role="tooltip"
                className="pointer-events-none absolute left-1/2 top-full z-20 mt-1 hidden w-56 -translate-x-1/2 rounded-lg border border-[#D1C8B8] bg-white px-3 py-2 text-xs text-[#172638] shadow-lg group-focus-within:block group-hover:block"
              >
                {i === 0 ? (
                  <>시작 단계 · 전체 참가자 <b>{fmt(f.count)}명</b></>
                ) : (
                  <>
                    직전 단계 대비 전환율 <b>{fmtPct(f.stepRate)}</b>
                    <br />
                    이탈 인원 <b>{fmt(f.dropped)}명</b>
                  </>
                )}
              </div>
            </div>
          </li>
        ))}
      </ol>
    </CardShell>
  );
}

/* ------------------------------------------------------------------ [7] 활동 로그 */
export function ActivityCard({ onMore }: { onMore: () => void }) {
  return (
    <CardShell
      num={7}
      title="실시간 활동 로그"
      right={
        <button
          type="button"
          onClick={onMore}
          className="shrink-0 rounded-full border border-[#D1C8B8] bg-white px-3 py-1 text-xs font-bold text-[#172638] hover:bg-[#EAE2D0]"
        >
          더보기 →
        </button>
      }
    >
      <ol className="relative ml-1.5 space-y-3.5 border-l-2 border-[#D1C8B8] pl-4">
        {DEMO_ACTIVITY_LOG.map((l, i) => (
          <li key={i} className="relative text-[13px]">
            <span aria-hidden="true" className="absolute -left-[22px] top-1 h-2.5 w-2.5 rounded-full bg-[#39B86C] ring-2 ring-[#F4F0E8]" />
            <span className="mr-2 font-bold tabular-nums text-[#4A627A]">{l.time}</span>
            <span className="font-semibold text-[#172638]">{l.text}</span>
            <span className="ml-1 text-[#6B7C93]">(사용자 {l.user})</span>
          </li>
        ))}
      </ol>
      <p className="mt-3 text-[11px] text-[#6B7C93]">※ 데모 로그입니다. 서버 이벤트와 연결되어 있지 않습니다.</p>
    </CardShell>
  );
}

/* ------------------------------------------------------------------ [3] 지도 & 순위 */
const PINS: Record<AdminSpotKey, { x: number; y: number }> = {
  jeollagamyeong: { x: 92, y: 78 },
  gyeonggijeon: { x: 205, y: 70 },
  wanpanbon: { x: 305, y: 96 },
  hanok_village: { x: 215, y: 160 },
  nambu_market: { x: 108, y: 205 },
  jeonju_museum: { x: 318, y: 214 },
};
const SPOT_TAG: Partial<Record<AdminSpotKey, string>> = { hanok_village: '시작', jeonju_museum: '최종' };

/** 0(낮음 · 블루) → 0.5(노랑) → 1(높음 · 레드) */
function heatColor(t: number): string {
  const lerp = (a: number[], b: number[], k: number) => a.map((v, i) => Math.round(v + (b[i] - v) * k));
  const blue = [94, 155, 240];
  const yellow = [247, 210, 106];
  const red = [229, 69, 59];
  const c = t < 0.5 ? lerp(blue, yellow, t / 0.5) : lerp(yellow, red, (t - 0.5) / 0.5);
  return `rgb(${c[0]}, ${c[1]}, ${c[2]})`;
}

export function SpotMapCard({ summary }: { summary: PeriodSummary }) {
  const [selected, setSelected] = useState<AdminSpotKey | null>(null);
  const ranked = useMemo(() => [...summary.spots].sort((a, b) => b.count - a.count), [summary.spots]);
  const max = Math.max(...summary.spots.map((s) => s.count), 1);
  const sel = selected ? summary.spots.find((s) => s.key === selected) : null;
  const selRank = sel ? ranked.findIndex((s) => s.key === sel.key) + 1 : 0;

  return (
    <CardShell num={3} title="거점별 방문·인증 현황 (지도 & 순위)" right={<span className="hidden shrink-0 text-[11px] text-[#6B7C93] sm:inline">시각화 데모 지도</span>}>
      <div className="@container">
        <div className="grid gap-3 @[440px]:grid-cols-[1.05fr_1fr]">
          <div>
            <div className="relative aspect-[4/3] w-full overflow-hidden rounded-xl border border-[#D1C8B8] bg-[#E9E3D3]">
              <svg viewBox="0 0 400 300" className="absolute inset-0 h-full w-full" role="img" aria-label="전주 원도심 거점별 방문 히트맵 (실제 축척 아님)">
                <defs>
                  {summary.spots.map((s) => (
                    <radialGradient key={s.key} id={`heat-${s.key}`}>
                      <stop offset="0%" stopColor={heatColor(s.count / max)} stopOpacity="0.85" />
                      <stop offset="100%" stopColor={heatColor(s.count / max)} stopOpacity="0" />
                    </radialGradient>
                  ))}
                </defs>
                <path d="M0 238C80 214 150 262 250 226S350 196 400 210" stroke="#9DBBE0" strokeWidth="12" fill="none" strokeLinecap="round" />
                <g stroke="#FFFFFF" strokeWidth="4" strokeLinecap="round" fill="none" opacity="0.9">
                  <path d="M0 118C90 126 170 112 260 128S360 134 400 126" />
                  <path d="M150 0C158 90 146 170 160 300" />
                  <path d="M262 0C250 80 270 160 258 300" />
                  <path d="M40 40L360 260" strokeWidth="2.5" opacity="0.7" />
                </g>
                {summary.spots.map((s) => (
                  <circle key={s.key} cx={PINS[s.key].x} cy={PINS[s.key].y} r={30 + (s.count / max) * 30} fill={`url(#heat-${s.key})`} />
                ))}
                {summary.spots.map((s) => {
                  const p = PINS[s.key];
                  const on = selected === s.key;
                  const isStart = s.key === 'hanok_village';
                  return (
                    <g
                      key={s.key}
                      role="button"
                      tabIndex={0}
                      aria-label={`${s.name} 상세 보기`}
                      aria-pressed={on}
                      className="cursor-pointer outline-none"
                      onClick={() => setSelected(on ? null : s.key)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          setSelected(on ? null : s.key);
                        }
                      }}
                    >
                      <circle cx={p.x} cy={p.y} r={on ? 11 : 8.5} fill={isStart ? C.orange : C.navy} stroke="#fff" strokeWidth="2.5" />
                      <circle cx={p.x} cy={p.y} r="2.8" fill="#fff" />
                      <text x={p.x} y={p.y - 14} textAnchor="middle" fontSize="12" fontWeight="700" fill={C.text} stroke="#F4F0E8" strokeWidth="3" paintOrder="stroke">
                        {s.name}
                      </text>
                    </g>
                  );
                })}
              </svg>
              {sel && (
                <div
                  role="status"
                  className="absolute z-10 w-36 -translate-x-1/2 -translate-y-full rounded-lg border border-[#D1C8B8] bg-white p-2 text-xs shadow-lg"
                  style={{
                    left: `min(max(${(PINS[sel.key].x / 400) * 100}%, 74px), calc(100% - 74px))`,
                    top: `max(${(PINS[sel.key].y / 300) * 100}%, 96px)`,
                    marginTop: '-14px',
                  }}
                >
                  <p className="font-bold text-[#172638]">
                    {sel.name}
                    {SPOT_TAG[sel.key] && <span className="ml-1 font-normal text-[#6B7C93]">({SPOT_TAG[sel.key]})</span>}
                  </p>
                  <p className="tabular-nums text-[#2E4057]">방문 {fmt(sel.count)}명</p>
                  <p className="tabular-nums text-[#2E4057]">인증률 {fmtPct(sel.rate)}</p>
                  <p className="text-[#6B7C93]">{selRank}위 / 6곳</p>
                </div>
              )}
            </div>
            <div className="mt-1.5 flex items-center gap-2 text-[11px] text-[#4A627A]">
              <span>방문 밀도 낮음</span>
              <span className="h-2 flex-1 rounded-full" style={{ background: `linear-gradient(90deg, ${heatColor(0)}, ${heatColor(0.5)}, ${heatColor(1)})` }} aria-hidden="true" />
              <span>높음</span>
            </div>
          </div>

          <div className="min-w-0 overflow-x-auto">
            <table className="w-full text-left text-[13px]">
              <thead>
                <tr className="border-b border-[#D1C8B8] text-[11px] font-bold text-[#4A627A]">
                  <th className="py-1.5 pr-1">순위</th>
                  <th className="py-1.5 pr-1">거점</th>
                  <th className="py-1.5 pr-1 text-right">방문(명)</th>
                  <th className="py-1.5 text-right">인증률</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#D1C8B8]">
                {ranked.map((s, i) => (
                  <tr
                    key={s.key}
                    onClick={() => setSelected(selected === s.key ? null : s.key)}
                    className={`cursor-pointer hover:bg-[#EAE2D0] ${selected === s.key ? 'bg-[#EAE2D0]' : ''}`}
                  >
                    <td className="py-2 pr-1 font-bold tabular-nums text-[#4A627A]">{i + 1}</td>
                    <td className="py-2 pr-1 font-semibold text-[#172638]">
                      {s.name}
                      {SPOT_TAG[s.key] && <span className="text-[11px] font-normal text-[#6B7C93]">({SPOT_TAG[s.key]})</span>}
                    </td>
                    <td className="py-2 pr-1 text-right tabular-nums">{fmt(s.count)}</td>
                    <td className="py-2 text-right font-bold tabular-nums">{fmtPct(s.rate)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </CardShell>
  );
}

/* ------------------------------------------------------------------ 도넛 공용 */
function Donut({
  segments,
  active,
  size = 160,
  stroke = 26,
  children,
}: {
  segments: Array<{ value: number; color: string }>;
  active?: number | null;
  size?: number;
  stroke?: number;
  children?: ReactNode;
}) {
  const sw = (stroke * 100) / size; // viewBox(100) 기준 선 두께
  const r = 50 - sw / 2 - 2;
  const circ = 2 * Math.PI * r;
  const total = segments.reduce((a, s) => a + s.value, 0) || 1;
  let offset = 0;
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg viewBox="0 0 100 100" className="h-full w-full -rotate-90" aria-hidden="true">
        <circle cx="50" cy="50" r={r} fill="none" stroke="#E4DCCB" strokeWidth={sw} />
        {segments.map((s, i) => {
          const len = (s.value / total) * circ;
          const dash = `${Math.max(len - 0.6, 0)} ${circ - Math.max(len - 0.6, 0)}`;
          const el = (
            <circle
              key={i}
              cx="50"
              cy="50"
              r={r}
              fill="none"
              stroke={s.color}
              strokeWidth={sw + (active === i ? 4 : 0)}
              strokeDasharray={dash}
              strokeDashoffset={-offset}
              opacity={active === null || active === undefined || active === i ? 1 : 0.35}
              style={{ transition: 'opacity 150ms, stroke-width 150ms' }}
            />
          );
          offset += len;
          return el;
        })}
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center text-center">{children}</div>
    </div>
  );
}

/* ------------------------------------------------------------------ [4] 전생 유형 분포 */
const TYPE_COLORS = ['#1D2A3A', '#F28C18', '#4A8F6B', '#7C5BA6', '#C0392B', '#2E7DA6', '#B58B2A', '#6B7C93'];

/**
 * 전생 유형 분포. realTypes(Supabase story_categories + past_life_results 실집계)가 있으면 그것을 보여 주고,
 * 없으면(운영자 확인 실패·DB 미연결) 기존 데모 분포로 대신한다.
 */
export function SurveyCard({ summary, realTypes }: { summary: PeriodSummary; realTypes?: { total: number; types: Array<{ category_code: string; name: string; count: number }> } | null }) {
  const [active, setActive] = useState<number | null>(null);
  const groups = realTypes
    ? realTypes.types.map((t, i) => ({
        id: t.category_code,
        label: t.name,
        color: TYPE_COLORS[i % TYPE_COLORS.length],
        count: t.count,
        rate: realTypes.total > 0 ? (t.count / realTypes.total) * 100 : 0,
      }))
    : summary.groups;
  const n = realTypes ? realTypes.total : summary.surveyN;
  return (
    <CardShell num={4} title="설문 결과: 전생 유형 분포">
      <p className="mb-2 text-[11.5px] text-[#4A627A]">
        {realTypes ? 'Supabase 실집계 · 전체 기간 누적' : '데모 데이터 (DB 집계를 불러오지 못했습니다)'}
      </p>
      {realTypes && realTypes.total === 0 && (
        <p className="mb-2 rounded-lg border border-[#D1C8B8] bg-white px-3 py-2 text-xs text-[#4A627A]">아직 저장된 전생 결과가 없습니다.</p>
      )}
      <div className="@container">
        <div className="flex flex-col items-center gap-4 @[380px]:flex-row @[380px]:justify-center">
          <Donut segments={groups.map((g) => ({ value: g.count, color: g.color }))} active={active} size={170} stroke={30}>
            <span className="text-[12px] font-bold leading-tight text-[#172638]">
              전생 유형
              <br />
              분포
            </span>
            <span className="text-[11px] tabular-nums text-[#4A627A]">(n = {fmt(n)})</span>
          </Donut>
          <ul className="space-y-1.5">
            {groups.map((g, i) => (
              <li key={g.id}>
                <button
                  type="button"
                  aria-pressed={active === i}
                  onClick={() => setActive(active === i ? null : i)}
                  onMouseEnter={() => setActive(i)}
                  onMouseLeave={() => setActive(null)}
                  title={`${g.label} ${fmt(g.count)}명`}
                  className={`flex min-h-[32px] w-full items-center gap-2 rounded-md px-2 text-[13px] hover:bg-[#EAE2D0] ${active === i ? 'bg-[#EAE2D0] font-bold' : ''}`}
                >
                  <span className="h-3 w-3 shrink-0 rounded-sm" style={{ backgroundColor: g.color }} aria-hidden="true" />
                  <span className="text-[#172638]">{g.label}</span>
                  <span className="ml-auto pl-3 font-semibold tabular-nums text-[#2E4057]">{fmtPct(g.rate)}</span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </CardShell>
  );
}

/* ------------------------------------------------------------------ [5] 쿠폰 카테고리 */
export function CouponCard({ summary }: { summary: PeriodSummary }) {
  const maxIssued = Math.max(...summary.categories.map((c) => c.issued), 1);
  return (
    <CardShell
      num={5}
      title="4대 카테고리별 쿠폰 발급·사용"
      right={
        <span className="hidden shrink-0 items-center gap-2 text-[11px] font-semibold text-[#2E4057] sm:flex">
          <span className="inline-flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-sm bg-[#1D2A3A]" aria-hidden="true" />사용</span>
          <span className="inline-flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-sm bg-[#FFAD60]" aria-hidden="true" />미사용</span>
        </span>
      }
    >
      <p className="mb-2 text-xs text-[#4A627A]">
        총 발급 {fmt(summary.couponIssued)}건 · 사용 {fmt(summary.couponUsed)}건
      </p>
      <div className="mb-3 flex items-center gap-3">
        <Donut
          size={84}
          stroke={13}
          segments={[
            { value: summary.couponUsed, color: C.navy },
            { value: Math.max(summary.couponIssued - summary.couponUsed, 0), color: C.orange2 },
          ]}
        >
          <span className="text-[13px] font-extrabold tabular-nums text-[#172638]">{fmtPct(summary.couponUseRate)}</span>
        </Donut>
        <p className="rounded-lg border border-[#F28C18] bg-[#FFF1DE] px-3 py-2 text-[13px] font-bold text-[#172638]">
          전체 쿠폰 사용률 {fmtPct(summary.couponUseRate)} <span className="font-semibold text-[#4A627A]">(발급 대비)</span>
        </p>
      </div>
      <ul className="space-y-2.5">
        {summary.categories.map((c) => (
          <li key={c.category}>
            <div className="mb-1 flex items-baseline justify-between gap-2 text-[13px]">
              <span className="font-bold text-[#172638]">{c.category}</span>
              <span className="text-[11.5px] tabular-nums text-[#2E4057]">
                발급 {fmt(c.issued)} · 사용 {fmt(c.used)} ({fmtPct(c.rate)})
              </span>
            </div>
            <div className="flex h-3 overflow-hidden rounded-full bg-[#E4DCCB]" style={{ width: `${Math.max((c.issued / maxIssued) * 100, 4)}%` }}>
              <div className="h-full bg-[#1D2A3A]" style={{ width: `${c.rate}%` }} title={`사용 ${fmt(c.used)}건`} />
              <div className="h-full flex-1 bg-[#FFAD60]" title={`미사용 ${fmt(c.issued - c.used)}건`} />
            </div>
          </li>
        ))}
      </ul>
    </CardShell>
  );
}

/* ------------------------------------------------------------------ [6] 제휴 상점 TOP 5 */
export function StoreCard({ summary }: { summary: PeriodSummary }) {
  const [sort, setSort] = useState<'issued' | 'rate'>('issued');
  const rows = useMemo(
    () => [...summary.stores].sort((a, b) => (sort === 'issued' ? b.issued - a.issued : b.rate - a.rate)).slice(0, 5),
    [summary.stores, sort]
  );
  return (
    <CardShell
      num={6}
      title="박물관 방면 제휴 상점 TOP 5"
      right={
        <div role="group" aria-label="정렬 기준" className="flex shrink-0 overflow-hidden rounded-full border border-[#D1C8B8] text-[11px] font-bold">
          {(
            [
              ['issued', '발급순'],
              ['rate', '사용률순'],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              aria-pressed={sort === id}
              onClick={() => setSort(id)}
              className={`min-h-[28px] px-2.5 ${sort === id ? 'bg-[#1D2A3A] text-white' : 'bg-white text-[#172638] hover:bg-[#EAE2D0]'}`}
            >
              {label}
            </button>
          ))}
        </div>
      }
    >
      <p className="mb-2 text-[11px] text-[#6B7C93]">
        {sort === 'issued' ? '발급 수' : '사용률'} 기준 · 쿠폰 마스터(coupons.ts)의 제휴 예정 모델 (실제 제휴 계약 아님)
      </p>
      <div className="@container overflow-x-auto">
        <table className="w-full text-left text-[13px]">
          <thead>
            <tr className="border-b border-[#D1C8B8] text-[11px] font-bold text-[#4A627A]">
              <th className="py-1.5 pr-1">#</th>
              <th className="py-1.5 pr-2">제휴 상점</th>
              <th className="hidden py-1.5 pr-2 @lg:table-cell">위치 권역</th>
              <th className="py-1.5 pr-2 text-right">발급(건)</th>
              <th className="py-1.5 text-right">사용률</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#D1C8B8]">
            {rows.map((s, i) => (
              <tr key={s.templateId}>
                <td className="py-2 pr-1 font-bold tabular-nums text-[#4A627A]">{i + 1}</td>
                <td className="py-2 pr-2 font-semibold text-[#172638]">
                  {s.name}
                  <span className="block text-[11px] font-normal text-[#6B7C93] @lg:hidden">{s.area}</span>
                </td>
                <td className="hidden py-2 pr-2 text-xs text-[#2E4057] @lg:table-cell">{s.area}</td>
                <td className="py-2 pr-2 text-right tabular-nums">{fmt(s.issued)}</td>
                <td className="py-2 text-right font-bold tabular-nums">{fmtPct(s.rate)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </CardShell>
  );
}

/* ------------------------------------------------------------------ 동향 요약 */
export function SummaryCard({ summary }: { summary: PeriodSummary }) {
  const avg = summary.dayCount > 0 ? summary.participants / summary.dayCount : 0;
  const wow = summary.weekOverWeek;
  const items: ReactNode[] = [
    wow === null ? (
      <>
        선택 기간 참가자 <b>{fmt(summary.participants)}명</b> (일평균 {avg.toFixed(1)}명)
      </>
    ) : (
      <>
        참가자 수 직전 7일 대비 <b>{wow >= 0 ? '+' : ''}{wow.toFixed(1)}%</b> {wow >= 0 ? '상승' : '하락'}
      </>
    ),
    <>
      4개 거점 인증 완료율 <b>{fmtPct(summary.completionRate)}</b> {summary.isFullPeriod && <>(▲ {DEMO_STATIC.deltaCompletion})</>}
    </>,
    <>
      쿠폰 사용률 <b>{fmtPct(summary.couponUseRate)}</b> {summary.isFullPeriod && <>(▲ {DEMO_STATIC.deltaCoupon})</>}
    </>,
    <>
      평균 체류 시간 <b>{DEMO_STATIC.avgStayLabel}</b> {summary.isFullPeriod ? <>(▲ {DEMO_STATIC.deltaStay})</> : <>(전체 기간 데모값)</>}
    </>,
    <>
      만족도 <b>{DEMO_STATIC.satisfaction}점</b> (응답률 {DEMO_STATIC.responseRate.toFixed(1)}%)
    </>,
  ];
  return (
    <section className="h-full min-w-0 rounded-2xl border border-[#D1C8B8] bg-[#F4F0E8] p-4 shadow-xs">
      <h2 className="mb-3 flex items-center gap-2 text-[15px] font-bold text-[#172638]">
        <FileText className="h-5 w-5 text-[#2E4057]" aria-hidden="true" />
        동향 요약 (한눈에 보기)
      </h2>
      <ul className="space-y-3">
        {items.map((node, i) => (
          <li key={i} className="flex items-start gap-2.5 text-[13.5px] text-[#172638]">
            <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-[#39B86C]" aria-hidden="true" />
            <span>{node}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}
