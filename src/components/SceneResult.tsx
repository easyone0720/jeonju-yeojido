import { ReactNode, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowLeft,
  Check,
  ChevronDown,
  ChevronUp,
  Gift,
  Pause,
  Play,
  RotateCcw,
  Shuffle,
  Tv,
  Volume2,
} from 'lucide-react';
import {
  Character,
  characterToStory,
  getOrPickCurrentCharacter,
  parseDialogue,
  pickAnotherCharacter,
} from '../data/characters';
import { PastLifeResult } from '../types/jeonju';
import { buildDownloadableResultCard } from '../utils/portraitPainter';

function SectionCard({
  label,
  children,
  className = '',
}: {
  label: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={`text-left rounded-2xl border border-[#E5DDD0] p-5 space-y-3 shadow-xs ${className}`}>
      <h3 className="font-serif-kr text-base font-bold text-[#1C1917]">{label}</h3>
      {children}
    </section>
  );
}

function formatTime(sec: number): string {
  if (!Number.isFinite(sec) || sec < 0) return '0:00';
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

/** 대표 대사 음성 플레이어 (재생/일시정지/다시 듣기 + 대표 대사 인용구) */
function VoicePlayer({ character }: { character: Character }) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [playing, setPlaying] = useState(false);
  const [current, setCurrent] = useState(0);
  const [duration, setDuration] = useState(0);
  const [failed, setFailed] = useState(false);

  // 캐릭터가 바뀌면 재생 상태를 초기화한다
  useEffect(() => {
    setPlaying(false);
    setCurrent(0);
    setDuration(0);
    setFailed(false);
    const el = audioRef.current;
    if (el) {
      el.pause();
      el.load();
    }
  }, [character.id]);

  const play = useCallback(async () => {
    const el = audioRef.current;
    if (!el) return;
    try {
      await el.play();
      setFailed(false);
    } catch {
      setPlaying(false);
      setFailed(true);
    }
  }, []);

  const toggle = () => {
    const el = audioRef.current;
    if (!el) return;
    if (el.paused) void play();
    else el.pause();
  };

  const replay = () => {
    const el = audioRef.current;
    if (!el) return;
    el.currentTime = 0;
    void play();
  };

  const progress = duration > 0 ? Math.min(100, (current / duration) * 100) : 0;

  return (
    <div className="rounded-2xl border border-[#E5DDD0] bg-white p-4 space-y-3 text-left">
      <audio
        ref={audioRef}
        src={character.audioUrl}
        preload="metadata"
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onEnded={() => {
          setPlaying(false);
          setCurrent(0);
        }}
        onTimeUpdate={(e) => setCurrent(e.currentTarget.currentTime)}
        onLoadedMetadata={(e) => setDuration(e.currentTarget.duration)}
        onError={() => setFailed(true)}
      />

      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={toggle}
          aria-label={playing ? '일시정지' : '재생'}
          className="w-12 h-12 shrink-0 rounded-full bg-[#9A3412] hover:bg-[#7C2D12] text-white flex items-center justify-center transition-colors"
        >
          {playing ? (
            <Pause className="w-5 h-5" aria-hidden="true" />
          ) : (
            <Play className="w-5 h-5 translate-x-px" aria-hidden="true" />
          )}
        </button>

        <div className="flex-1 min-w-0 space-y-1.5">
          <div
            className="h-1.5 rounded-full bg-[#E5DDD0] overflow-hidden"
            role="progressbar"
            aria-label="재생 진행률"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={Math.round(progress)}
          >
            <div className="h-full bg-[#9A3412] transition-[width] duration-150" style={{ width: `${progress}%` }} />
          </div>
          <div className="flex justify-between text-[11px] text-[#78716C] font-mono-tabular">
            <span>{formatTime(current)}</span>
            <span>{formatTime(duration)}</span>
          </div>
        </div>

        <button
          type="button"
          onClick={replay}
          aria-label="다시 듣기"
          className="min-h-[44px] shrink-0 inline-flex items-center gap-1 rounded-full border border-[#D6CEBE] px-3 text-xs font-semibold text-[#57534E] hover:bg-[#F5EFE6] transition-colors"
        >
          <RotateCcw className="w-3.5 h-3.5" aria-hidden="true" />
          <span>다시 듣기</span>
        </button>
      </div>

      <blockquote className="rounded-xl bg-[#F5EFE6] border-l-4 border-[#9A3412] px-4 py-3">
        <p className="flex items-start gap-2 font-serif-kr text-sm font-semibold text-[#1C1917] leading-relaxed">
          <Volume2 className="w-4 h-4 mt-0.5 shrink-0 text-[#9A3412]" aria-hidden="true" />
          <span>“{character.quote}”</span>
        </p>
      </blockquote>

      {failed && (
        <p className="text-xs text-[#9A3412]" role="status">
          음성을 불러오지 못했어요. 잠시 후 다시 눌러 주세요.
        </p>
      )}
    </div>
  );
}

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
  // 이번 체험에서 뽑힌 캐릭터는 sessionStorage 에 고정되어 새로고침해도 유지된다 (처음 뽑을 때만 직전 캐릭터 제외)
  const [character, setCharacter] = useState<Character>(() => getOrPickCurrentCharacter());
  const [saving, setSaving] = useState(false);
  const [shareStatus, setShareStatus] = useState<string | null>(null);
  const [showDetails, setShowDetails] = useState(false);
  const topRef = useRef<HTMLDivElement | null>(null);

  const displayName = visitorName.trim() || '전주 나그네';
  const dialogueRows = useMemo(() => parseDialogue(character.dialogue), [character.dialogue]);

  // 저장 카드는 지금 보이는 캐릭터 기준으로 만든다
  const displayResult = useMemo<PastLifeResult>(
    () => ({
      ...result,
      story: characterToStory(character),
      characterId: character.id,
      portraitDataUrl: character.imageUrl,
      oneLineSummary: character.quote,
    }),
    [result, character],
  );

  const handleAnother = () => {
    setCharacter((prev) => pickAnotherCharacter(prev.id));
    setShareStatus(null);
    topRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const handleSaveImage = async () => {
    setSaving(true);
    try {
      const cardDataUrl = await buildDownloadableResultCard(displayResult, visitorName);
      const link = document.createElement('a');
      link.href = cardDataUrl;
      link.download = `전생여지도_${character.title.replace(/[\\/:*?"<>|]/g, '')}.png`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } finally {
      setSaving(false);
    }
  };

  const handleShare = async () => {
    const shareText = `[전생여지도] 나의 전주 전생은 '${character.title}'!\n“${character.quote}”`;
    try {
      if (typeof navigator !== 'undefined' && navigator.share) {
        await navigator.share({
          title: `전생여지도 — ${character.title}`,
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
    <div className="min-h-app hanji-texture flex flex-col pb-24">
      <header className="w-full px-4 h-12 flex items-center justify-between max-w-[430px] mx-auto">
        <button
          type="button"
          onClick={onBackToMap}
          className="inline-flex items-center gap-1 text-sm text-[#57534E] hover:text-[#1C1917] min-h-[44px]"
        >
          <ArrowLeft className="w-4 h-4" aria-hidden="true" />
          <span>지도</span>
        </button>
        <span className="text-xs font-medium text-[#9A3412]">{displayName} 님의 전생 기록</span>
      </header>

      <main className="flex-1 mx-auto w-full max-w-[430px] px-4 py-3 space-y-5 pb-14">
        <div ref={topRef} className="scroll-mt-2" />

        {/* 1) 상단 카드: 16:9 캐릭터 이미지 + 타이틀 + 음성 플레이어 */}
        <section className="space-y-4 text-center">
          <div className="relative w-full rounded-2xl overflow-hidden border border-[#C7B596] bg-[#EFE5D0] shadow-md">
            <img
              key={character.id}
              src={character.imageUrl}
              alt={`${character.title} 전생 캐릭터 일러스트`}
              className="w-full aspect-video object-cover object-top block"
            />
          </div>
          <h1 className="font-serif-kr text-2xl font-bold text-[#1C1917] leading-snug">
            {character.emoji} {character.title}
          </h1>
          <VoicePlayer character={character} />
        </section>

        {/* 2) 설정 */}
        <SectionCard label="📜 설정" className="bg-white">
          <p className="text-[15px] text-[#292524] leading-[1.85] whitespace-pre-line">{character.setting}</p>
        </SectionCard>

        {/* 3) 대화: 대본 느낌 */}
        <SectionCard label="🎬 대화" className="bg-[#FBF8F2]">
          <div
            className="rounded-xl border border-dashed border-[#C7B596] bg-white/70 px-4 py-4 space-y-2.5"
            aria-label="그날의 대화 대본"
          >
            {dialogueRows.map((row, idx) =>
              row.kind === 'stage' ? (
                <p key={idx} className="text-[13px] italic text-[#8B7E6F] leading-relaxed pl-2">
                  {row.text}
                </p>
              ) : (
                <p key={idx} className="text-[15px] text-[#292524] leading-[1.7]">
                  {row.speaker && <strong className="font-bold text-[#1C1917]">{row.speaker}: </strong>}
                  <span>{row.text}</span>
                </p>
              ),
            )}
          </div>
        </SectionCard>

        {/* 4) 결과: 한지 문서 느낌 */}
        <section
          className="text-left rounded-2xl p-1.5 bg-[#EBDDBE] border border-[#C7B596] shadow-xs"
          aria-label="전생 결과"
        >
          <div className="rounded-xl border border-[#B89B6A]/60 bg-[#F8F0DC] px-5 py-5 space-y-4">
            <h3 className="font-serif-kr text-base font-bold text-[#1C1917] text-center tracking-wide">
              🏆 결과
            </h3>
            <dl className="space-y-3.5">
              {[
                { label: '직업', value: character.result.job },
                { label: '평판', value: character.result.reputation },
                { label: '업적', value: character.result.achievement },
              ].map((item) => (
                <div key={item.label} className="border-t border-[#B89B6A]/40 pt-3 first:border-t-0 first:pt-0">
                  <dt className="inline-block rounded bg-[#9A3412] px-2 py-0.5 text-[11px] font-bold tracking-widest text-white">
                    {item.label}
                  </dt>
                  <dd className="mt-1.5 text-[15px] text-[#1C1917] leading-[1.7] font-medium">{item.value}</dd>
                </div>
              ))}
            </dl>
          </div>
        </section>

        {/* 5) 인생 마무리 */}
        <section className="text-left rounded-2xl bg-[#292524] text-[#F5EFE6] p-6 space-y-4 shadow-md">
          <h3 className="font-serif-kr text-base font-bold text-[#F5EFE6] text-center">⚰️ 인생 마무리</h3>
          <p className="text-[15px] leading-[1.95] whitespace-pre-line text-[#E7DFD0]">{character.ending}</p>
          <p className="text-[11px] text-[#A8A29E] pt-3 border-t border-white/15">{result.historicalDisclaimer}</p>
        </section>

        <button
          type="button"
          onClick={handleAnother}
          className="w-full min-h-[52px] px-6 py-3.5 rounded-xl border-2 border-[#9A3412] text-[#9A3412] bg-white font-semibold text-base hover:bg-[#9A3412]/5 transition-colors flex items-center justify-center gap-2"
        >
          <Shuffle className="w-4 h-4" aria-hidden="true" />
          <span>다른 전생 확인하기</span>
        </button>

        {/* 공유 / 저장 / 미디어월 */}
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
          <button
            type="button"
            onClick={onGoToMediaConsent}
            className="w-full min-h-[52px] px-6 py-3.5 rounded-xl bg-[#9A3412] text-white font-semibold text-base hover:bg-[#7C2D12] transition-colors flex items-center justify-center gap-2"
          >
            <Tv className="w-4 h-4" aria-hidden="true" />
            <span>미디어월 전시 선택하기</span>
          </button>
        </div>

        {/* 단서 · 굿즈 안내 (접힘) */}
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
                  <span>{character.title} 맞춤 전생 굿즈</span>
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
