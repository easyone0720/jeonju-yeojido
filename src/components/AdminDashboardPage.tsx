import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react';
import { Download, Lock } from 'lucide-react';
import { USE_LOCAL_BACKEND } from '../config/features';
import { CHARACTERS } from '../data/characters';
import {
  ADMIN_MENU_INFO,
  buildReportCsv,
  formatRangeLabel,
  presetRange,
  summarize,
  type DateRange,
  type PeriodPreset,
} from '../data/adminDashboardData';
import { apiFetch, getAdminLiveSnapshot } from '../utils/localApi';
import { AdminOpsTools } from './AdminOpsTools';
import { AdminHeader, SidebarContent, type AdminViewId } from './admin/Chrome';
import {
  ActivityCard,
  CouponCard,
  ExpansionRow,
  FunnelCard,
  KpiRow,
  SpotMapCard,
  StoreCard,
  SummaryCard,
  SurveyCard,
  TrendCard,
} from './admin/Panels';
import { C, CardShell, Modal, SANS } from './admin/ui';
import { ContentView, PlaceholderView, SystemLogView } from './admin/Views';

interface AdminDashboardPageProps {
  onBackToApp: () => void;
}

interface ExportInfo {
  filename: string;
  csv: string;
  rowCount: number;
  sections: string[];
  rangeLabel: string;
}

/** UTF-8 BOM 을 붙여 엑셀에서 한글이 깨지지 않게 CSV 를 내려받는다. */
function downloadCsv(filename: string, csv: string) {
  const blob = new Blob(['﻿', csv], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function AdminDashboardPage({ onBackToApp }: AdminDashboardPageProps) {
  // 서버 모드에서만 관리자 코드를 요구한다. 로컬 모드(발표·시연)는 바로 대시보드를 연다.
  const [authenticated, setAuthenticated] = useState(USE_LOCAL_BACKEND);
  const [passcode, setPasscode] = useState('');
  const [authError, setAuthError] = useState<string | null>(null);
  const [authLoading, setAuthLoading] = useState(false);

  const [view, setView] = useState<AdminViewId>('dashboard');
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [preset, setPreset] = useState<PeriodPreset>('last30');
  const [range, setRange] = useState<DateRange>(() => presetRange('last30'));
  const [liveOn, setLiveOn] = useState(false);
  const [snapshot, setSnapshot] = useState(() => getAdminLiveSnapshot());
  const [exportInfo, setExportInfo] = useState<ExportInfo | null>(null);

  const summary = useMemo(() => summarize(range, liveOn ? snapshot : null), [range, liveOn, snapshot]);

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

  const selectView = useCallback((id: AdminViewId) => {
    setView(id);
    setDrawerOpen(false);
    window.scrollTo({ top: 0 });
  }, []);

  const handleToggleLive = () => {
    if (!liveOn) setSnapshot(getAdminLiveSnapshot());
    setLiveOn((v) => !v);
  };

  const handleExport = useCallback(() => {
    const { csv, rowCount, sections } = buildReportCsv(summary);
    const filename = `전생여지도_운영보고서_${summary.range.from}_${summary.range.to}.csv`;
    downloadCsv(filename, csv);
    setExportInfo({ filename, csv, rowCount, sections, rangeLabel: formatRangeLabel(summary.range) });
    setDrawerOpen(false);
  }, [summary]);

  // 모바일 드로어: Esc 로 닫고, 열려 있는 동안 배경 스크롤을 막는다.
  useEffect(() => {
    if (!drawerOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setDrawerOpen(false);
    };
    window.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [drawerOpen]);

  // ---- 서버 모드 인증 화면 ---------------------------------------------------------------
  if (!authenticated) {
    return (
      <div className="flex min-h-screen items-center justify-center px-4 py-10" style={{ backgroundColor: C.bg, color: C.text, fontFamily: SANS }}>
        <form onSubmit={handleLogin} className="w-full max-w-md space-y-5 rounded-2xl border border-[#D1C8B8] bg-[#F4F0E8] p-6 shadow-sm sm:p-8">
          <div className="space-y-1.5">
            <div className="flex items-center gap-2 text-xs font-semibold text-[#F28C18]">
              <Lock className="h-4 w-4" aria-hidden="true" />
              <span>관리자 전용 접근</span>
            </div>
            <h1 className="text-[clamp(1.25rem,3.5vw,1.875rem)] font-bold text-[#172638]">전생여지도 운영 현황</h1>
          </div>
          <input
            id="admin-passcode"
            type="password"
            aria-label="관리자 인증 코드"
            value={passcode}
            onChange={(e) => setPasscode(e.target.value)}
            placeholder="인증 코드를 입력하세요"
            className="min-h-[48px] w-full rounded-xl border border-[#D1C8B8] bg-white px-4 py-2.5 text-base"
          />
          {authError && (
            <p role="alert" className="text-xs font-medium text-[#C0392B]">
              {authError}
            </p>
          )}
          <div className="flex flex-col gap-2">
            <button type="submit" disabled={authLoading} className="min-h-[48px] w-full rounded-xl bg-[#1D2A3A] text-sm font-semibold text-white">
              {authLoading ? '확인 중...' : '운영 대시보드 열기'}
            </button>
            <button type="button" onClick={onBackToApp} className="min-h-[44px] w-full rounded-xl border border-[#D1C8B8] bg-white text-xs font-semibold text-[#172638]">
              체험 화면으로 돌아가기
            </button>
          </div>
        </form>
      </div>
    );
  }

  const liveWall =
    liveOn && snapshot.mediaWallAccepted
      ? {
          alias: snapshot.visitorName || '내 시연 기록',
          characterTitle: snapshot.characterId ? CHARACTERS.find((c) => c.id === snapshot.characterId)?.title ?? '내 전생' : '내 전생',
        }
      : null;

  const renderBody = () => {
    if (view === 'dashboard') {
      return (
        <div className="space-y-3">
          <KpiRow summary={summary} />

          <div className="grid gap-3 min-[768px]:grid-cols-2 min-[1360px]:grid-cols-[1.45fr_1fr_0.85fr]">
            <div className="min-w-0 min-[768px]:col-span-2 min-[1360px]:col-span-1">
              <TrendCard summary={summary} />
            </div>
            <div className="min-w-0">
              <FunnelCard summary={summary} />
            </div>
            <div className="min-w-0">
              <ActivityCard onMore={() => selectView('system')} />
            </div>
          </div>

          <div className="grid gap-3 min-[768px]:grid-cols-2 min-[1360px]:grid-cols-[1.05fr_0.8fr_1.85fr]">
            <div className="min-w-0">
              <SpotMapCard summary={summary} />
            </div>
            <div className="min-w-0">
              <SurveyCard summary={summary} />
            </div>
            <div className="min-w-0 min-[768px]:col-span-2 min-[1360px]:col-span-1">
              <CardShell num={8} title="현장 운영 도구 (QR코드 발급)">
                <AdminOpsTools showCouponRedeem={!USE_LOCAL_BACKEND} passcode={passcode} />
              </CardShell>
            </div>
          </div>

          <div className="grid gap-3 min-[768px]:grid-cols-2 min-[1360px]:grid-cols-[1fr_1.15fr_0.85fr]">
            <div className="min-w-0">
              <CouponCard summary={summary} />
            </div>
            <div className="min-w-0">
              <StoreCard summary={summary} />
            </div>
            <div className="min-w-0 min-[768px]:col-span-2 min-[1360px]:col-span-1">
              <SummaryCard summary={summary} />
            </div>
          </div>

          <ExpansionRow />
        </div>
      );
    }
    const info = ADMIN_MENU_INFO[view];
    if (view === 'system') return <SystemLogView info={info} onBack={() => selectView('dashboard')} />;
    if (view === 'content') {
      return (
        <ContentView
          info={info}
          onBack={() => selectView('dashboard')}
          liveCharacterId={liveOn ? snapshot.characterId : null}
          liveWall={liveWall}
        />
      );
    }
    return <PlaceholderView info={info} onBack={() => selectView('dashboard')} />;
  };

  return (
    <div className="min-h-screen overflow-x-hidden" style={{ backgroundColor: C.bg, color: C.text, fontFamily: SANS }}>
      {/* 데스크톱 고정 사이드바 */}
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-60 lg:block">
        <SidebarContent active={view} onSelect={selectView} onExport={handleExport} />
      </aside>

      {/* 모바일·태블릿 드로어 */}
      {drawerOpen && (
        <div className="fixed inset-0 z-[70] lg:hidden">
          <button type="button" aria-label="메뉴 닫기" className="absolute inset-0 bg-[#172638]/55" onClick={() => setDrawerOpen(false)} />
          <aside className="absolute inset-y-0 left-0 w-64 max-w-[85vw] shadow-2xl" aria-label="운영자 메뉴">
            <SidebarContent active={view} onSelect={selectView} onExport={handleExport} />
          </aside>
        </div>
      )}

      <div className="flex min-h-screen min-w-0 flex-col lg:pl-60">
        <AdminHeader
          preset={preset}
          range={range}
          onPeriodChange={(p, r) => {
            setPreset(p);
            setRange(r);
          }}
          onExport={handleExport}
          onOpenMenu={() => setDrawerOpen(true)}
          onBackToApp={onBackToApp}
          liveOn={liveOn}
          onToggleLive={handleToggleLive}
        />
        <main className="min-w-0 flex-1 p-3 sm:p-4">{renderBody()}</main>
      </div>

      {exportInfo && (
        <Modal title="보고서 내보내기 완료" onClose={() => setExportInfo(null)}>
          <div className="space-y-3 text-sm text-[#172638]">
            <p>
              선택 기간 <b>{exportInfo.rangeLabel}</b> 기준 CSV(UTF-8 BOM)를 내려받았습니다.
            </p>
            <dl className="rounded-lg border border-[#D1C8B8] bg-white px-3 py-1 text-[13px]">
              <div className="flex justify-between gap-3 border-b border-[#D1C8B8] py-2">
                <dt className="text-[#4A627A]">파일명</dt>
                <dd className="break-all text-right font-semibold">{exportInfo.filename}</dd>
              </div>
              <div className="flex justify-between gap-3 border-b border-[#D1C8B8] py-2">
                <dt className="text-[#4A627A]">포함 항목</dt>
                <dd className="text-right font-semibold">{exportInfo.sections.join(' · ')}</dd>
              </div>
              <div className="flex justify-between gap-3 py-2">
                <dt className="text-[#4A627A]">행 수</dt>
                <dd className="font-semibold tabular-nums">{exportInfo.rowCount}행</dd>
              </div>
            </dl>
            <p className="text-xs text-[#6B7C93]">데모 데이터 기준 보고서입니다. 만족도·체류 시간은 기간과 관계없이 전체 기간 고정 값이 들어갑니다.</p>
            <button
              type="button"
              onClick={() => downloadCsv(exportInfo.filename, exportInfo.csv)}
              className="inline-flex min-h-[42px] items-center gap-1.5 rounded-lg bg-[#1D2A3A] px-4 text-sm font-bold text-white hover:bg-[#2E4057]"
            >
              <Download className="h-4 w-4" aria-hidden="true" />
              다시 내려받기
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}
