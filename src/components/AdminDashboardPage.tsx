import { FormEvent, ReactNode, useMemo, useState } from 'react';
import { ArrowLeft, ArrowRight, Check, Lock, RefreshCw, Sparkles } from 'lucide-react';
import { USE_LOCAL_BACKEND } from '../config/features';
import { CHARACTERS } from '../data/characters';
import {
  ADMIN_BASE_PARTICIPANTS,
  ADMIN_CHARACTER_COUNTS,
  ADMIN_COUPON_CATEGORY_STATS,
  ADMIN_FNB_SHARE_BEFORE,
  ADMIN_FUNNEL,
  ADMIN_FUNNEL_INSIGHT,
  ADMIN_KPIS,
  ADMIN_NON_FNB_CATEGORIES,
  ADMIN_PARTNER_STORES,
  ADMIN_POSITIVE_KEYWORDS,
  ADMIN_SPOT_VISITS,
  ADMIN_WALL_QUEUE,
} from '../data/adminDummyStats';
import { apiFetch, getAdminLiveSnapshot } from '../utils/localApi';
import { AdminOpsTools } from './AdminOpsTools';

interface AdminDashboardPageProps {
  onBackToApp: () => void;
}

const NAVY = '#14213D';
const BURGUNDY = '#7F1D1D';

const fmt = (n: number) => n.toLocaleString('ko-KR');
const pct = (part: number, whole: number) => (whole > 0 ? (part / whole) * 100 : 0);

function LiveBadge({ children }: { children: ReactNode }) {
  return (
    <span
      className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-bold text-white whitespace-nowrap"
      style={{ backgroundColor: BURGUNDY }}
    >
      <Sparkles className="w-3 h-3" aria-hidden="true" />
      {children}
    </span>
  );
}

function SectionCard({ title, subtitle, children }: { title: string; subtitle?: string; children: ReactNode }) {
  return (
    <section className="rounded-2xl border border-[#E5DDD0] bg-white p-5 sm:p-6 space-y-4 shadow-sm">
      <div className="border-b border-[#F0EAE0] pb-3">
        <h2 className="font-serif-kr text-lg font-bold" style={{ color: NAVY }}>
          {title}
        </h2>
        {subtitle && <p className="text-xs text-[#57534E] mt-0.5">{subtitle}</p>}
      </div>
      {children}
    </section>
  );
}

export function AdminDashboardPage({ onBackToApp }: AdminDashboardPageProps) {
  // 서버 모드에서만 관리자 코드를 요구한다. 로컬 모드(발표·시연)는 바로 대시보드를 연다.
  const [authenticated, setAuthenticated] = useState(USE_LOCAL_BACKEND);
  const [passcode, setPasscode] = useState('');
  const [authError, setAuthError] = useState<string | null>(null);
  const [authLoading, setAuthLoading] = useState(false);

  const [liveOn, setLiveOn] = useState(true);
  const [snapshot, setSnapshot] = useState(() => getAdminLiveSnapshot());
  const [wallApproved, setWallApproved] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(ADMIN_WALL_QUEUE.map((w) => [w.id, w.approved]))
  );

  const live = liveOn ? snapshot : null;
  const refresh = () => setSnapshot(getAdminLiveSnapshot());

  const handleLogin = async (e: FormEvent) => {
    e.preventDefault();
    setAuthLoading(true);
    setAuthError(null);
    try {
      const res = await apiFetch('/api/admin/stats', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ passcode: passcode.trim() }),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(body.error || '인증에 실패했습니다.');
      }
      setAuthenticated(true);
    } catch (err) {
      setAuthError(err instanceof Error ? err.message : '인증 오류');
    } finally {
      setAuthLoading(false);
    }
  };

  // ---- 가상 누적 + 내 시연 기록 합산 ------------------------------------------------------
  const view = useMemo(() => {
    const participants = ADMIN_BASE_PARTICIPANTS + (live?.hasSession ? 1 : 0);

    const spots = ADMIN_SPOT_VISITS.map((s) => {
      const justVisited =
        !!live &&
        (s.key === 'hanok_village' ? live.hasSession : live.visitedSpotIds.includes(s.key as never));
      return { ...s, count: s.count + (justVisited ? 1 : 0), justVisited };
    });

    const categories = ADMIN_COUPON_CATEGORY_STATS.map((c) => ({
      ...c,
      issued: c.issued + (live?.issuedByCategory[c.category] ?? 0),
      used: c.used + (live?.usedByCategory[c.category] ?? 0),
      liveIssued: live?.issuedByCategory[c.category] ?? 0,
    }));
    const issuedTotal = categories.reduce((a, c) => a + c.issued, 0);
    const usedTotal = categories.reduce((a, c) => a + c.used, 0);
    const nonFnbIssued = categories
      .filter((c) => ADMIN_NON_FNB_CATEGORIES.includes(c.category))
      .reduce((a, c) => a + c.issued, 0);

    const stores = ADMIN_PARTNER_STORES.map((s) => ({
      ...s,
      issued: s.issued + (live?.issuedByTemplate[s.templateId] ?? 0),
      used: s.used + (live?.usedByTemplate[s.templateId] ?? 0),
      liveIssued: live?.issuedByTemplate[s.templateId] ?? 0,
    })).sort((a, b) => b.issued - a.issued);

    const characters = CHARACTERS.map((c) => {
      const isMine = !!live && live.characterId === c.id;
      return {
        id: c.id,
        title: c.title,
        emoji: c.emoji,
        count: (ADMIN_CHARACTER_COUNTS[c.id] ?? 0) + (isMine ? 1 : 0),
        isMine,
      };
    });
    const characterTotal = characters.reduce((a, c) => a + c.count, 0);

    return {
      participants,
      spots,
      categories,
      issuedTotal,
      usedTotal,
      nonFnbShare: pct(nonFnbIssued, issuedTotal),
      stores,
      characters,
      characterTotal,
    };
  }, [live]);

  const wallItems = useMemo(() => {
    const items = ADMIN_WALL_QUEUE.map((w) => ({ ...w, isLive: false }));
    if (live?.mediaWallAccepted) {
      items.unshift({
        id: 'live',
        alias: live.visitorName || '내 시연 기록',
        characterTitle: live.characterId
          ? CHARACTERS.find((c) => c.id === live.characterId)?.title ?? '내 전생'
          : '내 전생',
        submittedLabel: '방금',
        approved: false,
        isLive: true,
      });
    }
    return items;
  }, [live]);

  // ---- 서버 모드 인증 화면 ---------------------------------------------------------------
  if (!authenticated) {
    return (
      <div className="min-h-app hanji-texture flex items-center justify-center px-4 py-10">
        <form
          onSubmit={handleLogin}
          className="w-full max-w-md rounded-2xl border border-[#E5DDD0] bg-white p-6 sm:p-8 shadow-sm space-y-5"
        >
          <div className="space-y-1.5">
            <div className="flex items-center gap-2 text-xs font-semibold text-[#9A3412]">
              <Lock className="w-4 h-4" aria-hidden="true" />
              <span>관리자 전용 접근</span>
            </div>
            <h1 className="font-serif-kr text-2xl font-bold text-[#1C1917]">전생여지도 운영 현황</h1>
          </div>
          <input
            id="admin-passcode"
            type="password"
            aria-label="관리자 인증 코드"
            value={passcode}
            onChange={(e) => setPasscode(e.target.value)}
            placeholder="인증 코드를 입력하세요"
            className="w-full min-h-[48px] px-4 py-2.5 rounded-xl border border-[#D6CEBE] bg-[#FBF8F2] text-base"
          />
          {authError && (
            <p role="alert" className="text-xs font-medium text-[#9A3412]">
              {authError}
            </p>
          )}
          <div className="flex flex-col gap-2">
            <button
              type="submit"
              disabled={authLoading}
              className="w-full min-h-[48px] rounded-xl text-white font-semibold text-sm"
              style={{ backgroundColor: NAVY }}
            >
              {authLoading ? '확인 중...' : '운영 대시보드 열기'}
            </button>
            <button
              type="button"
              onClick={onBackToApp}
              className="w-full min-h-[44px] rounded-xl border border-[#D6CEBE] bg-[#FBF8F2] text-xs font-semibold text-[#1C1917]"
            >
              체험 화면으로 돌아가기
            </button>
          </div>
        </form>
      </div>
    );
  }

  const maxSpot = Math.max(...view.spots.map((s) => s.count), 1);
  const maxCategoryIssued = Math.max(...view.categories.map((c) => c.issued), 1);
  const fnbShare = 100 - view.nonFnbShare;
  const donutR = 40;
  const donutC = 2 * Math.PI * donutR;
  const half = Math.ceil(view.characters.length / 2);

  return (
    <div className="min-h-app hanji-texture flex flex-col">
      <header className="sticky top-0 z-20 border-b border-[#0B1426] shadow-sm" style={{ backgroundColor: NAVY }}>
        <div className="mx-auto w-full max-w-6xl px-6 py-3 flex flex-wrap items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[11px] tracking-widest text-[#E8D9B5]">JEONJU YEOJIDO · OPERATIONS</p>
            <h1 className="font-serif-kr text-xl font-bold text-white">전생여지도 운영자 대시보드</h1>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2">
              <span id="live-toggle-label" className="text-xs font-semibold text-[#F5EFE6] whitespace-nowrap">
                내 시연 기록 실시간 합산 {liveOn ? 'ON' : 'OFF'}
              </span>
              <button
                type="button"
                role="switch"
                aria-checked={liveOn}
                aria-labelledby="live-toggle-label"
                onClick={() => {
                  if (!liveOn) refresh();
                  setLiveOn((v) => !v);
                }}
                className={`relative h-7 w-12 rounded-full transition-colors ${liveOn ? 'bg-[#B45309]' : 'bg-[#57534E]'}`}
              >
                <span
                  className={`absolute top-0.5 left-0.5 h-6 w-6 rounded-full bg-white shadow transition-transform ${
                    liveOn ? 'translate-x-5' : ''
                  }`}
                />
              </button>
            </div>
            <button
              type="button"
              onClick={refresh}
              className="min-h-[40px] px-3 rounded-lg border border-white/30 text-xs font-semibold text-white hover:bg-white/10 inline-flex items-center gap-1.5"
            >
              <RefreshCw className="w-3.5 h-3.5" aria-hidden="true" />
              <span>다시 읽기</span>
            </button>
            <button
              type="button"
              onClick={onBackToApp}
              className="min-h-[40px] px-4 rounded-lg bg-[#F5EFE6] text-xs font-bold text-[#14213D] hover:bg-white inline-flex items-center gap-1.5"
            >
              <ArrowLeft className="w-3.5 h-3.5" aria-hidden="true" />
              <span>체험 화면으로 돌아가기</span>
            </button>
          </div>
        </div>
      </header>

      <main className="flex-1 mx-auto w-full max-w-6xl px-6 py-8 space-y-6">
        <p className="rounded-xl border border-[#D6CEBE] bg-[#F5EFE6] px-4 py-3 text-xs text-[#44403C]">
          발표·시연용 <strong>가상 누적 데이터</strong>(기준 참여자 {fmt(ADMIN_BASE_PARTICIPANTS)}명)입니다.
          {liveOn
            ? snapshot.hasSession
              ? ' 이 브라우저에서 방금 체험한 기록이 +1 로 합산되어 있습니다.'
              : ' 이 브라우저에 진행 중인 체험 기록이 아직 없습니다.'
            : ' 내 시연 기록 합산이 꺼져 있어 가상 수치만 표시합니다.'}
        </p>

        {/* 1단: KPI */}
        <section aria-label="4대 핵심 성과 지표" className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {ADMIN_KPIS.map((k) => (
            <div
              key={k.id}
              className="rounded-2xl border border-[#E5DDD0] border-t-4 bg-white p-5 space-y-2 shadow-sm"
              style={{ borderTopColor: k.id === 'coupon-use' || k.id === 'satisfaction' ? BURGUNDY : NAVY }}
            >
              <p className="text-xs font-semibold text-[#44403C]">{k.label}</p>
              <p className="font-mono-tabular text-3xl font-bold" style={{ color: NAVY }}>
                {k.value}
                <span className="text-base font-semibold text-[#57534E]">{k.unit}</span>
              </p>
              <p className="text-xs leading-relaxed text-[#57534E]">{k.description}</p>
            </div>
          ))}
        </section>

        {/* 2단: 거점별 QR 인증 / 퍼널 */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <SectionCard
            title="거점별 QR 인증 비교"
            subtitle={`기준 참여자 ${fmt(view.participants)}명 대비 비율`}
          >
            <ul className="space-y-3">
              {view.spots.map((s) => (
                <li key={s.key} className="space-y-1">
                  <div className="flex items-center justify-between gap-2 text-sm">
                    <span className="font-semibold text-[#1C1917] flex items-center gap-1.5 flex-wrap">
                      {s.name}
                      {s.tag && <span className="text-[11px] font-medium text-[#78716C]">({s.tag})</span>}
                      {s.justVisited && <LiveBadge>방금 방문</LiveBadge>}
                    </span>
                    <span className="font-mono-tabular text-xs text-[#44403C] whitespace-nowrap">
                      {fmt(s.count)}명 · {pct(s.count, view.participants).toFixed(1)}%
                    </span>
                  </div>
                  <div className="h-3 w-full rounded-full bg-[#EFE8DC] overflow-hidden">
                    <div
                      className="h-full rounded-full"
                      style={{
                        width: `${(s.count / maxSpot) * 100}%`,
                        backgroundColor: s.key === 'jeonju_museum' ? BURGUNDY : NAVY,
                      }}
                    />
                  </div>
                </li>
              ))}
            </ul>
          </SectionCard>

          <SectionCard title="관광객 이동 경로 퍼널" subtitle="한옥마을 → 원도심 → 박물관 권역">
            <ol className="space-y-2">
              {ADMIN_FUNNEL.map((f, i) => (
                <li key={f.step}>
                  <div
                    className="rounded-xl px-4 py-3 flex items-center justify-between gap-3 text-white"
                    style={{
                      backgroundColor: i === ADMIN_FUNNEL.length - 1 ? BURGUNDY : NAVY,
                      width: `${Math.max(60, 100 - i * 11)}%`,
                      opacity: 1 - i * 0.07,
                    }}
                  >
                    <span className="text-sm font-semibold">
                      {f.step}단계: {f.title}
                    </span>
                    <span className="font-mono-tabular text-base font-bold">{f.percent}%</span>
                  </div>
                  {i < ADMIN_FUNNEL.length - 1 && (
                    <div className="py-1 pl-4 text-[#78716C]" aria-hidden="true">
                      <ArrowRight className="w-4 h-4 rotate-90" />
                    </div>
                  )}
                </li>
              ))}
            </ol>
            <p
              className="rounded-xl border px-4 py-3 text-sm font-semibold"
              style={{ borderColor: BURGUNDY, color: BURGUNDY, backgroundColor: '#FDF2F2' }}
            >
              💡 “{ADMIN_FUNNEL_INSIGHT}”
            </p>
          </SectionCard>
        </div>

        {/* 3단: 쿠폰 */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <SectionCard title="4대 카테고리별 쿠폰 발급·사용" subtitle={`총 발급 ${fmt(view.issuedTotal)}건 · 사용 ${fmt(view.usedTotal)}건`}>
            <div className="flex items-center gap-4 rounded-xl bg-[#F5EFE6] p-3">
              <svg viewBox="0 0 100 100" className="w-20 h-20 shrink-0" role="img" aria-label={`비식음료 비중 ${Math.round(view.nonFnbShare)}%`}>
                <circle cx="50" cy="50" r={donutR} fill="none" stroke={NAVY} strokeWidth="16" opacity="0.85" />
                <circle
                  cx="50"
                  cy="50"
                  r={donutR}
                  fill="none"
                  stroke={BURGUNDY}
                  strokeWidth="16"
                  strokeDasharray={`${(view.nonFnbShare / 100) * donutC} ${donutC}`}
                  transform="rotate(-90 50 50)"
                />
                <text x="50" y="55" textAnchor="middle" fontSize="18" fontWeight="700" fill={NAVY}>
                  {Math.round(view.nonFnbShare)}%
                </text>
              </svg>
              <div className="space-y-1.5 text-xs text-[#44403C]">
                <span
                  className="inline-block rounded-full px-3 py-1 text-xs font-bold text-white"
                  style={{ backgroundColor: BURGUNDY }}
                >
                  비식음료 소비 비중 {100 - ADMIN_FNB_SHARE_BEFORE}% → {Math.round(view.nonFnbShare)}% 확대
                </span>
                <p>
                  식음료 편중 {ADMIN_FNB_SHARE_BEFORE}% → {Math.round(fnbShare)}%로 분산 (숙박·지역상품권·공예 포함)
                </p>
              </div>
            </div>
            <ul className="space-y-3">
              {view.categories.map((c) => (
                <li key={c.category} className="space-y-1">
                  <div className="flex items-center justify-between text-sm">
                    <span className="font-semibold text-[#1C1917]">{c.category}</span>
                    <span className="font-mono-tabular text-xs text-[#44403C]">
                      발급 {fmt(c.issued)} · 사용 {fmt(c.used)} ({pct(c.used, c.issued).toFixed(1)}%)
                    </span>
                  </div>
                  <div className="relative h-3 w-full rounded-full bg-[#EFE8DC] overflow-hidden">
                    <div
                      className="absolute inset-y-0 left-0 rounded-full bg-[#9AA7C2]"
                      style={{ width: `${(c.issued / maxCategoryIssued) * 100}%` }}
                    />
                    <div
                      className="absolute inset-y-0 left-0 rounded-full"
                      style={{ width: `${(c.used / maxCategoryIssued) * 100}%`, backgroundColor: NAVY }}
                    />
                  </div>
                  {c.liveIssued > 0 && <LiveBadge>내 쿠폰 +{c.liveIssued}</LiveBadge>}
                </li>
              ))}
            </ul>
            <p className="text-[11px] text-[#78716C]">연한 막대 = 발급, 진한 막대 = 실사용</p>
          </SectionCard>

          <SectionCard title="박물관 방면 제휴 상점 TOP 5" subtitle="발급 수 기준 · 쿠폰 마스터(coupons.ts) 제휴 예정 모델">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-[#E5DDD0] text-xs text-[#78716C]">
                    <th className="py-2 pr-2">#</th>
                    <th className="py-2 pr-2">제휴 상점</th>
                    <th className="py-2 px-2">위치 권역</th>
                    <th className="py-2 px-2 text-right">발급</th>
                    <th className="py-2 pl-2 text-right">사용률</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#F0EAE0]">
                  {view.stores.map((s, i) => (
                    <tr key={s.templateId}>
                      <td className="py-2.5 pr-2 font-mono-tabular text-[#78716C]">{i + 1}</td>
                      <td className="py-2.5 pr-2 font-semibold text-[#1C1917]">
                        {s.name}
                        <span className="block text-[11px] font-normal text-[#78716C]">{s.category}</span>
                        {s.liveIssued > 0 && <LiveBadge>내 쿠폰 +{s.liveIssued}</LiveBadge>}
                      </td>
                      <td className="py-2.5 px-2 text-xs text-[#57534E]">{s.area}</td>
                      <td className="py-2.5 px-2 text-right font-mono-tabular">{fmt(s.issued)}</td>
                      <td className="py-2.5 pl-2 text-right font-mono-tabular font-bold" style={{ color: NAVY }}>
                        {pct(s.used, s.issued).toFixed(1)}%
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </SectionCard>
        </div>

        {/* 4단: 캐릭터 */}
        <SectionCard
          title="전생 캐릭터 10종 배정 통계"
          subtitle={`누적 배정 ${fmt(view.characterTotal)}명 (박물관 최종 도착자 기준)`}
        >
          <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-3">
            {[view.characters.slice(0, half), view.characters.slice(half)].map((col, ci) => (
              <ul key={ci} className="space-y-3">
                {col.map((c) => (
                  <li key={c.id} className="space-y-1">
                    <div className="flex items-center justify-between gap-2 text-sm">
                      <span className="font-semibold text-[#1C1917] flex items-center gap-1.5 flex-wrap">
                        <span className="font-mono-tabular text-xs text-[#78716C]">{c.id}.</span>
                        {c.title}
                        {c.isMine && <LiveBadge>현재 내 전생 +1</LiveBadge>}
                      </span>
                      <span className="font-mono-tabular text-xs text-[#44403C] whitespace-nowrap">
                        {fmt(c.count)}명 · {pct(c.count, view.characterTotal).toFixed(1)}%
                      </span>
                    </div>
                    <div className="h-2.5 w-full rounded-full bg-[#EFE8DC] overflow-hidden">
                      <div
                        className="h-full rounded-full"
                        style={{
                          width: `${pct(c.count, view.characterTotal) * 5}%`,
                          backgroundColor: c.isMine ? BURGUNDY : NAVY,
                        }}
                      />
                    </div>
                  </li>
                ))}
              </ul>
            ))}
          </div>
          <p className="text-[11px] text-[#78716C]">막대 길이 = 점유율 × 5 (최대 20% 기준)</p>
        </SectionCard>

        {/* 5단: 키워드 / 미디어월 */}
        <SectionCard title="방문객 만족도 키워드 & 미디어월 송출 관리">
          <div className="flex flex-wrap gap-2">
            {ADMIN_POSITIVE_KEYWORDS.map((k) => (
              <span
                key={k}
                className="rounded-full border border-[#D6CEBE] bg-[#F5EFE6] px-3 py-1.5 text-sm font-semibold"
                style={{ color: NAVY }}
              >
                {k}
              </span>
            ))}
          </div>
          <ul className="divide-y divide-[#F0EAE0] rounded-xl border border-[#E5DDD0]">
            {wallItems.map((w) => {
              const approved = wallApproved[w.id] ?? w.approved;
              return (
                <li key={w.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-[#1C1917] flex items-center gap-1.5 flex-wrap">
                      {w.alias}
                      {w.isLive && <LiveBadge>방금 등록</LiveBadge>}
                    </p>
                    <p className="text-xs text-[#57534E]">
                      {w.characterTitle} · {w.submittedLabel}
                    </p>
                  </div>
                  <button
                    type="button"
                    aria-pressed={approved}
                    onClick={() => setWallApproved((prev) => ({ ...prev, [w.id]: !approved }))}
                    className={`min-h-[38px] px-4 rounded-lg text-xs font-bold inline-flex items-center gap-1.5 border ${
                      approved
                        ? 'text-white border-transparent'
                        : 'bg-white text-[#44403C] border-[#D6CEBE] hover:bg-[#F5EFE6]'
                    }`}
                    style={approved ? { backgroundColor: NAVY } : undefined}
                  >
                    {approved && <Check className="w-3.5 h-3.5" aria-hidden="true" />}
                    {approved ? '송출 승인됨' : '승인 대기 · 승인하기'}
                  </button>
                </li>
              );
            })}
          </ul>
          <p className="text-[11px] text-[#78716C]">승인 토글은 발표용 화면 표시이며, 실제 /wall 송출 목록에는 반영되지 않습니다.</p>
        </SectionCard>

        <details className="rounded-2xl border border-[#E5DDD0] bg-white/70 p-4">
          <summary className="cursor-pointer text-sm font-bold" style={{ color: NAVY }}>
            현장 운영 도구 (QR코드 발급{USE_LOCAL_BACKEND ? '' : ' · 쿠폰 바코드 검증'})
          </summary>
          <div className="pt-4">
            <AdminOpsTools showCouponRedeem={!USE_LOCAL_BACKEND} passcode={passcode} />
          </div>
        </details>
      </main>
    </div>
  );
}
