/**
 * '내 조각' 탭 아래의 '나의 전생 기록' (API 모드). 로그인한 계정의 생성 기록을 서버에서 불러와
 * 다시 열람하고 음성을 재생한다. AI 를 다시 부르지 않는다(빠진 초상화·음성만 버튼으로 다시 만들 수 있다).
 */
import { useCallback, useEffect, useState } from 'react';
import { ChevronRight, Loader2, LogIn, X } from 'lucide-react';
import {
  LoginRequiredError,
  assetUrls,
  generateAssets,
  listResults,
  type PastLifeResultView,
} from '../services/aiPastLife/api';
import { getCurrentSession } from '../services/supabase/client';
import { loginWithSupabaseGoogle } from '../utils/authHandlers';
import { AiPastLifeView, AssetPhase, ResultBadges } from './AiPastLifeView';

function formatDate(iso: string): string {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? '' : `${d.getFullYear()}.${d.getMonth() + 1}.${d.getDate()}`;
}

export function PastLifeHistory() {
  const [state, setState] = useState<'loading' | 'login' | 'ready' | 'error'>('loading');
  const [items, setItems] = useState<PastLifeResultView[]>([]);
  const [open, setOpen] = useState<PastLifeResultView | null>(null);
  const [urls, setUrls] = useState<{ image: string | null; voice: string | null }>({ image: null, voice: null });
  const [assetPhase, setAssetPhase] = useState<AssetPhase>('done');

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const session = await getCurrentSession().catch(() => null);
      if (cancelled) return;
      if (!session) {
        setState('login');
        return;
      }
      try {
        const { results } = await listResults();
        if (cancelled) return;
        setItems(results);
        setState('ready');
      } catch (err) {
        if (!cancelled) setState(err instanceof LoginRequiredError ? 'login' : 'error');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const openItem = useCallback(async (item: PastLifeResultView) => {
    setOpen(item);
    setAssetPhase('done');
    setUrls(await assetUrls(item));
  }, []);

  const retryAssets = useCallback(async () => {
    if (!open) return;
    setAssetPhase('loading');
    try {
      const { result } = await generateAssets(open.id);
      setOpen(result);
      setItems((prev) => prev.map((x) => (x.id === result.id ? result : x)));
      setUrls(await assetUrls(result));
    } catch {
      // 빈 자리 안내가 그대로 남는다
    } finally {
      setAssetPhase('done');
    }
  }, [open]);

  return (
    <section aria-labelledby="past-life-history-title" className="rounded-2xl border border-[#D8CEBE] bg-[#FBF8F1] p-5 space-y-3">
      <h2 id="past-life-history-title" className="font-serif-kr text-base font-bold text-[#1C1917]">
        나의 전생 기록
      </h2>

      {state === 'loading' && (
        <p className="inline-flex items-center gap-2 text-sm text-[#5C5349]" role="status">
          <Loader2 className="w-4 h-4 animate-spin text-[#8E3524]" aria-hidden="true" />
          <span>기록을 불러오는 중이옵니다…</span>
        </p>
      )}
      {state === 'login' && (
        <div className="space-y-2">
          <p className="text-sm text-[#5C5349]">Google로 로그인하면 만든 전생 기록을 다시 볼 수 있습니다.</p>
          <button
            type="button"
            onClick={() => void loginWithSupabaseGoogle()}
            className="min-h-[40px] rounded-full bg-[#8E3524] hover:bg-[#762A1C] px-4 text-xs font-semibold text-white inline-flex items-center gap-1.5"
          >
            <LogIn className="w-3.5 h-3.5" aria-hidden="true" />
            <span>Google로 로그인</span>
          </button>
        </div>
      )}
      {state === 'error' && (
        <p role="alert" className="text-sm text-[#B91C1C]">
          기록을 불러오지 못했습니다. 잠시 후 다시 열어 주세요.
        </p>
      )}
      {state === 'ready' && items.length === 0 && (
        <p className="text-sm text-[#5C5349]">아직 만든 전생 이야기가 없습니다. 네 조각을 모아 박물관에서 전생을 완성해 보세요.</p>
      )}
      {state === 'ready' && items.length > 0 && (
        <ul className="space-y-2">
          {items.map((item) => (
            <li key={item.id}>
              <button
                type="button"
                onClick={() => void openItem(item)}
                className="w-full min-h-[56px] rounded-xl border border-[#E5DDD0] bg-white hover:bg-[#F5EFE6] px-4 py-3 flex items-center gap-3 text-left transition-colors"
              >
                <span className="flex-1 min-w-0 space-y-1">
                  <span className="block font-serif-kr text-sm font-bold text-[#1C1917] truncate">{item.story.title}</span>
                  <span className="block text-xs text-[#78716C]">
                    {item.category_name}
                    {item.zodiac_name ? ` · ${item.zodiac_name}` : ''} · {formatDate(item.created_at)}
                  </span>
                </span>
                <ChevronRight className="w-4 h-4 shrink-0 text-[#78716C]" aria-hidden="true" />
              </button>
            </li>
          ))}
        </ul>
      )}

      {open && (
        <div className="fixed inset-0 z-50 bg-[#26201B]/45 backdrop-blur-sm overflow-y-auto" role="dialog" aria-modal="true" aria-label={`${open.story.title} 전생 기록`}>
          <div className="mx-auto w-full max-w-5xl px-4 sm:px-6 py-6">
            <div className="relative rounded-2xl border border-[#D8CEBE] ring-1 ring-inset ring-[#E6DEC8] bg-[#FBF8F1] p-4 sm:p-6 shadow-2xl space-y-4">
              <div className="flex items-center justify-between gap-2">
                <ResultBadges categoryName={open.category_name} zodiacName={open.zodiac_name} />
                <button
                  type="button"
                  onClick={() => setOpen(null)}
                  aria-label="닫기"
                  className="w-9 h-9 rounded-full text-[#5C5349] hover:bg-[#F5EFE6] flex items-center justify-center"
                >
                  <X className="w-5 h-5" aria-hidden="true" />
                </button>
              </div>
              <AiPastLifeView
                result={open}
                displayName={open.user_name}
                imageUrl={urls.image}
                voiceUrl={urls.voice}
                assetPhase={assetPhase}
                onRetryAssets={() => void retryAssets()}
              />
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
