import { useState } from 'react';
import { ArrowLeft, CheckCircle2, Tv, XCircle } from 'lucide-react';
import { PastLifeResult } from '../types/jeonju';

interface SceneMediaConsentProps {
  result: PastLifeResult;
  visitorName: string;
  currentConsent: 'pending' | 'accepted' | 'declined';
  onBackToResult: () => void;
  onSubmitConsent: (consent: 'accepted' | 'declined') => Promise<void>;
  onOpenWall: () => void;
  onGoToCoupons: () => void;
}

export function SceneMediaConsent({
  result,
  visitorName,
  currentConsent,
  onBackToResult,
  onSubmitConsent,
  onOpenWall,
  onGoToCoupons,
}: SceneMediaConsentProps) {
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleChoice = async (choice: 'accepted' | 'declined') => {
    setSubmitting(true);
    setErrorMsg(null);
    try {
      await onSubmitConsent(choice);
    } catch (err) {
      setErrorMsg(
        err instanceof Error ? err.message : '미디어월 동의 저장에 실패했습니다.'
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-app hanji-texture flex flex-col">
      <header className="w-full px-4 h-12 flex items-center justify-between max-w-md sm:max-w-lg mx-auto">
        <button
          type="button"
          onClick={onBackToResult}
          className="inline-flex items-center gap-1 text-sm text-[#57534E] hover:text-[#1C1917] min-h-[44px]"
        >
          <ArrowLeft className="w-4 h-4" aria-hidden="true" />
          <span>전생 결과</span>
        </button>
        <span className="text-xs text-[#78716C]">
          {visitorName || '전주 여행자'} · {result.title}
        </span>
      </header>

      {/* Faithful Scene 11 layout: Large Portrait Preview -> Question -> Horizontal Yes / No */}
      <main className="flex-1 mx-auto w-full max-w-md sm:max-w-lg px-5 py-4 flex flex-col justify-between gap-6 pb-8 safe-pb">
        {/* Top & Center: 내 전생 초상 large rectangle */}
        <div className="w-full flex-1 flex flex-col items-center justify-center space-y-2">
          <p className="text-xs font-medium text-[#78716C]">내 전생 초상</p>
          <div className="w-full max-w-[300px] sm:max-w-[320px] rounded-2xl overflow-hidden border border-[#C7B596] bg-[#EFE5D0] shadow-md">
            <img
              src={result.portraitDataUrl}
              alt="내 전생 초상 미리보기"
              className="w-full aspect-[3/4] object-cover block"
            />
          </div>
        </div>

        {/* Bottom: Question + Horizontal Yes / No buttons matching Scene 11 wireframe */}
        <div className="w-full space-y-5 text-center">
          <h1 className="font-serif-kr text-lg sm:text-xl font-bold text-[#1C1917]">
            나의 전생을 미디어월에 전시하시겠어요?
          </h1>

          <div className="grid grid-cols-2 gap-3">
            <button
              type="button"
              disabled={submitting}
              aria-label="Yes, 미디어월에 전시합니다"
              onClick={() => handleChoice('accepted')}
              className={`min-h-[52px] px-4 py-3 rounded-xl font-semibold text-base transition-colors ${
                currentConsent === 'accepted'
                  ? 'bg-[#14532D] text-white'
                  : 'bg-[#9A3412] hover:bg-[#7C2D12] text-white'
              }`}
            >
              Yes
            </button>
            <button
              type="button"
              disabled={submitting}
              aria-label="No, 전시하지 않습니다"
              onClick={() => handleChoice('declined')}
              className={`min-h-[52px] px-4 py-3 rounded-xl border font-semibold text-base transition-colors ${
                currentConsent === 'declined'
                  ? 'bg-[#1C1917] text-white border-[#1C1917]'
                  : 'bg-white hover:bg-[#F5EFE6] text-[#1C1917] border-[#D6CEBE]'
              }`}
            >
              No
            </button>
          </div>

          {errorMsg && (
            <div
              role="alert"
              className="rounded-xl border border-[#9A3412]/40 bg-[#9A3412]/10 px-4 py-3 text-xs text-[#7C2D12]"
            >
              {errorMsg}
            </div>
          )}

          {currentConsent === 'accepted' && (
            <div className="rounded-xl border border-[#16A34A]/40 bg-[#F0FDF4] p-4 space-y-2.5 text-left">
              <div className="flex items-center gap-2 text-xs font-semibold text-[#14532D]">
                <CheckCircle2 className="w-4 h-4" aria-hidden="true" />
                <span>미디어월 전시 등록이 완료되었습니다!</span>
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={onOpenWall}
                  className="flex-1 min-h-[44px] px-3 py-2 rounded-lg bg-[#14532D] text-white text-xs font-semibold inline-flex items-center justify-center gap-1.5"
                >
                  <Tv className="w-4 h-4" aria-hidden="true" />
                  <span>박물관 미디어월 보기</span>
                </button>
                <button
                  type="button"
                  disabled={submitting}
                  onClick={() => handleChoice('declined')}
                  className="min-h-[44px] px-3 py-2 rounded-lg border border-[#14532D]/30 bg-white text-xs font-medium text-[#14532D]"
                >
                  동의 철회
                </button>
              </div>
            </div>
          )}

          {currentConsent === 'declined' && (
            <div className="rounded-xl border border-[#D6CEBE] bg-white p-4 space-y-2.5 text-left">
              <div className="flex items-center gap-2 text-xs font-semibold text-[#44403C]">
                <XCircle className="w-4 h-4" aria-hidden="true" />
                <span>비공개로 설정되었습니다. 생성된 결과와 쿠폰은 그대로 유지됩니다.</span>
              </div>
              <button
                type="button"
                onClick={onGoToCoupons}
                className="w-full min-h-[44px] px-4 py-2 rounded-lg bg-[#1C1917] text-white text-xs font-semibold"
              >
                혜택 쿠폰함 확인하기
              </button>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
