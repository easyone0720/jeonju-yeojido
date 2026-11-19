import { HahoeDanceCharacter } from './HahoeDanceCharacter';
import { InteractiveNorigae } from './InteractiveNorigae';
import { SceneStartBackdrop } from './SceneStartBackdrop';
import { START_HERO_IMAGE } from '../data/spotImages';

interface SceneStartProps {
  onStart: () => void;
  onNavigateRoute: (path: '/wall' | '/admin') => void;
}

export function SceneStart({
  onStart,
  onNavigateRoute,
}: SceneStartProps) {

  return (
    <div className="relative min-h-app hanji-texture flex flex-col overflow-hidden">
      <SceneStartBackdrop />
      <InteractiveNorigae />
      <div className="fade-up relative z-10 flex-1 flex flex-col">
        {/* Subtle minimal utility header for separate /wall & /admin views without cluttering Scene 1 */}
        <header className="w-full px-4 sm:px-6 pt-3 flex items-center justify-end gap-4 text-xs text-[#78716C]">
        <button
          type="button"
          onClick={() => onNavigateRoute('/wall')}
          className="hover:text-[#9A3412] transition-colors min-h-[36px] px-1 whitespace-nowrap"
        >
          미디어월
        </button>
        <button
          type="button"
          onClick={() => onNavigateRoute('/admin')}
          className="hover:text-[#9A3412] transition-colors min-h-[36px] px-1 whitespace-nowrap"
        >
          운영 현황
        </button>
      </header>

      {/* Faithful Scene 1 vertical layout: Title -> Moon Jar with Dancing Hahoe -> Hook -> Start CTA */}
      <main className="flex-1 mx-auto w-full max-w-md sm:max-w-lg px-5 py-4 sm:py-8 flex flex-col items-center justify-between text-center gap-5">
        {/* Top Service Name */}
        <div className="pt-2 sm:pt-4 space-y-1">
          <h1 className="font-serif-kr text-3xl sm:text-4xl font-bold tracking-tight text-[#1C1917]">
            전생여지도
          </h1>
          <p className="text-xs tracking-widest text-[#78716C]">前生輿地圖</p>
        </div>

        {/* Center Joseon White Porcelain Moon Jar (백자 달항아리) containing the Dancing Character */}
        <div className="flex flex-col items-center gap-5 my-auto">
          <div className="relative isolate flex items-center justify-center w-[264px] h-[250px] sm:w-[314px] sm:h-[296px]">
            {/* Sculpted White Porcelain Moon Jar SVG */}
            <svg
              viewBox="0 0 320 300"
              className="pointer-events-none select-none absolute inset-0 w-full h-full drop-shadow-md"
              fill="none"
              aria-hidden="true"
            >
              <defs>
                <radialGradient id="moonJarGlaze" cx="40%" cy="34%" r="62%">
                  <stop offset="0%" stopColor="#FFFDF8" />
                  <stop offset="48%" stopColor="#F9F4E8" />
                  <stop offset="80%" stopColor="#EDE4D2" />
                  <stop offset="94%" stopColor="#DED1BA" />
                  <stop offset="100%" stopColor="#CBBBA0" />
                </radialGradient>
                <linearGradient id="moonJarRim" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#FDF9EF" />
                  <stop offset="55%" stopColor="#ECE2CE" />
                  <stop offset="100%" stopColor="#D7C8AE" />
                </linearGradient>
                <linearGradient id="moonJarMouthShadow" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#C2B298" />
                  <stop offset="100%" stopColor="#EDE4D2" />
                </linearGradient>
                <radialGradient id="moonJarGroundShadow" cx="50%" cy="50%" r="50%">
                  <stop offset="0%" stopColor="#7C6D56" stopOpacity="0.28" />
                  <stop offset="70%" stopColor="#9C8C72" stopOpacity="0.1" />
                  <stop offset="100%" stopColor="#9C8C72" stopOpacity="0" />
                </radialGradient>
              </defs>

              {/* Soft porcelain contact shadow beneath foot */}
              <ellipse cx="160" cy="288" rx="76" ry="9" fill="url(#moonJarGroundShadow)" />

              {/* Porcelain foot ring (굽) */}
              <path
                d="M112 275 Q 160 282 208 275 L 204 285 Q 160 291 116 285 Z"
                fill="#DDD0BA"
                stroke="#C5B59B"
                strokeWidth="0.9"
              />

              {/* Classic asymmetric plump Moon Jar belly silhouette */}
              <path
                d="M114 28 C 110 38, 90 46, 66 64 C 24 96, 16 144, 24 184 C 34 232, 72 266, 114 277 Q 160 284 206 277 C 248 266, 286 232, 296 184 C 304 144, 296 96, 254 64 C 230 46, 210 38, 206 28 Z"
                fill="url(#moonJarGlaze)"
                stroke="#CBBCA2"
                strokeWidth="1.2"
              />

              {/* Subtle porcelain shoulder & neck highlight */}
              <ellipse
                cx="118"
                cy="98"
                rx="46"
                ry="26"
                transform="rotate(-24 118 98)"
                fill="#FFFFFF"
                opacity="0.48"
              />

              {/* Delicate horizontal wheel-thrown ceramic seam line (달항아리 접합선) */}
              <path
                d="M23 156 Q 160 165 297 156"
                stroke="#D9CCB4"
                strokeWidth="0.8"
                opacity="0.38"
              />

              {/* Flared top porcelain lip & interior opening */}
              <path
                d="M107 18 C 109 24, 113 30, 114 34 Q 160 40 206 34 C 207 30, 211 24, 213 18 Q 160 23 107 18 Z"
                fill="url(#moonJarRim)"
                stroke="#C9B99E"
                strokeWidth="1"
              />
              <ellipse
                cx="160"
                cy="18"
                rx="53"
                ry="6.5"
                fill="url(#moonJarMouthShadow)"
                stroke="#D3C4AA"
                strokeWidth="1"
              />
              <ellipse cx="160" cy="18.5" rx="44" ry="3.8" fill="#FDF9F0" opacity="0.45" />
            </svg>

            {/* Dancing Hahoe Character multiplied onto the porcelain surface (white studio backdrop disappears seamlessly) */}
            <div className="relative z-10 w-[212px] h-[212px] sm:w-[254px] sm:h-[254px] mt-5">
              <div className="character-hover-wrapper mix-blend-multiply">
                <HahoeDanceCharacter src={START_HERO_IMAGE} />
              </div>
            </div>
          </div>

          {/* Hook Quote directly beneath illustration */}
          <p className="font-serif-kr text-xl sm:text-2xl font-semibold text-[#1C1917] leading-relaxed max-w-xs sm:max-w-sm">
            “어서 오시게, 전생을 찾으러 왔는가?”
          </p>
        </div>

        {/* Bottom Primary CTA ('시작하기') */}
        <div className="w-full max-w-xs sm:max-w-sm space-y-3 pb-4 safe-pb">
          <button
            type="button"
            onClick={onStart}
            className="hover-scale w-full min-h-[52px] px-6 py-3.5 rounded-xl bg-[#9A3412] text-white font-semibold text-base hover:bg-[#7C2D12] active:scale-[0.99] shadow-sm"
          >
            시작하기
          </button>
        </div>
      </main>
      </div>
    </div>
  );
}
