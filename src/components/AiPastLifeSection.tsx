/**
 * 결과 화면(API 모드)의 맞춤형 전생 영역.
 * 흐름: (로그인 확인) → 12간지 소재 풀이 → 전생 기록 복원(스토리) → 초상화·목소리 생성(에셋)
 * - 새로고침하면 이 탭에 기억한 결과 id 로 저장된 결과를 다시 불러온다(AI 재호출 없음).
 * - 자동 생성은 이 체험에서 한 번만. 이후에는 버튼으로만 만든다.
 * - 새 이야기 생성에 실패하면 이전 결과를 그대로 둔다.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { Check, Loader2, LogIn } from 'lucide-react';
import {
  LoginRequiredError,
  assetUrls,
  generateAssets,
  generateStory,
  getResult,
  readLastResultId,
  writeLastResultId,
  type Fragments,
  type PastLifeResultView,
} from '../services/aiPastLife/api';
import { publishLatestAiResult } from '../services/aiPastLife/latest';
import { getCurrentSession } from '../services/supabase/client';
import { loginWithSupabaseGoogle } from '../utils/authHandlers';
import { AiPastLifeView, AssetPhase } from './AiPastLifeView';

type StepState = 'pending' | 'active' | 'done' | 'skipped';
type Phase = 'checking' | 'login' | 'idle' | 'generating' | 'ready';

const AUTO_KEY_PREFIX = 'jeonsaeng:v3:aiAuto:';

function claimAutoRun(sessionId: string): boolean {
  try {
    if (window.sessionStorage.getItem(AUTO_KEY_PREFIX + sessionId)) return false;
    window.sessionStorage.setItem(AUTO_KEY_PREFIX + sessionId, '1');
    return true;
  } catch {
    return false;
  }
}

function errorText(err: unknown): string {
  return err instanceof Error ? err.message : '처리 중 문제가 생겼습니다.';
}

interface Props {
  sessionId: string;
  visitorName: string;
  zodiacCode: string | null;
  fragments: Fragments | null;
  disclaimer?: string;
}

export function AiPastLifeSection({ sessionId, visitorName, zodiacCode, fragments, disclaimer }: Props) {
  const [phase, setPhase] = useState<Phase>('checking');
  const [result, setResult] = useState<PastLifeResultView | null>(null);
  const [urls, setUrls] = useState<{ image: string | null; voice: string | null }>({ image: null, voice: null });
  const [assetPhase, setAssetPhase] = useState<AssetPhase>('idle');
  const [steps, setSteps] = useState<{ zodiac: StepState; story: StepState; assets: StepState }>({
    zodiac: 'pending',
    story: 'pending',
    assets: 'pending',
  });
  const [error, setError] = useState<string | null>(null);
  const [retryKey, setRetryKey] = useState(0);
  const busyRef = useRef(false);
  const aliveRef = useRef(true);
  const displayName = visitorName.trim() || '나그네';

  useEffect(() => {
    aliveRef.current = true;
    return () => {
      aliveRef.current = false;
    };
  }, []);

  const loadAssetsFor = useCallback(async (row: PastLifeResultView) => {
    setUrls(await assetUrls(row));
  }, []);

  // 앱 전체(홈 배너·저장·공유·미디어월)가 같은 결과를 보도록 최신 결과를 알린다
  useEffect(() => {
    if (result) publishLatestAiResult(sessionId, result, urls.image);
  }, [result, urls.image, sessionId]);

  const runAssets = useCallback(
    async (row: PastLifeResultView) => {
      setAssetPhase('loading');
      setSteps((s) => ({ ...s, assets: 'active' }));
      try {
        const { result: updated } = await generateAssets(row.id);
        if (!aliveRef.current) return;
        setResult(updated);
        await loadAssetsFor(updated);
      } catch (err) {
        if (aliveRef.current && err instanceof LoginRequiredError) setPhase('login');
        // 에셋 실패는 이야기 표시에 영향을 주지 않는다 (빈 자리에 안내 + 다시 만들기 버튼)
      } finally {
        if (aliveRef.current) {
          setAssetPhase('done');
          setSteps((s) => ({ ...s, assets: 'done' }));
        }
      }
    },
    [loadAssetsFor],
  );

  const generate = useCallback(async () => {
    if (busyRef.current) return;
    if (!fragments) {
      setError('수집한 조각 정보를 찾지 못했습니다. 지도에서 조각을 확인해 주세요.');
      return;
    }
    busyRef.current = true;
    setError(null);
    const hadResult = Boolean(result);
    if (!hadResult) setPhase('generating');
    setSteps({ zodiac: zodiacCode ? 'done' : 'skipped', story: 'active', assets: 'pending' });
    try {
      const { result: created } = await generateStory({ name: displayName, zodiacCode, fragments });
      if (!aliveRef.current) return;
      writeLastResultId(sessionId, created.id);
      setResult(created);
      setUrls({ image: null, voice: null });
      setPhase('ready');
      setSteps((s) => ({ ...s, story: 'done' }));
      busyRef.current = false;
      await runAssets(created);
    } catch (err) {
      if (!aliveRef.current) return;
      if (err instanceof LoginRequiredError) {
        setPhase('login');
      } else {
        setError(errorText(err));
        setPhase(hadResult ? 'ready' : 'idle');
      }
      setSteps((s) => ({ ...s, story: 'pending' }));
    } finally {
      busyRef.current = false;
    }
  }, [displayName, fragments, result, runAssets, sessionId, zodiacCode]);

  // 첫 화면: 로그인 확인 → 저장된 결과 복원 → (이 체험에서 처음이면) 자동 생성
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const session = await getCurrentSession().catch(() => null);
      if (cancelled) return;
      if (!session) {
        setPhase('login');
        return;
      }
      const lastId = readLastResultId(sessionId);
      if (lastId) {
        try {
          const { result: saved } = await getResult(lastId);
          if (cancelled) return;
          setResult(saved);
          await loadAssetsFor(saved);
          if (cancelled) return;
          setAssetPhase('done');
          setPhase('ready');
          return;
        } catch (err) {
          if (cancelled) return;
          if (err instanceof LoginRequiredError) {
            setPhase('login');
            return;
          }
          setError(`저장된 이야기를 불러오지 못했습니다. ${errorText(err)}`);
        }
      }
      if (cancelled) return;
      if (claimAutoRun(sessionId)) void generate();
      else setPhase('idle');
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId, retryKey]);

  if (phase === 'checking') {
    return (
      <p className="rounded-xl border border-[#D8CEBE] bg-[#FBF8F1] px-4 py-3 text-sm text-[#5C5349] inline-flex items-center gap-2 w-full" role="status">
        <Loader2 className="w-4 h-4 animate-spin text-[#8E3524]" aria-hidden="true" />
        <span>전생 기록을 확인하는 중이옵니다…</span>
      </p>
    );
  }

  if (phase === 'login') {
    return (
      <div className="rounded-2xl border border-[#D8CEBE] bg-[#FBF8F1] p-6 space-y-4 text-center">
        <p className="font-serif-kr text-lg font-bold text-[#1C1917]">로그인 세션을 확인하지 못했습니다</p>
        <p className="text-sm text-[#5C5349] leading-relaxed">
          어떤 방식으로 로그인했든 맞춤형 전생을 만들 수 있습니다. 만든 이야기·초상화·음성은 로그인한 계정에 저장되어, 다시 방문해도 '내 조각'에서 볼 수 있습니다.
        </p>
        <button
          type="button"
          onClick={() => {
            setPhase('checking');
            setRetryKey((k) => k + 1);
          }}
          className="w-full min-h-[52px] px-6 py-3.5 rounded-xl bg-[#8E3524] text-[#FBF8F1] font-semibold text-base hover:bg-[#762A1C] shadow-sm"
        >
          다시 시도하기
        </button>
        <button
          type="button"
          onClick={() => void loginWithSupabaseGoogle()}
          className="w-full min-h-[48px] px-5 py-3 rounded-xl border border-[#C4B8A3] bg-[#FBF8F1] hover:bg-[#F3ECE0] text-sm font-semibold text-[#26201B] inline-flex items-center justify-center gap-2"
        >
          <LogIn className="w-4 h-4" aria-hidden="true" />
          <span>Google로 로그인</span>
        </button>
      </div>
    );
  }

  if (phase === 'generating' || (phase === 'idle' && !result)) {
    const busy = phase === 'generating';
    const stepRows: Array<{ key: keyof typeof steps; label: string }> = [
      { key: 'zodiac', label: '12간지 소재 풀이' },
      { key: 'story', label: '전생 기록 복원' },
      { key: 'assets', label: '초상화와 목소리 생성' },
    ];
    return (
      <div className="rounded-2xl border border-[#D8CEBE] bg-[#FBF8F1] p-6 space-y-5">
        <p className="font-serif-kr text-lg font-bold text-[#1C1917] text-center">
          {busy ? `${displayName} 님의 전생을 펼치는 중이옵니다…` : '맞춤형 전생 이야기를 만들 수 있습니다'}
        </p>
        {busy && (
          <ol className="space-y-2.5" aria-label="생성 단계">
            {stepRows.map(({ key, label }) => {
              const st = steps[key];
              return (
                <li key={key} className="flex items-center gap-3 rounded-xl border border-[#E5DDD0] bg-white px-4 py-3">
                  <span className="w-6 h-6 shrink-0 rounded-full flex items-center justify-center border border-[#D8CEBE] bg-[#FBF8F1]">
                    {st === 'active' ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin text-[#8E3524]" aria-hidden="true" />
                    ) : st === 'done' ? (
                      <Check className="w-3.5 h-3.5 text-[#8E3524]" aria-hidden="true" />
                    ) : null}
                  </span>
                  <span className={`text-sm ${st === 'active' ? 'font-semibold text-[#1C1917]' : 'text-[#5C5349]'}`}>
                    {label}
                    {st === 'skipped' && <span className="text-xs text-[#78716C]"> (띠 정보 없이 진행)</span>}
                  </span>
                </li>
              );
            })}
          </ol>
        )}
        {error && (
          <div role="alert" className="rounded-xl border border-[#E3C9A8] bg-[#FFF8EC] px-4 py-3 text-left">
            <p className="text-sm font-semibold text-[#7A2E1F]">전생 이야기를 만들지 못했습니다.</p>
            <p className="text-xs text-[#5C5349] mt-1 whitespace-pre-line break-words">{error}</p>
          </div>
        )}
        {!busy && (
          <button
            type="button"
            onClick={() => void generate()}
            className="w-full min-h-[52px] px-6 py-3.5 rounded-xl bg-[#8E3524] text-[#FBF8F1] font-semibold text-base hover:bg-[#762A1C] shadow-sm"
          >
            {error ? '다시 시도하기' : 'AI 전생 이야기 만들기'}
          </button>
        )}
      </div>
    );
  }

  if (!result) return null;

  return (
    <AiPastLifeView
      result={result}
      displayName={displayName}
      imageUrl={urls.image}
      voiceUrl={urls.voice}
      assetPhase={assetPhase}
      onRetryAssets={() => void runAssets(result)}
      disclaimer={disclaimer}
      footer={
        <div className="space-y-2">
          {error && (
            <div role="alert" className="rounded-xl border border-[#E3C9A8] bg-[#FFF8EC] px-4 py-3 text-left">
              <p className="text-sm font-semibold text-[#7A2E1F]">새 이야기를 만들지 못했습니다. 이전 이야기를 그대로 보여 드립니다.</p>
              <p className="text-xs text-[#5C5349] mt-1 whitespace-pre-line break-words">{error}</p>
            </div>
          )}
        </div>
      }
    />
  );
}
