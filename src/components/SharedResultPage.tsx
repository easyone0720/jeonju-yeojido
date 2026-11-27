/**
 * 공유 링크(?sharedResult=<id>)로 열린 전생 결과 열람 화면. 로그인 없이 읽기 전용으로 보여 준다.
 */
import { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { assetUrls, getSharedResult, type PastLifeResultView } from '../services/aiPastLife/api';
import { AiPastLifeView } from './AiPastLifeView';

export function SharedResultPage({ resultId, onStart }: { resultId: string; onStart: () => void }) {
  const [result, setResult] = useState<PastLifeResultView | null>(null);
  const [urls, setUrls] = useState<{ image: string | null; voice: string | null }>({ image: null, voice: null });
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    void (async () => {
      try {
        const { result: row } = await getSharedResult(resultId, controller.signal);
        const u = await assetUrls(row);
        if (controller.signal.aborted) return;
        setResult(row);
        setUrls(u);
      } catch (err) {
        if (!controller.signal.aborted) setError(err instanceof Error ? err.message : '공유된 결과를 불러오지 못했습니다.');
      }
    })();
    return () => controller.abort();
  }, [resultId]);

  return (
    <div className="min-h-app hanji-texture flex flex-col pb-[calc(2rem+env(safe-area-inset-bottom))]">
      <main className="flex-1 mx-auto w-full max-w-5xl px-4 sm:px-6 py-6 space-y-5">
        <p className="text-center font-serif-kr text-sm text-[#8E3524]">전생여지도 · 공유된 전생 기록</p>
        {error ? (
          <div role="alert" className="rounded-2xl border border-[#E3C9A8] bg-[#FFF8EC] p-6 text-center text-sm text-[#7A2E1F]">
            {error}
          </div>
        ) : !result ? (
          <p className="inline-flex w-full items-center justify-center gap-2 text-sm text-[#5C5349]" role="status">
            <Loader2 className="w-4 h-4 animate-spin text-[#8E3524]" aria-hidden="true" />
            <span>전생 기록을 펼치는 중이옵니다…</span>
          </p>
        ) : (
          <AiPastLifeView result={result} displayName="누군가" imageUrl={urls.image} voiceUrl={urls.voice} assetPhase="done" />
        )}
        <button
          type="button"
          onClick={onStart}
          className="w-full min-h-[48px] px-5 py-3 rounded-xl bg-[#8E3524] hover:bg-[#762A1C] text-sm font-semibold text-[#FBF8F1] transition-colors"
        >
          나도 전생 찾으러 가기
        </button>
      </main>
    </div>
  );
}
