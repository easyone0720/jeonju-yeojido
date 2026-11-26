import { useMemo, useState } from 'react';
import { ArrowLeft, Check } from 'lucide-react';
import { CHARACTERS } from '../../data/characters';
import {
  ADMIN_CHARACTER_COUNTS,
  ADMIN_POSITIVE_KEYWORDS,
  ADMIN_WALL_QUEUE,
} from '../../data/adminDummyStats';
import { DEMO_SYSTEM_LOG, fmt, pct, type MenuInfo } from '../../data/adminDashboardData';
import { C, CardShell } from './ui';

const BackButton = ({ onBack }: { onBack: () => void }) => (
  <button
    type="button"
    onClick={onBack}
    className="inline-flex min-h-[40px] items-center gap-1.5 rounded-lg border border-[#D1C8B8] bg-white px-3.5 text-sm font-bold text-[#172638] hover:bg-[#EAE2D0]"
  >
    <ArrowLeft className="h-4 w-4" aria-hidden="true" />
    대시보드로 돌아가기
  </button>
);

/** 미구현 메뉴: 개발 준비 단계와 목적 안내 */
export function PlaceholderView({ info, onBack }: { info: MenuInfo; onBack: () => void }) {
  return (
    <div className="space-y-4">
      <CardShell title={`${info.label} — 개발 준비 단계`}>
        <div className="space-y-4 text-sm text-[#172638]">
          <span className="inline-block rounded-full bg-[#F5C451] px-3 py-1 text-xs font-bold">준비 중</span>
          <div>
            <p className="mb-1 text-xs font-bold text-[#4A627A]">이 화면의 목적</p>
            <p className="leading-relaxed">{info.purpose}</p>
          </div>
          <div>
            <p className="mb-1 text-xs font-bold text-[#4A627A]">예정 기능</p>
            <ul className="list-disc space-y-1 pl-5">
              {info.planned.map((p) => (
                <li key={p}>{p}</li>
              ))}
            </ul>
          </div>
          <div className="rounded-lg border border-[#F28C18] bg-[#FFF1DE] px-3 py-2.5">
            <p className="mb-0.5 text-xs font-bold text-[#B45F00]">현재 상태</p>
            <p>{info.status}</p>
          </div>
        </div>
      </CardShell>
      <BackButton onBack={onBack} />
    </div>
  );
}

/** 시스템·로그: 데모 활동 로그 전체 목록 */
export function SystemLogView({ info, onBack }: { info: MenuInfo; onBack: () => void }) {
  return (
    <div className="space-y-4">
      <CardShell title="시스템·로그 — 활동 로그 (데모)">
        <p className="mb-3 text-xs text-[#6B7C93]">{info.status}</p>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-[13px]">
            <thead>
              <tr className="border-b border-[#D1C8B8] text-[11px] font-bold text-[#4A627A]">
                <th className="py-2 pr-3">시각</th>
                <th className="py-2 pr-3">수준</th>
                <th className="py-2 pr-3">내용</th>
                <th className="py-2">사용자</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#D1C8B8]">
              {DEMO_SYSTEM_LOG.map((l, i) => (
                <tr key={i}>
                  <td className="py-2 pr-3 tabular-nums text-[#4A627A]">{l.time}</td>
                  <td className="py-2 pr-3">
                    <span className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${l.level === 'WARN' ? 'bg-[#FFE2B8] text-[#8A4B00]' : 'bg-[#DDEFE3] text-[#1F6B3B]'}`}>
                      {l.level}
                    </span>
                  </td>
                  <td className="py-2 pr-3 font-semibold text-[#172638]">{l.text}</td>
                  <td className="py-2 tabular-nums text-[#6B7C93]">{l.user}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </CardShell>
      <BackButton onBack={onBack} />
    </div>
  );
}

/** 콘텐츠 관리: 기존 대시보드에 있던 캐릭터 배정 통계·미디어월 승인 목록(데모)을 옮겨 둔 화면 */
export function ContentView({
  info,
  onBack,
  liveCharacterId,
  liveWall,
}: {
  info: MenuInfo;
  onBack: () => void;
  liveCharacterId: string | null;
  liveWall: { alias: string; characterTitle: string } | null;
}) {
  const [approved, setApproved] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(ADMIN_WALL_QUEUE.map((w) => [w.id, w.approved]))
  );

  const characters = useMemo(() => {
    const rows = CHARACTERS.map((c) => ({
      id: c.id,
      title: c.title,
      count: (ADMIN_CHARACTER_COUNTS[c.id] ?? 0) + (liveCharacterId === c.id ? 1 : 0),
      mine: liveCharacterId === c.id,
    }));
    return { rows, total: rows.reduce((a, r) => a + r.count, 0) };
  }, [liveCharacterId]);

  const wall = useMemo(() => {
    const items = ADMIN_WALL_QUEUE.map((w) => ({ ...w, isLive: false }));
    if (liveWall) {
      items.unshift({ id: 'live', alias: liveWall.alias, characterTitle: liveWall.characterTitle, submittedLabel: '방금', approved: false, isLive: true });
    }
    return items;
  }, [liveWall]);

  return (
    <div className="space-y-4">
      <CardShell title="콘텐츠 관리">
        <p className="mb-1 text-sm text-[#172638]">{info.purpose}</p>
        <p className="text-xs text-[#6B7C93]">{info.status}</p>
      </CardShell>

      <CardShell title="전생 캐릭터 10종 배정 통계" right={<span className="text-[11px] text-[#6B7C93]">누적 {fmt(characters.total)}명 (데모)</span>}>
        <ul className="grid gap-x-8 gap-y-3 md:grid-cols-2">
          {characters.rows.map((c) => (
            <li key={c.id} className="space-y-1">
              <div className="flex items-center justify-between gap-2 text-sm">
                <span className="font-semibold text-[#172638]">
                  <span className="mr-1 text-xs tabular-nums text-[#4A627A]">{c.id}.</span>
                  {c.title}
                  {c.mine && <span className="ml-1.5 rounded-full bg-[#F28C18] px-2 py-0.5 text-[10px] font-bold text-white">내 전생 +1</span>}
                </span>
                <span className="whitespace-nowrap text-xs tabular-nums text-[#2E4057]">
                  {fmt(c.count)}명 · {pct(c.count, characters.total).toFixed(1)}%
                </span>
              </div>
              <div className="h-2.5 overflow-hidden rounded-full bg-[#E4DCCB]">
                <div className="h-full rounded-full" style={{ width: `${pct(c.count, characters.total) * 5}%`, backgroundColor: c.mine ? C.orange : C.navy }} />
              </div>
            </li>
          ))}
        </ul>
        <p className="mt-2 text-[11px] text-[#6B7C93]">막대 길이 = 점유율 × 5 (최대 20% 기준)</p>
      </CardShell>

      <CardShell title="방문객 만족도 키워드 & 미디어월 송출 관리">
        <div className="mb-3 flex flex-wrap gap-2">
          {ADMIN_POSITIVE_KEYWORDS.map((k) => (
            <span key={k} className="rounded-full border border-[#D1C8B8] bg-white px-3 py-1 text-sm font-semibold text-[#172638]">
              {k}
            </span>
          ))}
        </div>
        <ul className="divide-y divide-[#D1C8B8] rounded-xl border border-[#D1C8B8]">
          {wall.map((w) => {
            const on = approved[w.id] ?? w.approved;
            return (
              <li key={w.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-[#172638]">
                    {w.alias}
                    {w.isLive && <span className="ml-1.5 rounded-full bg-[#F28C18] px-2 py-0.5 text-[10px] font-bold text-white">방금 등록</span>}
                  </p>
                  <p className="text-xs text-[#4A627A]">
                    {w.characterTitle} · {w.submittedLabel}
                  </p>
                </div>
                <button
                  type="button"
                  aria-pressed={on}
                  onClick={() => setApproved((prev) => ({ ...prev, [w.id]: !on }))}
                  className={`inline-flex min-h-[38px] items-center gap-1.5 rounded-lg border px-4 text-xs font-bold ${
                    on ? 'border-transparent bg-[#1D2A3A] text-white' : 'border-[#D1C8B8] bg-white text-[#2E4057] hover:bg-[#EAE2D0]'
                  }`}
                >
                  {on && <Check className="h-3.5 w-3.5" aria-hidden="true" />}
                  {on ? '송출 승인됨' : '승인 대기 · 승인하기'}
                </button>
              </li>
            );
          })}
        </ul>
        <p className="mt-2 text-[11px] text-[#6B7C93]">승인 토글은 화면 표시용이며 실제 /wall 송출 목록에는 반영되지 않습니다.</p>
      </CardShell>

      <BackButton onBack={onBack} />
    </div>
  );
}
