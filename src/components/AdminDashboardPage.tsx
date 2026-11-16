import { FormEvent, useEffect, useState } from 'react';
import QRCode from 'qrcode';
import {
  ArrowLeft,
  Download,
  Lock,
  RefreshCw,
  BarChart3,
  QrCode,
} from 'lucide-react';
import { JEONJU_SPOTS } from '../data/jeonjuSpots';
import { AdminDashboardStats } from '../types/jeonju';

interface AdminDashboardPageProps {
  onBackToApp: () => void;
}

export function AdminDashboardPage({ onBackToApp }: AdminDashboardPageProps) {
  const [passcode, setPasscode] = useState('');
  const [authenticated, setAuthenticated] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [stats, setStats] = useState<AdminDashboardStats | null>(null);
  const [loading, setLoading] = useState(false);
  const [qrImages, setQrImages] = useState<Record<string, string>>({});

  const fetchStats = async (code: string) => {
    setLoading(true);
    setAuthError(null);
    try {
      const res = await fetch('/api/admin/stats', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ passcode: code }),
      });
      if (!res.ok) {
        const body = (await res.json()) as { error?: string };
        throw new Error(body.error || '인증에 실패했습니다.');
      }
      const data = (await res.json()) as { stats: AdminDashboardStats };
      setStats(data.stats);
      setAuthenticated(true);
    } catch (err) {
      setAuthenticated(false);
      setAuthError(err instanceof Error ? err.message : '인증 오류');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!authenticated) return;
    const generateQrs = async () => {
      const map: Record<string, string> = {};
      for (const spot of JEONJU_SPOTS) {
        map[spot.id] = await QRCode.toDataURL(spot.qrCodeValue, {
          width: 220,
          margin: 2,
          color: { dark: '#1C1917', light: '#FBF8F2' },
        });
      }
      setQrImages(map);
    };
    generateQrs();
  }, [authenticated]);

  const handleLogin = (e: FormEvent) => {
    e.preventDefault();
    fetchStats(passcode.trim());
  };

  if (!authenticated) {
    return (
      <div className="min-h-app hanji-texture flex flex-col">
        <header className="border-b border-[#E5DDD0] bg-[#FBF8F2]">
          <div className="mx-auto max-w-5xl px-4 h-14 flex items-center justify-between">
            <button
              type="button"
              onClick={onBackToApp}
              className="min-h-[44px] inline-flex items-center gap-1.5 text-sm font-medium text-[#44403C] hover:text-[#1C1917]"
            >
              <ArrowLeft className="w-4 h-4" aria-hidden="true" />
              <span>체험 화면으로</span>
            </button>
            <span className="font-serif-kr text-base font-bold">운영 현황 관리자</span>
            <span className="w-16" aria-hidden="true" />
          </div>
        </header>

        <main className="flex-1 flex items-center justify-center px-4 py-10">
          <form
            onSubmit={handleLogin}
            className="w-full max-w-md rounded-2xl border border-[#E5DDD0] bg-white p-6 sm:p-8 shadow-sm space-y-5"
          >
            <div className="space-y-1.5">
              <div className="flex items-center gap-2 text-xs font-semibold text-[#9A3412]">
                <Lock className="w-4 h-4" aria-hidden="true" />
                <span>관리자 전용 접근</span>
              </div>
              <h1 className="font-serif-kr text-2xl font-bold text-[#1C1917]">
                전생여지도 운영 현황
              </h1>
              <p className="text-xs text-[#57534E]">
                시연·심사용 관리자 코드: <strong className="font-mono-tabular text-[#1C1917]">전주2026</strong>
              </p>
            </div>

            <div className="space-y-2">
              <label htmlFor="admin-passcode" className="block text-sm font-semibold text-[#1C1917]">
                관리자 인증 코드
              </label>
              <input
                id="admin-passcode"
                type="password"
                value={passcode}
                onChange={(e) => setPasscode(e.target.value)}
                placeholder="인증 코드를 입력하세요"
                className="w-full min-h-[48px] px-4 py-2.5 rounded-xl border border-[#D6CEBE] bg-[#FBF8F2] text-base"
              />
            </div>

            {authError && (
              <p role="alert" className="text-xs font-medium text-[#9A3412]">
                {authError}
              </p>
            )}

            <div className="flex flex-col gap-2">
              <button
                type="submit"
                disabled={loading}
                className="w-full min-h-[48px] rounded-xl bg-[#9A3412] text-white font-semibold text-sm hover:bg-[#7C2D12]"
              >
                {loading ? '확인 중...' : '운영 대시보드 열기'}
              </button>
              <button
                type="button"
                onClick={() => {
                  setPasscode('전주2026');
                  fetchStats('전주2026');
                }}
                className="w-full min-h-[44px] rounded-xl border border-[#D6CEBE] bg-[#FBF8F2] text-xs font-semibold text-[#1C1917] hover:bg-[#F2ECE1]"
              >
                시연용 관리자 코드로 바로 확인
              </button>
            </div>
          </form>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-app hanji-texture flex flex-col">
      <header className="sticky top-0 z-20 border-b border-[#E5DDD0] bg-[#FBF8F2]/95 backdrop-blur-md">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 h-14 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={onBackToApp}
              className="min-h-[44px] inline-flex items-center gap-1.5 text-sm font-medium text-[#44403C] hover:text-[#1C1917]"
            >
              <ArrowLeft className="w-4 h-4" aria-hidden="true" />
              <span>체험 화면</span>
            </button>
            <span className="font-serif-kr text-base sm:text-lg font-bold text-[#1C1917]">
              전생여지도 운영 현황
            </span>
          </div>

          <button
            type="button"
            onClick={() => fetchStats(passcode || '전주2026')}
            className="min-h-[40px] px-3 py-1.5 rounded-lg border border-[#D6CEBE] bg-white text-xs font-semibold text-[#1C1917] hover:bg-[#F5EFE6] inline-flex items-center gap-1.5"
          >
            <RefreshCw className="w-3.5 h-3.5" aria-hidden="true" />
            <span>새로고침</span>
          </button>
        </div>
      </header>

      <main className="flex-1 mx-auto w-full max-w-6xl px-4 sm:px-6 py-6 sm:py-8 space-y-8">
        <div className="rounded-xl border border-[#D6CEBE] bg-[#F5EFE6] px-4 py-3 text-xs text-[#44403C]">
          데이터 구분 안내: 모든 지표는 현재 서버에 기록된 <strong>실시간 체험 데이터</strong>와 운영 규모 시연을 위한 <strong>시연용 가상 기준 데이터</strong>를 명확히 분리하여 표시합니다.
        </div>

        {stats && (
          <>
            {/* Summary Metrics Grid */}
            <section className="grid grid-cols-2 lg:grid-cols-5 gap-4">
              <div className="rounded-2xl border border-[#E5DDD0] bg-white p-4 space-y-1">
                <p className="text-xs text-[#57534E]">전체 참여 세션</p>
                <p className="font-mono-tabular text-2xl font-bold text-[#1C1917]">
                  {stats.totalVisitors.liveCount}건
                </p>
                <p className="text-[11px] text-[#78716C] font-mono-tabular">
                  가상 시연 기준: {stats.totalVisitors.demoBaseline}건
                </p>
              </div>
              <div className="rounded-2xl border border-[#E5DDD0] bg-white p-4 space-y-1">
                <p className="text-xs text-[#57534E]">4조각 완주</p>
                <p className="font-mono-tabular text-2xl font-bold text-[#9A3412]">
                  {stats.clueCompletionCount.liveCount}건
                </p>
                <p className="text-[11px] text-[#78716C] font-mono-tabular">
                  가상 시연 기준: {stats.clueCompletionCount.demoBaseline}건
                </p>
              </div>
              <div className="rounded-2xl border border-[#E5DDD0] bg-white p-4 space-y-1">
                <p className="text-xs text-[#57534E]">전생 결과 생성</p>
                <p className="font-mono-tabular text-2xl font-bold text-[#1C1917]">
                  {stats.pastLifeGenerated.liveCount}건
                </p>
                <p className="text-[11px] text-[#78716C] font-mono-tabular">
                  가상 시연 기준: {stats.pastLifeGenerated.demoBaseline}건
                </p>
              </div>
              <div className="rounded-2xl border border-[#E5DDD0] bg-white p-4 space-y-1">
                <p className="text-xs text-[#57534E]">쿠폰 발급 / 사용</p>
                <p className="font-mono-tabular text-2xl font-bold text-[#1C1917]">
                  {stats.coupons.issuedLive} / {stats.coupons.usedLive}
                </p>
                <p className="text-[11px] text-[#78716C] font-mono-tabular">
                  가상 기준: {stats.coupons.issuedDemoBaseline} / {stats.coupons.usedDemoBaseline}
                </p>
              </div>
              <div className="rounded-2xl border border-[#E5DDD0] bg-white p-4 space-y-1 col-span-2 lg:col-span-1">
                <p className="text-xs text-[#57534E]">미디어월 전시 동의</p>
                <p className="font-mono-tabular text-2xl font-bold text-[#14532D]">
                  {stats.mediaWallCount.liveCount}건
                </p>
                <p className="text-[11px] text-[#78716C] font-mono-tabular">
                  예시 작품: {stats.mediaWallCount.demoBaseline}건
                </p>
              </div>
            </section>

            {/* Spot Visits & Recent Sessions */}
            <section className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              <div className="lg:col-span-6 rounded-2xl border border-[#E5DDD0] bg-white p-5 space-y-4">
                <div className="flex items-center gap-2 border-b border-[#F0EAE0] pb-3">
                  <BarChart3 className="w-4 h-4 text-[#9A3412]" aria-hidden="true" />
                  <h2 className="font-serif-kr text-lg font-bold text-[#1C1917]">
                    장소별 방문·인증 현황
                  </h2>
                </div>
                <div className="space-y-4">
                  {stats.spotVisits.map((row) => {
                    const maxVal = Math.max(row.demoBaseline, row.liveCount, 1);
                    const demoPct = Math.round((row.demoBaseline / 160) * 100);
                    const livePct = Math.min(100, Math.round((row.liveCount / Math.max(maxVal, 10)) * 100));
                    return (
                      <div key={row.spotId} className="space-y-1.5">
                        <div className="flex items-center justify-between text-sm">
                          <span className="font-semibold text-[#1C1917]">{row.name}</span>
                          <span className="font-mono-tabular text-xs text-[#57534E]">
                            실제 {row.liveCount}건 · 시연 기준 {row.demoBaseline}건
                          </span>
                        </div>
                        <div className="h-2.5 w-full rounded-full bg-[#EFE8DC] overflow-hidden flex">
                          <div
                            className="h-full bg-[#9A3412]"
                            style={{ width: `${Math.max(livePct, row.liveCount > 0 ? 6 : 0)}%` }}
                            title={`실제 방문 ${row.liveCount}건`}
                          />
                          <div
                            className="h-full bg-[#D6CEBE]"
                            style={{ width: `${Math.min(100 - livePct, demoPct)}%` }}
                            title={`가상 시연 기준 ${row.demoBaseline}건`}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="lg:col-span-6 rounded-2xl border border-[#E5DDD0] bg-white p-5 space-y-4">
                <h2 className="font-serif-kr text-lg font-bold text-[#1C1917] border-b border-[#F0EAE0] pb-3">
                  최근 참여 세션 (실시간 기록)
                </h2>
                {stats.recentSessions.length === 0 ? (
                  <p className="text-sm text-[#57534E] py-6 text-center">
                    아직 기록된 실시간 세션이 없습니다. 체험을 시작하면 여기에 즉시 반영됩니다.
                  </p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <thead>
                        <tr className="border-b border-[#E5DDD0] text-[#78716C]">
                          <th className="py-2 pr-2">참여자</th>
                          <th className="py-2 px-2">구분</th>
                          <th className="py-2 px-2">조각</th>
                          <th className="py-2 px-2">전생 결과</th>
                          <th className="py-2 pl-2">미디어월</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#F0EAE0]">
                        {stats.recentSessions.map((s) => (
                          <tr key={s.sessionId}>
                            <td className="py-2.5 pr-2 font-medium text-[#1C1917]">
                              {s.visitorName}
                            </td>
                            <td className="py-2.5 px-2 text-[#57534E]">
                              {s.mode === 'demo' ? '시연' : '현장'}
                            </td>
                            <td className="py-2.5 px-2 font-mono-tabular">
                              {s.cluesCount}/4
                            </td>
                            <td className="py-2.5 px-2">
                              {s.archetypeTitle || '-'}
                            </td>
                            <td className="py-2.5 pl-2">
                              {s.mediaWallConsent === 'accepted'
                                ? '전시 동의'
                                : s.mediaWallConsent === 'declined'
                                  ? '비공개'
                                  : '대기'}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </section>

            {/* Official Spot QR Code Generator for Field Testing */}
            <section className="rounded-2xl border border-[#E5DDD0] bg-white p-5 space-y-4">
              <div className="flex items-center gap-2 border-b border-[#F0EAE0] pb-3">
                <QrCode className="w-4 h-4 text-[#9A3412]" aria-hidden="true" />
                <h2 className="font-serif-kr text-lg font-bold text-[#1C1917]">
                  현장 안내판 설치용 장소 QR코드
                </h2>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
                {JEONJU_SPOTS.map((spot) => (
                  <div
                    key={spot.id}
                    className="rounded-xl border border-[#E5DDD0] bg-[#FBF8F2] p-3 flex flex-col items-center text-center space-y-2"
                  >
                    {qrImages[spot.id] && (
                      <img
                        src={qrImages[spot.id]}
                        alt={`${spot.name} 공식 QR코드`}
                        className="w-32 h-32 rounded-lg border border-[#E5DDD0]"
                      />
                    )}
                    <div>
                      <p className="text-sm font-bold text-[#1C1917]">{spot.name}</p>
                      <p className="text-[11px] font-mono-tabular text-[#78716C] break-all">
                        {spot.qrCodeValue}
                      </p>
                    </div>
                    {qrImages[spot.id] && (
                      <a
                        href={qrImages[spot.id]}
                        download={`QR_${spot.name}.png`}
                        className="min-h-[36px] px-3 py-1 rounded-lg border border-[#D6CEBE] bg-white text-xs font-medium text-[#1C1917] hover:bg-[#F2ECE1] inline-flex items-center gap-1"
                      >
                        <Download className="w-3.5 h-3.5" aria-hidden="true" />
                        <span>저장</span>
                      </a>
                    )}
                  </div>
                ))}
              </div>
            </section>
          </>
        )}
      </main>
    </div>
  );
}
