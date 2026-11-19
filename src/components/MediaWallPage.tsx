import { useEffect, useState } from 'react';
import { ArrowLeft, Pause, Play, RefreshCw, ScrollText } from 'lucide-react';
import { WallEntry } from '../types/jeonju';
import { synthesizeJoseonPortrait } from '../utils/portraitPainter';
import { apiFetch } from '../utils/localApi';
import { resolveCharacterImage } from '../data/characters';

interface MediaWallPageProps {
  onBackToApp: () => void;
}

export function MediaWallPage({ onBackToApp }: MediaWallPageProps) {
  const [liveEntries, setLiveEntries] = useState<WallEntry[]>([]);
  const [demoSeeds, setDemoSeeds] = useState<WallEntry[]>([]);
  const [seedPortraits, setSeedPortraits] = useState<Record<string, string>>({});
  const [featuredIndex, setFeaturedIndex] = useState(0);
  const [autoPlay, setAutoPlay] = useState(true);
  const [loading, setLoading] = useState(true);

  const fetchWallEntries = async () => {
    try {
      const res = await apiFetch('/api/wall');
      if (!res.ok) return;
      const data = (await res.json()) as {
        liveEntries: WallEntry[];
        demoSeeds: WallEntry[];
      };
      setLiveEntries(data.liveEntries || []);
      setDemoSeeds(data.demoSeeds || []);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchWallEntries();
    const pollTimer = window.setInterval(fetchWallEntries, 6000);
    return () => window.clearInterval(pollTimer);
  }, []);

  // Synthesize crisp archival seed portraits locally once so demo seeds always display rich brushwork
  useEffect(() => {
    let cancelled = false;
    const renderSeeds = async () => {
      const map: Record<string, string> = {};
      for (const seed of demoSeeds) {
        if (!resolveCharacterImage(seed.characterId, seed.portraitDataUrl) && !seedPortraits[seed.id]) {
          const archetypeId =
            seed.title === '목판 각수'
              ? 'woodblock_artisan'
              : seed.title === '감영 관리'
                ? 'gamyeong_official'
                : 'royal_inspector';
          map[seed.id] = await synthesizeJoseonPortrait({
            faceImageDataUrl: null,
            archetypeId,
            title: seed.title,
            hanjaTitle: seed.hanjaTitle,
            visitorName: seed.visitorAlias,
          });
        }
      }
      if (!cancelled && Object.keys(map).length > 0) {
        setSeedPortraits((prev) => ({ ...prev, ...map }));
      }
    };
    if (demoSeeds.length > 0) {
      renderSeeds();
    }
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [demoSeeds]);

  const combinedEntries = [...liveEntries, ...demoSeeds];
  const safeIndex =
    combinedEntries.length > 0 ? featuredIndex % combinedEntries.length : 0;
  const featured = combinedEntries[safeIndex] ?? null;

  useEffect(() => {
    if (!autoPlay || combinedEntries.length <= 1) return;
    const timer = window.setInterval(() => {
      setFeaturedIndex((prev) => (prev + 1) % combinedEntries.length);
    }, 8000);
    return () => window.clearInterval(timer);
  }, [autoPlay, combinedEntries.length]);

  const resolvePortrait = (entry: WallEntry) =>
    resolveCharacterImage(entry.characterId, entry.portraitDataUrl) || seedPortraits[entry.id] || '';

  return (
    <div className="min-h-app hanji-texture-dark text-[#FBF8F2] flex flex-col">
      {/* Exhibition Header */}
      <header className="border-b border-white/10 bg-[#181512]/90 backdrop-blur-md">
        <div className="mx-auto max-w-7xl px-4 sm:px-8 h-16 flex items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <button
              type="button"
              onClick={onBackToApp}
              className="min-h-[44px] px-3 py-1.5 rounded-lg border border-white/15 bg-white/5 hover:bg-white/10 text-xs sm:text-sm font-medium inline-flex items-center gap-1.5"
            >
              <ArrowLeft className="w-4 h-4" aria-hidden="true" />
              <span>체험 화면</span>
            </button>
            <div>
              <h1 className="font-serif-kr text-lg sm:text-xl font-bold tracking-tight text-[#FBF8F2]">
                국립전주박물관 전생여지도 미디어월
              </h1>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className="hidden sm:inline text-xs font-mono-tabular text-[#D4B483] mr-2">
              실시간 동의 전시 {liveEntries.length}건 · 예시 {demoSeeds.length}건
            </span>
            <button
              type="button"
              onClick={() => setAutoPlay((p) => !p)}
              aria-label={autoPlay ? '자동 순환 일시정지' : '자동 순환 재생'}
              className="min-h-[44px] px-3 py-1.5 rounded-lg border border-white/15 bg-white/5 hover:bg-white/10 text-xs font-medium inline-flex items-center gap-1.5"
            >
              {autoPlay ? (
                <>
                  <Pause className="w-3.5 h-3.5" aria-hidden="true" />
                  <span>정지</span>
                </>
              ) : (
                <>
                  <Play className="w-3.5 h-3.5" aria-hidden="true" />
                  <span>순환</span>
                </>
              )}
            </button>
            <button
              type="button"
              onClick={fetchWallEntries}
              aria-label="미디어월 새로고침"
              className="min-w-[44px] min-h-[44px] rounded-lg border border-white/15 bg-white/5 hover:bg-white/10 flex items-center justify-center"
            >
              <RefreshCw className="w-4 h-4" aria-hidden="true" />
            </button>
          </div>
        </div>
      </header>

      <main className="flex-1 mx-auto w-full max-w-7xl px-4 sm:px-8 py-8 flex flex-col justify-between gap-8">
        {loading && combinedEntries.length === 0 ? (
          <div className="flex-1 flex items-center justify-center text-sm text-[#D6CEBE]">
            전생 초상화 전시 목록을 불러오는 중입니다...
          </div>
        ) : featured ? (
          <>
            {/* Spotlight Exhibition Stage */}
            <section className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
              <div className="lg:col-span-5 flex justify-center">
                <div className="w-full max-w-[560px] rounded-2xl overflow-hidden border-2 border-[#C59B43]/50 bg-[#221D18] shadow-2xl">
                  {resolvePortrait(featured) ? (
                    <img
                      src={resolvePortrait(featured)}
                      alt={`${featured.visitorAlias} 님의 전생 초상화`}
                      className="w-full aspect-video object-cover object-top block"
                    />
                  ) : (
                    <div className="w-full aspect-video flex items-center justify-center">
                      <ScrollText className="w-10 h-10 text-[#D4B483]" aria-hidden="true" />
                    </div>
                  )}
                </div>
              </div>

              <div className="lg:col-span-7 space-y-6">
                <div className="space-y-2">
                  <p className="text-xs font-medium tracking-widest text-[#D4B483]">
                    {featured.isDemoSeed
                      ? '전시 예시 작품 (시연 샘플)'
                      : '참여자 동의 전시 작품'}
                  </p>
                  <h2 className="font-serif-kr text-4xl sm:text-5xl font-bold text-[#FBF8F2]">
                    {featured.title}{' '}
                    <span className="text-2xl font-normal text-[#C59B43]">
                      {featured.hanjaTitle}
                    </span>
                  </h2>
                  <p className="text-base text-[#D6CEBE]">
                    {featured.visitorAlias} 님의 전생 · {featured.era}
                  </p>
                </div>

                <blockquote className="border-y border-white/15 py-6 font-serif-kr text-xl sm:text-2xl text-[#F5EFE6] leading-relaxed">
                  “{featured.oneLineSummary}”
                </blockquote>

                <p className="text-xs text-[#A8A29E]">
                  국립전주박물관 로비 미디어월 전용 화면 · 참여자의 전시 동의 하에 최소 정보만 공개됩니다.
                </p>
              </div>
            </section>

            {/* Bottom Exhibition Strip */}
            <section aria-label="전시 목록 선택" className="space-y-3">
              <div className="flex items-center justify-between text-xs text-[#A8A29E]">
                <span>전시 중인 전생 초상 ({combinedEntries.length}점)</span>
                <span>카드를 선택하면 중앙 대형 화면으로 전환됩니다</span>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-3">
                {combinedEntries.map((entry, idx) => {
                  const selected = idx === safeIndex;
                  const imgUrl = resolvePortrait(entry);
                  return (
                    <button
                      key={entry.id}
                      type="button"
                      onClick={() => setFeaturedIndex(idx)}
                      className={`text-left rounded-xl overflow-hidden border transition-all p-2 ${
                        selected
                          ? 'border-[#D4B483] bg-white/10'
                          : 'border-white/10 bg-white/5 hover:border-white/30'
                      }`}
                    >
                      <div className="aspect-video rounded-lg overflow-hidden bg-[#1F1B17] mb-2">
                        {imgUrl && (
                          <img
                            src={imgUrl}
                            alt={`${entry.title} 썸네일`}
                            className="w-full h-full object-cover object-top block"
                          />
                        )}
                      </div>
                      <p className="font-serif-kr text-xs font-bold text-[#FBF8F2] truncate">
                        {entry.title}
                      </p>
                      <p className="text-[11px] text-[#A8A29E] truncate">
                        {entry.visitorAlias} · {entry.isDemoSeed ? '예시' : '실시간'}
                      </p>
                    </button>
                  );
                })}
              </div>
            </section>
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-center space-y-2">
            <ScrollText className="w-10 h-10 text-[#D4B483]" aria-hidden="true" />
            <p className="text-base font-medium">아직 미디어월에 등록된 초상화가 없습니다.</p>
          </div>
        )}
      </main>
    </div>
  );
}
