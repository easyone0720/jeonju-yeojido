import { ReactNode, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowLeft,
  Check,
  Pause,
  Play,
  RotateCcw,
  Shuffle,
  Tv,
  Volume2,
} from 'lucide-react';
import { Character, characterToStory, parseDialogue } from '../services/pastLife';
import { usePastLifeGeneration } from '../hooks/usePastLifeGeneration';
import { getPastLifeMode } from '../config/features';
import { getCharacterById, getOrPickCurrentCharacter } from '../data/characters';
import { PAST_LIFE_ARCHETYPES } from '../data/jeonjuSpots';
import { AiPastLifeSection } from './AiPastLifeSection';
import { PastLifeResult } from '../types/jeonju';
import { buildAiResultCard, buildDownloadableResultCard } from '../utils/portraitPainter';
import { buildShareUrl } from '../services/aiPastLife/api';
import { markResultSeen, useLatestAiResult } from '../services/aiPastLife/latest';

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
    <section className={`text-left rounded-2xl border border-[#D8CEBE] p-5 space-y-3 shadow-xs ${className}`}>
      <h3 className="font-serif-kr text-base font-bold text-[#26201B]">{label}</h3>
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
    <div className="rounded-2xl border border-[#D8CEBE] bg-white p-4 space-y-3 text-left">
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
          className="w-12 h-12 shrink-0 rounded-full bg-[#8E3524] hover:bg-[#762A1C] text-white flex items-center justify-center transition-colors"
        >
          {playing ? (
            <Pause className="w-5 h-5" aria-hidden="true" />
          ) : (
            <Play className="w-5 h-5 translate-x-px" aria-hidden="true" />
          )}
        </button>

        <div className="flex-1 min-w-0 space-y-1.5">
          <div
            className="h-1.5 rounded-full bg-[#D8CEBE] overflow-hidden"
            role="progressbar"
            aria-label="재생 진행률"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={Math.round(progress)}
          >
            <div className="h-full bg-[#8E3524] transition-[width] duration-150" style={{ width: `${progress}%` }} />
          </div>
          <div className="flex justify-between text-[11px] text-[#5C5349] font-mono-tabular">
            <span>{formatTime(current)}</span>
            <span>{formatTime(duration)}</span>
          </div>
        </div>

        <button
          type="button"
          onClick={replay}
          aria-label="다시 듣기"
          className="min-h-[44px] shrink-0 inline-flex items-center gap-1 rounded-full border border-[#D6CBB9] px-3 text-xs font-semibold text-[#5C5349] hover:bg-[#F5EFE6] transition-colors"
        >
          <RotateCcw className="w-3.5 h-3.5" aria-hidden="true" />
          <span>다시 듣기</span>
        </button>
      </div>

      <blockquote className="rounded-xl bg-[#F5EFE6] border-l-4 border-[#8E3524] px-4 py-3">
        <p className="flex items-start gap-2 font-serif-kr text-sm font-semibold text-[#26201B] leading-relaxed">
          <Volume2 className="w-4 h-4 mt-0.5 shrink-0 text-[#8E3524]" aria-hidden="true" />
          <span>“{character.quote}”</span>
        </p>
      </blockquote>

      {failed && (
        <p className="text-xs text-[#8E3524]" role="status">
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

/**
 * 전생 결과 화면. 결과 데이터는 usePastLifeGeneration 훅(서비스 계층)으로만 받는다.
 * Mock 모드에서는 이 탭에 고정된 캐릭터가 즉시 준비되므로 기존과 똑같이 로딩 없이 그려진다.
 */
export function SceneResult(props: SceneResultProps) {
  // 모드는 페이지를 연 동안 바뀌지 않는다. 'api' 는 맞춤형 AI 전생, 'mock' 은 기존 화면 그대로.
  return getPastLifeMode() === 'api' ? <ApiSceneResult {...props} /> : <MockSceneResult {...props} />;
}

/**
 * 맞춤형 AI 전생 결과 (API 모드). 이야기·초상화·음성은 AiPastLifeSection 이 서버에서 받아 그린다.
 * 공유·저장·미디어월·조각·굿즈 안내 영역은 기존 화면을 그대로 쓴다(기준 캐릭터 = 결과에 고정된 캐릭터).
 */
function ApiSceneResult(props: SceneResultProps) {
  const character = useMemo(
    () => getCharacterById(props.result.characterId) ?? getOrPickCurrentCharacter(),
    [props.result.characterId],
  );
  // 4개 조각: 지도에서 받은 조각과 같은 문자열 (서버가 허용 목록과 정확히 대조한다)
  const fragments = useMemo(() => {
    const a = PAST_LIFE_ARCHETYPES[props.result.archetypeId as keyof typeof PAST_LIFE_ARCHETYPES];
    return a ? { era: a.era, status: `${a.title} (${a.hanjaTitle})`, story: a.storySeed, item: a.item } : null;
  }, [props.result.archetypeId]);
  return (
    <SceneResultBody
      {...props}
      character={character}
      onAnother={() => {}}
      storySlot={
        <AiPastLifeSection
          sessionId={props.result.sessionId}
          visitorName={props.visitorName}
          zodiacCode={props.result.zodiacCode ?? null}
          fragments={fragments}
          disclaimer={props.result.historicalDisclaimer}
        />
      }
    />
  );
}

function MockSceneResult(props: SceneResultProps) {
  const generation = usePastLifeGeneration();

  if (!generation.character) {
    const failedPart = [generation.story, generation.image, generation.voice].find((p) => p.status === 'error');
    return (
      <div className="min-h-app hanji-texture flex flex-col pb-[calc(7rem+env(safe-area-inset-bottom))]">
        <main className="flex-1 mx-auto w-full max-w-5xl px-4 sm:px-6 py-10 flex flex-col items-center justify-center gap-4 text-center">
          {failedPart ? (
            <>
              <p className="text-[15px] text-[#26201B]">전생 기록을 불러오지 못했습니다.</p>
              <button
                type="button"
                onClick={generation.retry}
                className="rounded-full bg-[#8E3524] hover:bg-[#762A1C] text-white px-5 py-2.5 text-sm font-semibold"
              >
                다시 시도하기
              </button>
            </>
          ) : (
            <p className="text-[15px] text-[#5C5349]" role="status" aria-live="polite">
              전생 기록을 펼치는 중이옵니다…
            </p>
          )}
        </main>
      </div>
    );
  }

  return (
    <div data-past-life-mode={generation.mode} data-past-life-source={generation.source ?? ''} className="contents">
      <SceneResultBody {...props} character={generation.character} onAnother={generation.another} />
    </div>
  );
}

function SceneResultBody({
  result,
  visitorName,
  onBackToMap,
  onGoToMediaConsent,
  character,
  onAnother,
  storySlot,
}: SceneResultProps & {
  character: Character;
  onAnother: () => void;
  /** API 모드: 이야기·초상화·음성 영역을 이 내용으로 바꾼다 (공유·저장·미디어월·안내 영역은 그대로) */
  storySlot?: ReactNode;
}) {
  const [saving, setSaving] = useState(false);
  const [shareStatus, setShareStatus] = useState<string | null>(null);
  const topRef = useRef<HTMLDivElement | null>(null);
  // 결과 화면을 열면 홈 하단 완성 배너의 "새 결과" 강조를 끈다
  useEffect(() => markResultSeen(result.sessionId), [result.sessionId]);
  // API 모드: 화면에 보이는 AI 결과(제목·초상화·결과 문구). 저장·공유는 이 값으로 만든다
  const latestAi = useLatestAiResult(result.sessionId);
  const ai = storySlot ? latestAi : null;

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
    onAnother();
    setShareStatus(null);
    topRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const handleSaveImage = async () => {
    setSaving(true);
    try {
      const cardDataUrl = ai
        ? await buildAiResultCard({
            visitorName,
            title: ai.title,
            imageUrl: ai.imageUrl,
            categoryName: ai.categoryName,
            job: ai.job,
            reputation: ai.reputation,
            achievement: ai.achievement,
          })
        : await buildDownloadableResultCard(displayResult, visitorName);
      const link = document.createElement('a');
      link.href = cardDataUrl;
      link.download = `전생여지도_${(ai?.title ?? character.title).replace(/[\/:*?"<>|]/g, '')}.png`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch {
      setShareStatus('이미지를 저장하지 못했습니다. 잠시 후 다시 시도해 주세요.');
    } finally {
      setSaving(false);
    }
  };

  const handleShare = async () => {
    // API 모드: 이 결과를 바로 열 수 있는 공유 주소(?sharedResult=<id>)와 제목·요약을 함께 보낸다
    const title = ai?.title ?? character.title;
    const quote = ai?.oneLine ?? character.quote;
    const shareUrl = ai ? buildShareUrl(ai.id) : window.location.origin;
    const shareText = `[전생여지도] 나의 전주 전생은 '${title}'!
“${quote}”`;
    try {
      if (typeof navigator !== 'undefined' && navigator.share) {
        await navigator.share({ title: `전생여지도 — ${title}`, text: shareText, url: shareUrl });
        return;
      }
      if (typeof navigator !== 'undefined' && navigator.clipboard) {
        await navigator.clipboard.writeText(`${shareText}
${shareUrl}`);
        setShareStatus('전생 결과 링크가 클립보드에 복사되었습니다.');
        return;
      }
      setShareStatus('이 브라우저에서는 저장하기 버튼을 이용해 주세요.');
    } catch {
      // 사용자가 공유창을 닫은 경우 등: 안내 없이 넘어간다
    }
  };

  return (
    <div className="min-h-app hanji-texture flex flex-col pb-[calc(7rem+env(safe-area-inset-bottom))]">
      <main className="flex-1 mx-auto w-full max-w-5xl px-4 sm:px-6 py-4 space-y-5">
        {/* 서브 헤더: 공통 상단 배너 바로 아래 */}
        <div className="flex items-center justify-between gap-3 rounded-2xl border border-[#D8CEBE] bg-[#FBF8F1]/95 px-4 py-1.5">
          <button
            type="button"
            onClick={onBackToMap}
            className="inline-flex items-center gap-1 text-sm text-[#5C5349] hover:text-[#26201B] min-h-[44px]"
          >
            <ArrowLeft className="w-4 h-4" aria-hidden="true" />
            <span>지도</span>
          </button>
          <span className="text-xs font-medium text-[#8E3524] truncate">{displayName} 님의 전생 기록</span>
        </div>

        <div ref={topRef} className="scroll-mt-16" />

        <div className="space-y-5 lg:space-y-0 lg:grid lg:grid-cols-12 lg:gap-8 lg:items-start">
        {storySlot ? null : (
        <div className="lg:col-span-5 lg:sticky lg:top-20">

        {/* 1) 상단 카드: 9:16 세로 캐릭터 이미지 + 타이틀 + 음성 플레이어 */}
        <section className="space-y-4 text-center">
          <div className="relative w-full max-w-[270px] sm:max-w-[310px] aspect-[9/16] mx-auto rounded-2xl overflow-hidden border border-[#D8CEBE] bg-[#F3ECE0] shadow-md">
            <img
              key={character.id}
              src={character.imageUrl}
              alt={`${character.title} 전생 캐릭터 일러스트`}
              className="w-full h-full object-contain object-center block"
            />
          </div>
          <h1 className="font-serif-kr text-[clamp(1.25rem,3.5vw,1.875rem)] font-bold text-[#26201B] leading-snug">
            {character.emoji} {character.title}
          </h1>
          <VoicePlayer character={character} />
        </section>

        </div>
        )}
        <div className={storySlot ? 'lg:col-span-12 space-y-5' : 'lg:col-span-7 space-y-5'}>
        {storySlot ?? (
        <>
        {/* 2) 설정 */}
        <SectionCard label="📜 설정" className="bg-white">
          <p className="text-[15px] text-[#292524] leading-[1.85] whitespace-pre-line">{character.setting}</p>
        </SectionCard>

        {/* 3) 대화: 대본 느낌 */}
        <SectionCard label="🎬 대화" className="bg-[#FBF8F1]">
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
                  {row.speaker && <strong className="font-bold text-[#26201B]">{row.speaker}: </strong>}
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
            <h3 className="font-serif-kr text-base font-bold text-[#26201B] text-center tracking-wide">
              🏆 결과
            </h3>
            <dl className="space-y-3.5">
              {[
                { label: '직업', value: character.result.job },
                { label: '평판', value: character.result.reputation },
                { label: '업적', value: character.result.achievement },
              ].map((item) => (
                <div key={item.label} className="border-t border-[#B89B6A]/40 pt-3 first:border-t-0 first:pt-0">
                  <dt className="inline-block rounded bg-[#8E3524] px-2 py-0.5 text-[11px] font-bold tracking-widest text-white">
                    {item.label}
                  </dt>
                  <dd className="mt-1.5 text-[15px] text-[#26201B] leading-[1.7] font-medium">{item.value}</dd>
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
          className="w-full min-h-[52px] px-6 py-3.5 rounded-xl border-2 border-[#8E3524] text-[#8E3524] bg-white font-semibold text-base hover:bg-[#8E3524]/5 transition-colors flex items-center justify-center gap-2"
        >
          <Shuffle className="w-4 h-4" aria-hidden="true" />
          <span>다른 전생 확인하기</span>
        </button>
        </>
        )}

        {/* 공유 / 저장 / 미디어월 */}
        <div className="space-y-2.5 pt-1">
          <button
            type="button"
            onClick={handleShare}
            className="w-full min-h-[48px] px-5 py-3 rounded-xl border border-[#C4B8A3] bg-[#FBF8F1] hover:bg-[#F3ECE0] text-sm font-semibold text-[#26201B] transition-colors"
          >
            공유하기
          </button>
          <button
            type="button"
            disabled={saving}
            onClick={handleSaveImage}
            className="w-full min-h-[48px] px-5 py-3 rounded-xl bg-[#2B3E50] hover:bg-[#223242] text-sm font-semibold text-[#FBF8F1] transition-colors disabled:opacity-60"
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
            className="w-full min-h-[48px] px-5 py-3 rounded-xl bg-[#8E3524] hover:bg-[#762A1C] text-sm font-semibold text-[#FBF8F1] transition-colors flex items-center justify-center gap-2"
          >
            <Tv className="w-4 h-4" aria-hidden="true" />
            <span>미디어월 전시 선택하기</span>
          </button>
        </div>

        </div>
        </div>
      </main>
    </div>
  );
}
