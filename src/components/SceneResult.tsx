import { useState } from 'react';
import {
  ArrowLeft,
  Check,
  ChevronDown,
  ChevronUp,
  Gift,
  Sparkles,
  Tv,
} from 'lucide-react';
import { PastLifeResult } from '../types/jeonju';
import { buildDownloadableResultCard } from '../utils/portraitPainter';

interface SceneResultProps {
  result: PastLifeResult;
  visitorName: string;
  onBackToMap: () => void;
  onGoToCoupons: () => void;
  onGoToMediaConsent: () => void;
}

export function SceneResult({
  result,
  visitorName,
  onBackToMap,
  onGoToCoupons,
  onGoToMediaConsent,
}: SceneResultProps) {
  const [saving, setSaving] = useState(false);
  const [shareStatus, setShareStatus] = useState<string | null>(null);
  const [showDetails, setShowDetails] = useState(false);

  const handleSaveImage = async () => {
    setSaving(true);
    try {
      const cardDataUrl = await buildDownloadableResultCard(result, visitorName);
      const link = document.createElement('a');
      link.href = cardDataUrl;
      link.download = `전생여지도_${result.title}.png`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } finally {
      setSaving(false);
    }
  };

  const handleShare = async () => {
    const shareText = `[전생여지도] 나의 전주 전생은 '${result.title}(${result.hanjaTitle})'!\n${result.oneLineSummary}`;
    try {
      if (typeof navigator !== 'undefined' && navigator.share) {
        await navigator.share({
          title: `전생여지도 — ${result.title}`,
          text: shareText,
          url: window.location.origin,
        });
        setShareStatus('공유창을 열었습니다.');
        return;
      }
      if (typeof navigator !== 'undefined' && navigator.clipboard) {
        await navigator.clipboard.writeText(`${shareText}\n${window.location.origin}`);
        setShareStatus('전생 결과가 클립보드에 복사되었습니다.');
        return;
      }
      setShareStatus('이 브라우저에서는 저장하기 버튼을 이용해 주세요.');
    } catch {
      setShareStatus('공유가 취소되었거나 지원되지 않는 환경입니다.');
    }
  };

  return (
    <div className="min-h-app hanji-texture flex flex-col">
      <header className="w-full px-4 h-12 flex items-center justify-between max-w-lg mx-auto">
        <button
          type="button"
          onClick={onBackToMap}
          className="inline-flex items-center gap-1 text-sm text-[#57534E] hover:text-[#1C1917] min-h-[44px]"
        >
          <ArrowLeft className="w-4 h-4" aria-hidden="true" />
          <span>지도</span>
        </button>
        <span className="inline-flex items-center gap-1 text-xs font-medium text-[#9A3412]">
          <Sparkles className="w-3.5 h-3.5" aria-hidden="true" />
          <span>
            {result.generationSource === 'gemini-ai'
              ? 'Gemini AI 생성'
              : '시연용 기본 서사'}
          </span>
        </span>
      </header>

      {/* Faithful Scene 10 vertical hierarchy: <당신의 전생은> -> Portrait -> Name -> One-line Bio -> 공유하기 / 저장하기 */}
      <main className="flex-1 mx-auto w-full max-w-lg px-5 py-3 space-y-6 pb-14">
        <section className="text-center space-y-5">
          <h1 className="font-serif-kr text-xl sm:text-2xl font-bold text-[#1C1917]">
            &lt;당신의 전생은&gt;
          </h1>

          {/* Dominant Center Portrait Image */}
          <div className="mx-auto w-64 sm:w-72 rounded-2xl overflow-hidden border border-[#C7B596] bg-[#EFE5D0] shadow-md">
            <img
              src={result.portraitDataUrl}
              alt={`${result.title} 전생 초상화`}
              className="w-full aspect-[3/4] object-cover block"
            />
          </div>

          {/* Past Life Name & One-line Bio */}
          <div className="space-y-2 pt-1">
            <h2 className="font-serif-kr text-3xl font-bold text-[#1C1917]">
              {result.title}{' '}
              <span className="text-lg font-normal text-[#78716C]">
                {result.hanjaTitle}
              </span>
            </h2>
            <p className="font-serif-kr text-base font-medium text-[#9A3412] leading-relaxed">
              {result.oneLineSummary}
            </p>
          </div>

          {/* Full Biography Prose */}
          <div className="text-left rounded-2xl border border-[#E5DDD0] bg-white p-5 space-y-3 shadow-xs">
            <h3 className="text-xs font-semibold text-[#78716C]">전생 일대기</h3>
            <p className="text-sm text-[#292524] leading-relaxed">
              {result.biography}
            </p>
            <p className="text-[11px] text-[#78716C] pt-2 border-t border-[#F0EAE0]">
              {result.historicalDisclaimer}
            </p>
          </div>

          {/* Stacked Share & Save Buttons matching Scene 10 wireframe */}
          <div className="space-y-2.5 pt-1">
            <button
              type="button"
              onClick={handleShare}
              className="w-full min-h-[48px] px-5 py-3 rounded-xl border border-[#D6CEBE] bg-white hover:bg-[#F5EFE6] text-sm font-semibold text-[#1C1917] transition-colors"
            >
              공유하기
            </button>
            <button
              type="button"
              disabled={saving}
              onClick={handleSaveImage}
              className="w-full min-h-[48px] px-5 py-3 rounded-xl bg-[#1C1917] hover:bg-[#292524] text-sm font-semibold text-white transition-colors disabled:opacity-60"
            >
              {saving ? '저장 중...' : '저장하기'}
            </button>

            {shareStatus && (
              <p className="text-xs text-[#14532D] inline-flex items-center gap-1" role="status">
                <Check className="w-3.5 h-3.5" aria-hidden="true" />
                <span>{shareStatus}</span>
              </p>
            )}
          </div>

          {/* Next Step -> Scene 11 Media Wall Consent */}
          <button
            type="button"
            onClick={onGoToMediaConsent}
            className="w-full min-h-[52px] px-6 py-3.5 rounded-xl bg-[#9A3412] text-white font-semibold text-base hover:bg-[#7C2D12] transition-colors flex items-center justify-center gap-2"
          >
            <Tv className="w-4 h-4" aria-hidden="true" />
            <span>미디어월 전시 선택하기</span>
          </button>
        </section>

        {/* Expandable Details: 4-Clue Synthesis & Character Goods (kept unobtrusive) */}
        <section className="border-t border-[#E5DDD0] pt-4 space-y-3">
          <div className="flex items-center justify-between gap-2">
            <button
              type="button"
              onClick={() => setShowDetails((p) => !p)}
              aria-expanded={showDetails}
              className="text-xs font-semibold text-[#57534E] hover:text-[#1C1917] inline-flex items-center gap-1 min-h-[36px]"
            >
              <span>네 조각 연결 및 전생 굿즈 안내 보기</span>
              {showDetails ? (
                <ChevronUp className="w-3.5 h-3.5" aria-hidden="true" />
              ) : (
                <ChevronDown className="w-3.5 h-3.5" aria-hidden="true" />
              )}
            </button>
            <button
              type="button"
              onClick={onGoToCoupons}
              className="text-xs font-semibold text-[#9A3412] hover:underline min-h-[36px]"
            >
              쿠폰함
            </button>
          </div>

          {showDetails && (
            <div className="space-y-4">
              <dl className="grid grid-cols-2 gap-2.5 text-xs">
                <div className="rounded-xl bg-white border border-[#E5DDD0] p-3">
                  <dt className="text-[#78716C]">시대 · 경기전</dt>
                  <dd className="font-semibold text-[#1C1917] mt-0.5">{result.era}</dd>
                </div>
                <div className="rounded-xl bg-white border border-[#E5DDD0] p-3">
                  <dt className="text-[#78716C]">신분 · 전라감영</dt>
                  <dd className="font-semibold text-[#1C1917] mt-0.5">{result.status}</dd>
                </div>
                <div className="rounded-xl bg-white border border-[#E5DDD0] p-3">
                  <dt className="text-[#78716C]">이야기 · 완판본</dt>
                  <dd className="font-semibold text-[#1C1917] mt-0.5">{result.storyTitle}</dd>
                </div>
                <div className="rounded-xl bg-white border border-[#E5DDD0] p-3">
                  <dt className="text-[#78716C]">소지품 · 남부시장</dt>
                  <dd className="font-semibold text-[#1C1917] mt-0.5">{result.item}</dd>
                </div>
              </dl>

              <div className="rounded-xl bg-white border border-[#E5DDD0] p-4 space-y-2.5">
                <div className="flex items-center gap-1.5 text-xs font-bold text-[#1C1917]">
                  <Gift className="w-4 h-4 text-[#9A3412]" aria-hidden="true" />
                  <span>{result.title} 맞춤 전생 굿즈 (시연용 안내)</span>
                </div>
                {result.recommendedGoods.map((g) => (
                  <div key={g.id} className="text-xs border-t border-[#F0EAE0] pt-2">
                    <p className="font-semibold text-[#1C1917]">{g.name}</p>
                    <p className="text-[#57534E]">{g.description}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
