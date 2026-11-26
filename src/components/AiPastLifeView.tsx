/**
 * 맞춤형 AI 전생 결과 렌더러 (상태 없음). 결과 화면과 '나의 전생 기록' 다시 보기에서 같이 쓴다.
 * 스타일은 DESIGN_SYSTEM.md 의 사용자 화면 공식 값(#8E3524 · #FBF8F1 · #1C1917 · #D8CEBE, 칠교 배색)만 쓴다.
 */
import { ReactNode, useEffect, useRef, useState } from 'react';
import { ImageOff, Loader2, Pause, Play, RotateCcw, Volume2 } from 'lucide-react';
import type { PastLifeResultView } from '../services/aiPastLife/api';

export type AssetPhase = 'idle' | 'loading' | 'done';

function SectionCard({ label, children, className = '' }: { label: string; children: ReactNode; className?: string }) {
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
  return `${m}:${String(s).padStart(2, '0')}`;
}

/** 낭독 음성 플레이어 — 기존 VoicePlayer 와 같은 모양 */
export function NarrationPlayer({ url }: { url: string }) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [playing, setPlaying] = useState(false);
  const [current, setCurrent] = useState(0);
  const [duration, setDuration] = useState(0);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    setPlaying(false);
    setCurrent(0);
    setDuration(0);
    setFailed(false);
  }, [url]);

  const toggle = () => {
    const a = audioRef.current;
    if (!a) return;
    if (a.paused) void a.play().catch(() => setFailed(true));
    else a.pause();
  };
  const replay = () => {
    const a = audioRef.current;
    if (!a) return;
    a.currentTime = 0;
    void a.play().catch(() => setFailed(true));
  };
  const progress = duration > 0 ? Math.min(100, (current / duration) * 100) : 0;

  return (
    <div className="rounded-2xl border border-[#D8CEBE] bg-white p-4 space-y-2 text-left">
      <audio
        ref={audioRef}
        src={url}
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
      <p className="flex items-center gap-1.5 text-xs font-semibold text-[#5C5349]">
        <Volume2 className="w-3.5 h-3.5 text-[#8E3524]" aria-hidden="true" />
        <span>전생 낭독 듣기</span>
      </p>
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={toggle}
          aria-label={playing ? '일시정지' : '재생'}
          className="w-12 h-12 shrink-0 rounded-full bg-[#8E3524] hover:bg-[#762A1C] text-white flex items-center justify-center transition-colors"
        >
          {playing ? <Pause className="w-5 h-5" aria-hidden="true" /> : <Play className="w-5 h-5 translate-x-px" aria-hidden="true" />}
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
      {failed && (
        <p className="text-xs text-[#B91C1C]" role="alert">
          음성을 재생하지 못했습니다.
        </p>
      )}
    </div>
  );
}

/** 유형·띠 배지 (DESIGN_SYSTEM 5.4) */
export function ResultBadges({ categoryName, zodiacName }: { categoryName: string; zodiacName: string | null }) {
  return (
    <div className="flex flex-wrap items-center justify-center gap-2">
      <span className="inline-flex items-center gap-1 rounded-full border border-[#344B68]/45 bg-[#FBF8F1] px-2.5 py-0.5 text-[11px] font-semibold text-[#344B68]">
        {categoryName}
      </span>
      {zodiacName && (
        <span className="inline-flex items-center gap-1.5 rounded-full border border-[#D8CEBE] bg-[#FBF8F1] px-2.5 py-0.5 text-[11px] font-semibold text-[#1C1917]">
          <span className="w-1.5 h-1.5 rounded-full bg-[#A94731]" aria-hidden="true" />
          {zodiacName}
        </span>
      )}
    </div>
  );
}

interface AiPastLifeViewProps {
  result: PastLifeResultView;
  displayName: string;
  imageUrl: string | null;
  voiceUrl: string | null;
  assetPhase: AssetPhase;
  onRetryAssets?: () => void;
  disclaimer?: string;
  /** 오른쪽 열 맨 아래에 붙일 내용 (예: 다른 이야기 만들기 버튼) */
  footer?: ReactNode;
}

export function AiPastLifeView({
  result,
  displayName,
  imageUrl,
  voiceUrl,
  assetPhase,
  onRetryAssets,
  disclaimer,
  footer,
}: AiPastLifeViewProps) {
  const story = result.story;
  // 외부 초상화 생성이 모두 실패하면 기존 캐릭터 초상화(/characters/NN.jpg)를 대신 보여 주지만, 다시 만들기는 계속 허용한다
  const imageIsFallback = !!imageUrl && imageUrl.startsWith('/characters/');
  const imageMissing = assetPhase === 'done' && !imageUrl;
  const voiceMissing = assetPhase === 'done' && !voiceUrl;

  return (
    <div className="space-y-5 lg:space-y-0 lg:grid lg:grid-cols-12 lg:gap-8 lg:items-start">
      <div className="lg:col-span-5 lg:sticky lg:top-20">
        <section className="space-y-4 text-center">
          <div className="relative w-full max-w-[270px] sm:max-w-[310px] aspect-[9/16] mx-auto rounded-2xl overflow-hidden border border-[#D8CEBE] bg-[#F3ECE0] shadow-md">
            {imageUrl ? (
              <img
                key={imageUrl}
                src={imageUrl}
                alt={`${story.title} 전생 초상화`}
                className="w-full h-full object-contain object-center block"
              />
            ) : (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 px-6 text-center">
                {assetPhase === 'loading' ? (
                  <>
                    <Loader2 className="w-6 h-6 animate-spin text-[#8E3524]" aria-hidden="true" />
                    <p className="text-sm text-[#5C5349]" role="status">
                      초상화를 그리는 중이옵니다…
                    </p>
                  </>
                ) : (
                  <>
                    <ImageOff className="w-6 h-6 text-[#78716C]" aria-hidden="true" />
                    <p className="text-sm text-[#5C5349]">{imageMissing ? '초상화를 만들지 못했습니다.' : '초상화가 아직 없습니다.'}</p>
                  </>
                )}
              </div>
            )}
          </div>
          <ResultBadges categoryName={result.category_name} zodiacName={result.zodiac_name} />
          <h1 className="font-serif-kr text-[clamp(1.25rem,3.5vw,1.875rem)] font-bold text-[#26201B] leading-snug">
            {story.title}
          </h1>
          <p className="text-xs text-[#78716C]">{displayName} 님의 맞춤 전생</p>
          {voiceUrl ? (
            <NarrationPlayer url={voiceUrl} />
          ) : (
            <p
              className="rounded-xl border border-[#D8CEBE] bg-[#FBF8F1] px-4 py-3 text-sm text-[#5C5349] inline-flex items-center justify-center gap-2 w-full"
              role="status"
            >
              {assetPhase === 'loading' ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin text-[#8E3524]" aria-hidden="true" />
                  <span>목소리를 입히는 중이옵니다…</span>
                </>
              ) : (
                <span>{voiceMissing ? '낭독 음성을 만들지 못했습니다.' : '낭독 음성이 아직 없습니다.'}</span>
              )}
            </p>
          )}
          {assetPhase !== 'loading' && (!imageUrl || imageIsFallback || !voiceUrl) && onRetryAssets && (
            <button
              type="button"
              onClick={onRetryAssets}
              className="min-h-[40px] rounded-full bg-[#8E3524] hover:bg-[#762A1C] px-4 text-xs font-semibold text-white"
            >
              초상화·음성 다시 만들기
            </button>
          )}
        </section>
      </div>

      <div className="lg:col-span-7 space-y-5">
        <SectionCard label="📜 설정" className="bg-white">
          <p className="text-[15px] text-[#292524] leading-[1.85] whitespace-pre-line">{story.story.setting}</p>
        </SectionCard>

        <SectionCard label="🎬 대화" className="bg-[#FBF8F1]">
          <div className="rounded-xl border border-dashed border-[#C7B596] bg-white/70 px-4 py-4 space-y-2.5" aria-label="그날의 대화 대본">
            {story.story.dialogue.map((row, idx) =>
              row.speaker ? (
                <p key={idx} className="text-[15px] text-[#292524] leading-[1.7]">
                  <strong className="font-bold text-[#26201B]">{row.speaker}: </strong>
                  <span>{row.line}</span>
                </p>
              ) : (
                <p key={idx} className="text-[13px] italic text-[#8B7E6F] leading-relaxed pl-2">
                  {row.line}
                </p>
              ),
            )}
          </div>
        </SectionCard>

        <section className="text-left rounded-2xl p-1.5 bg-[#EBDDBE] border border-[#C7B596] shadow-xs" aria-label="전생 결산">
          <div className="rounded-xl border border-[#B89B6A]/60 bg-[#F8F0DC] px-5 py-5 space-y-4">
            <h3 className="font-serif-kr text-base font-bold text-[#26201B] text-center tracking-wide">🏆 결과</h3>
            <dl className="space-y-3.5">
              {[
                { label: '직업', value: story.story.result.job },
                { label: '평판', value: story.story.result.reputation },
                { label: '업적', value: story.story.result.achievement },
              ].map((item) => (
                <div key={item.label} className="border-t border-[#B89B6A]/40 pt-3 first:border-t-0 first:pt-0">
                  <dt className="inline-block rounded bg-[#8E3524] px-2 py-0.5 text-[11px] font-bold tracking-widest text-white">{item.label}</dt>
                  <dd className="mt-1.5 text-[15px] text-[#26201B] leading-[1.7] font-medium">{item.value}</dd>
                </div>
              ))}
            </dl>
          </div>
        </section>

        <section className="text-left rounded-2xl bg-[#292524] text-[#F5EFE6] p-6 space-y-4 shadow-md">
          <h3 className="font-serif-kr text-base font-bold text-[#F5EFE6] text-center">⚰️ 인생 마무리</h3>
          <p className="text-[15px] leading-[1.95] whitespace-pre-line text-[#E7DFD0]">{story.story.ending}</p>
          {disclaimer && <p className="text-[11px] text-[#A8A29E] pt-3 border-t border-white/15">{disclaimer}</p>}
        </section>

        {footer}
      </div>
    </div>
  );
}
