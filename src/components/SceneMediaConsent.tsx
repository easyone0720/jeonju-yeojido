import { useState } from 'react';
import { ArrowLeft, CheckCircle2, Info, ShoppingBag, Tv, X } from 'lucide-react';
import { PastLifeResult } from '../types/jeonju';
import { resolveCharacterImage } from '../data/characters';

interface SceneMediaConsentProps {
  result: PastLifeResult;
  visitorName: string;
  currentConsent: 'pending' | 'accepted' | 'declined';
  onBackToResult: () => void;
  onSubmitConsent: (consent: 'accepted' | 'declined') => Promise<void>;
  onOpenWall: () => void;
  onGoToCoupons: () => void;
  onOpenGoods: () => void;
}

export function SceneMediaConsent({
  result,
  visitorName,
  currentConsent,
  onBackToResult,
  onSubmitConsent,
  onOpenWall,
  onGoToCoupons,
  onOpenGoods,
}: SceneMediaConsentProps) {
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [popup, setPopup] = useState<'accepted' | 'declined' | null>(null);

  const handleChoice = async (choice: 'accepted' | 'declined') => {
    // 이미 선택된 값을 다시 누르면 저장 없이 해당 안내 팝업만 다시 연다
    if (currentConsent === choice) {
      setErrorMsg(null);
      setPopup(choice);
      return;
    }
    setSubmitting(true);
    setErrorMsg(null);
    try {
      await onSubmitConsent(choice);
      setPopup(choice);
    } catch (err) {
      setErrorMsg(
        err instanceof Error ? err.message : '미디어월 동의 저장에 실패했습니다.'
      );
    } finally {
      setSubmitting(false);
    }
  };

  const handleWithdraw = async () => {
    setSubmitting(true);
    setErrorMsg(null);
    try {
      await onSubmitConsent('declined');
      setPopup(null);
    } catch (err) {
      setErrorMsg(
        err instanceof Error ? err.message : '동의 철회 처리에 실패했습니다.'
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-app hanji-texture flex flex-col pb-24">
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
          <div className="w-full max-w-[220px] sm:max-w-[250px] aspect-[9/16] mx-auto rounded-2xl overflow-hidden border border-[#D8CEBE] bg-[#F3ECE0] shadow-md">
            <img
              src={resolveCharacterImage(result.characterId, result.portraitDataUrl)}
              alt="내 전생 초상 미리보기"
              className="w-full h-full object-contain object-center block"
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
                  : 'bg-[#8E3524] hover:bg-[#762A1C] text-white'
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
              className="rounded-xl border border-[#9A3412]/40 bg-[#8E3524]/10 px-4 py-3 text-xs text-[#7C2D12]"
            >
              {errorMsg}
            </div>
          )}
        </div>
      </main>
      {popup && (
        <div
          className="fixed inset-0 z-50 bg-[#1C1917]/55 backdrop-blur-xs flex justify-center"
          role="presentation"
          onClick={() => {
            if (!submitting) setPopup(null);
          }}
        >
          <div className="relative w-full max-w-[430px] mx-auto flex items-center justify-center p-4 pointer-events-none">
            <div
              role="dialog"
              aria-modal="true"
              aria-labelledby="media-consent-popup-title"
              onClick={(e) => e.stopPropagation()}
              className="pointer-events-auto w-full rounded-2xl border-2 border-[#C7B596] bg-[#FBF8F2] p-5 shadow-2xl"
            >
              <div className="flex items-center justify-between -mt-1 mb-3">
                <button
                  type="button"
                  onClick={() => setPopup(null)}
                  disabled={submitting}
                  className="inline-flex items-center gap-1 text-xs font-medium text-[#57534E] hover:text-[#1C1917] min-h-[44px]"
                >
                  <ArrowLeft className="w-4 h-4" aria-hidden="true" />
                  <span>이전으로 돌아가기</span>
                </button>
                <button
                  type="button"
                  onClick={() => setPopup(null)}
                  disabled={submitting}
                  aria-label="닫기"
                  className="min-w-[44px] min-h-[44px] flex items-center justify-center rounded-lg text-[#57534E] hover:bg-[#EFE8DC]"
                >
                  <X className="w-5 h-5" aria-hidden="true" />
                </button>
              </div>

              {popup === 'accepted' ? (
                <div className="space-y-4 text-center">
                  <CheckCircle2 className="w-10 h-10 mx-auto text-[#14532D]" aria-hidden="true" />
                  <h2
                    id="media-consent-popup-title"
                    className="font-serif-kr text-base font-bold text-[#14532D]"
                  >
                    미디어월 전시 등록이 완료되었습니다!
                  </h2>
                  <div className="space-y-2">
                    <button
                      type="button"
                      onClick={onOpenWall}
                      className="w-full min-h-[48px] px-4 py-2 rounded-xl bg-[#14532D] text-white text-sm font-semibold inline-flex items-center justify-center gap-1.5"
                    >
                      <Tv className="w-4 h-4" aria-hidden="true" />
                      <span>박물관 미디어월 보기</span>
                    </button>
                    <button
                      type="button"
                      disabled={submitting}
                      onClick={() => void handleWithdraw()}
                      className="w-full min-h-[44px] px-4 py-2 rounded-xl border border-[#14532D]/30 bg-white text-sm font-medium text-[#14532D] disabled:opacity-60"
                    >
                      동의 철회
                    </button>
                  <button
                    type="button"
                    onClick={() => {
                      setPopup(null);
                      onOpenGoods();
                    }}
                    disabled={submitting}
                    className="w-full min-h-[44px] px-4 py-2 rounded-xl border border-[#C7B596] bg-white text-sm font-semibold text-[#9A3412] inline-flex items-center justify-center gap-1.5 disabled:opacity-60"
                  >
                    <ShoppingBag className="w-4 h-4" aria-hidden="true" />
                    <span>전생 기념 굿즈 보러가기</span>
                  </button>
                  </div>
                </div>
              ) : (
                <div className="space-y-4 text-center">
                  <Info className="w-10 h-10 mx-auto text-[#57534E]" aria-hidden="true" />
                  <h2
                    id="media-consent-popup-title"
                    className="font-serif-kr text-base font-bold text-[#1C1917] leading-relaxed"
                  >
                    비공개로 설정되었습니다. 생성된 결과와 쿠폰은 그대로 유지됩니다.
                  </h2>
                  <button
                    type="button"
                    onClick={onGoToCoupons}
                    className="w-full min-h-[48px] px-4 py-2 rounded-xl bg-[#1C1917] text-white text-sm font-semibold"
                  >
                    혜택 쿠폰함 확인하기
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setPopup(null);
                      onOpenGoods();
                    }}
                    disabled={submitting}
                    className="w-full min-h-[44px] px-4 py-2 rounded-xl border border-[#C7B596] bg-white text-sm font-semibold text-[#9A3412] inline-flex items-center justify-center gap-1.5 disabled:opacity-60"
                  >
                    <ShoppingBag className="w-4 h-4" aria-hidden="true" />
                    <span>전생 기념 굿즈 보러가기</span>
                  </button>
                </div>
              )}

              {errorMsg && (
                <div
                  role="alert"
                  className="mt-3 rounded-xl border border-[#9A3412]/40 bg-[#8E3524]/10 px-3 py-2 text-xs text-[#7C2D12]"
                >
                  {errorMsg}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
