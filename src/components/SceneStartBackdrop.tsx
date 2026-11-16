/**
 * Natural Korean Ink-Wash (수묵 담채화) Backdrop for Scene 1:
 * - Double hairline frame with Wan-ja corner frets
 * - Top-left gnarled Korean ink-wash pine branch (수묵 소나무 가지)
 * - Bottom layered misty ink-wash mountain ridges (수묵 산수)
 * - Right mountain slope miniature Hanok pavilion (산 위 정자) & pine tufts
 */

function CornerFret({ position }: { position: 'tl' | 'tr' | 'bl' | 'br' }) {
  const posMap: Record<typeof position, string> = {
    tl: 'top-0 left-0',
    tr: 'top-0 right-0 -scale-x-100',
    bl: 'bottom-0 left-0 -scale-y-100',
    br: 'bottom-0 right-0 -scale-x-100 -scale-y-100',
  };

  return (
    <svg
      viewBox="0 0 42 42"
      className={`absolute w-8 h-8 sm:w-10 sm:h-10 text-[#9C8362]/75 ${posMap[position]}`}
      fill="none"
      aria-hidden="true"
    >
      <path
        d="M2 40V2H40M2 12H20V2M12 2V22H2M12 12H28V2M2 22H18V32"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="square"
      />
    </svg>
  );
}

/** Radiating ink-wash pine needle cluster (솔잎 다발) */
function PineNeedleFan({
  cx,
  cy,
  scale = 1,
  rotate = 0,
  opacity = 0.72,
}: {
  cx: number;
  cy: number;
  scale?: number;
  rotate?: number;
  opacity?: number;
}) {
  const angles = [-72, -58, -45, -32, -20, -8, 4, 16, 28, 40, 52, 64];
  return (
    <g transform={`translate(${cx} ${cy}) rotate(${rotate}) scale(${scale})`} opacity={opacity}>
      {/* Soft misty ink aura behind needles */}
      <ellipse cx="0" cy="-16" rx="22" ry="11" fill="#5A5349" opacity="0.14" filter="url(#inkSoftBlur)" />
      {angles.map((deg, idx) => {
        const len = 24 + (idx % 3) * 4;
        const curve = deg * 0.14;
        return (
          <path
            key={deg}
            d={`M0 0 Q ${curve} ${-len * 0.55} ${Math.sin((deg * Math.PI) / 180) * len} ${-Math.cos((deg * Math.PI) / 180) * len}`}
            stroke={idx % 2 === 0 ? '#4B453C' : '#6D665B'}
            strokeWidth={idx % 3 === 0 ? '1.15' : '0.85'}
            strokeLinecap="round"
            fill="none"
          />
        );
      })}
    </g>
  );
}

/** Miniature ink-wash pine silhouette for distant mountain slopes */
function SlopePine({ x, y, scale = 1, opacity = 0.55 }: { x: number; y: number; scale?: number; opacity?: number }) {
  return (
    <g transform={`translate(${x} ${y}) scale(${scale})`} opacity={opacity} fill="#5C554C">
      <path d="M0 0v-14" stroke="#4F4940" strokeWidth="1.4" strokeLinecap="round" />
      <ellipse cx="0" cy="-15" rx="9" ry="3.2" />
      <ellipse cx="-6" cy="-11" rx="6" ry="2.4" />
      <ellipse cx="7" cy="-10" rx="6.5" ry="2.5" />
    </g>
  );
}

export function SceneStartBackdrop() {
  return (
    <div
      className="pointer-events-none select-none absolute inset-0 z-0 overflow-hidden"
      aria-hidden="true"
    >
      {/* Double rectangular hairline border frame with 4 Wan-ja corners */}
      <div className="absolute top-12 sm:top-14 left-3 right-3 sm:left-6 sm:right-6 lg:left-8 lg:right-8 bottom-3 sm:bottom-6 border border-[#B7A282]/75">
        <div className="absolute inset-1.5 border border-[#C9B698]/55" />
        <CornerFret position="tl" />
        <CornerFret position="tr" />
        <CornerFret position="bl" />
        <CornerFret position="br" />
      </div>

      {/* Top-Left Korean Ink-Wash Pine Branch (수묵 소나무 가지) */}
      <svg
        viewBox="0 0 420 260"
        className="absolute top-12 sm:top-14 left-2 sm:left-6 lg:left-8 w-36 sm:w-72 lg:w-[400px] h-auto mix-blend-multiply opacity-85 sm:opacity-90"
        fill="none"
      >
        <defs>
          <filter id="inkBleed" x="-10%" y="-10%" width="120%" height="120%">
            <feTurbulence type="fractalNoise" baseFrequency="0.06" numOctaves="3" result="noise" />
            <feDisplacementMap in="SourceGraphic" in2="noise" scale="2.6" xChannelSelector="R" yChannelSelector="G" />
          </filter>
          <filter id="inkSoftBlur" x="-30%" y="-30%" width="160%" height="160%">
            <feGaussianBlur stdDeviation="2.5" />
          </filter>
          <linearGradient id="pineBarkGrad" x1="0" y1="0" x2="1" y2="0.4">
            <stop offset="0%" stopColor="#4A4238" stopOpacity="0.92" />
            <stop offset="65%" stopColor="#6B6256" stopOpacity="0.78" />
            <stop offset="100%" stopColor="#8E8477" stopOpacity="0.45" />
          </linearGradient>
        </defs>

        {/* Gnarled organically tapered pine boughs */}
        <g filter="url(#inkBleed)">
          <path
            d="M-6 58 C 28 54, 48 64, 72 60 C 102 55, 134 38, 178 46 C 218 53, 256 68, 304 62 C 330 59, 354 68, 372 78 L 368 82 C 344 74, 326 68, 300 70 C 254 75, 214 62, 174 56 C 134 50, 102 68, 70 72 C 44 76, 22 68, -6 76 Z"
            fill="url(#pineBarkGrad)"
          />
          {/* Upper secondary curved twig */}
          <path
            d="M72 62 C 92 42, 118 28, 152 24 C 176 22, 198 28, 220 34 L 217 38 C 194 34, 174 29, 150 32 C 122 36, 98 48, 80 65 Z"
            fill="url(#pineBarkGrad)"
          />
          {/* Drooping lower slender twig */}
          <path
            d="M42 70 C 52 94, 62 114, 74 134 C 84 150, 96 158, 112 164 L 109 167 C 92 161, 79 152, 68 136 C 55 117, 46 96, 35 72 Z"
            fill="url(#pineBarkGrad)"
          />
          {/* Small branching twigs */}
          <path d="M126 50 C 148 34, 166 24, 190 18" stroke="#5D554B" strokeWidth="2.4" strokeLinecap="round" />
          <path d="M234 62 C 254 44, 272 34, 296 32" stroke="#686055" strokeWidth="2.2" strokeLinecap="round" />
          <path d="M268 68 C 288 84, 308 92, 328 96" stroke="#756C60" strokeWidth="1.9" strokeLinecap="round" />
          <path d="M62 118 C 46 132, 34 140, 18 144" stroke="#6E655A" strokeWidth="1.8" strokeLinecap="round" />
          <path d="M84 148 C 72 166, 68 180, 74 196" stroke="#7D7469" strokeWidth="1.5" strokeLinecap="round" />
        </g>

        {/* Radiating pine-needle fans layered organically */}
        <PineNeedleFan cx={108} cy={40} scale={1.15} rotate={-14} opacity={0.78} />
        <PineNeedleFan cx={142} cy={28} scale={1.08} rotate={6} opacity={0.82} />
        <PineNeedleFan cx={182} cy={22} scale={1.0} rotate={24} opacity={0.74} />
        <PineNeedleFan cx={220} cy={38} scale={0.96} rotate={18} opacity={0.68} />
        <PineNeedleFan cx={288} cy={36} scale={1.05} rotate={10} opacity={0.72} />
        <PineNeedleFan cx={328} cy={52} scale={0.92} rotate={32} opacity={0.65} />
        <PineNeedleFan cx={366} cy={78} scale={0.88} rotate={52} opacity={0.62} />
        <PineNeedleFan cx={322} cy={92} scale={0.82} rotate={68} opacity={0.55} />
        <PineNeedleFan cx={74} cy={126} scale={0.72} rotate={132} opacity={0.56} />
        <PineNeedleFan cx={26} cy={142} scale={0.68} rotate={-128} opacity={0.5} />
        <PineNeedleFan cx={106} cy={162} scale={0.65} rotate={118} opacity={0.48} />
        <PineNeedleFan cx={74} cy={190} scale={0.58} rotate={160} opacity={0.42} />
      </svg>

      {/* Bottom Misty Ink-Wash Mountains (수묵 산수화) + Mountain Pavilion (산 위 정자) */}
      <svg
        viewBox="0 0 1440 360"
        preserveAspectRatio="xMidYMax slice"
        className="absolute bottom-0 left-0 right-0 w-full h-44 sm:h-60 lg:h-72 mix-blend-multiply opacity-90"
        fill="none"
      >
        <defs>
          <filter id="mountMistBlur" x="-5%" y="-10%" width="110%" height="120%">
            <feGaussianBlur stdDeviation="2.6" />
          </filter>
          <filter id="mountFarBlur" x="-5%" y="-10%" width="110%" height="120%">
            <feGaussianBlur stdDeviation="4.5" />
          </filter>
          <linearGradient id="mountLeftBack" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#7A7368" stopOpacity="0.28" />
            <stop offset="68%" stopColor="#9C9486" stopOpacity="0.14" />
            <stop offset="100%" stopColor="#EFE6D5" stopOpacity="0" />
          </linearGradient>
          <linearGradient id="mountMidInk" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#5D564D" stopOpacity="0.42" />
            <stop offset="65%" stopColor="#867E72" stopOpacity="0.18" />
            <stop offset="100%" stopColor="#EFE6D5" stopOpacity="0" />
          </linearGradient>
          <linearGradient id="mountNearInk" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#4B443C" stopOpacity="0.52" />
            <stop offset="72%" stopColor="#7C7468" stopOpacity="0.2" />
            <stop offset="100%" stopColor="#EFE6D5" stopOpacity="0" />
          </linearGradient>
        </defs>

        {/* Far misty mountain ridges (left & right, open airy valley in center) */}
        <g filter="url(#mountFarBlur)">
          <path
            d="M-20 260 L 42 185 L 78 162 L 116 124 L 148 134 L 194 98 L 236 128 L 284 152 L 348 192 L 428 242 L 510 296 L -20 350 Z"
            fill="url(#mountLeftBack)"
          />
          <path
            d="M930 302 L 1030 238 L 1102 204 L 1158 176 L 1222 192 L 1286 144 L 1346 118 L 1396 142 L 1460 170 L 1460 355 L 930 355 Z"
            fill="url(#mountLeftBack)"
          />
        </g>

        {/* Mid mountain peaks with craggy contour shading */}
        <g filter="url(#mountMistBlur)">
          <path
            d="M-20 318 L 36 254 L 84 232 L 134 188 L 176 206 L 228 192 L 282 238 L 342 264 L 412 316 L 460 356 L -20 356 Z"
            fill="url(#mountMidInk)"
          />
          <path
            d="M990 348 L 1082 276 L 1164 232 L 1236 210 L 1304 196 L 1368 176 L 1422 206 L 1460 228 L 1460 358 L 990 358 Z"
            fill="url(#mountMidInk)"
          />
        </g>

        {/* Foreground foothills & ridge brushstroke shading */}
        <g filter="url(#mountMistBlur)">
          <path
            d="M-20 342 L 48 286 L 112 268 L 178 244 L 246 274 L 318 308 L 392 358 L -20 358 Z"
            fill="url(#mountNearInk)"
          />
          <path
            d="M1076 358 L 1168 306 L 1252 262 L 1326 248 L 1396 274 L 1460 296 L 1460 358 Z"
            fill="url(#mountNearInk)"
          />
        </g>

        {/* Miniature Hanok Pavilion (정자) nestled naturally on the right mountain slope */}
        <g transform="translate(1248 202)" opacity="0.72">
          {/* Stone terrace base */}
          <path d="M12 48 H 92 L 96 53 H 8 Z" fill="#686055" opacity="0.65" />
          {/* Slender pavilion pillars */}
          <g stroke="#4E473E" strokeWidth="2.1">
            <line x1="20" y1="26" x2="20" y2="48" />
            <line x1="40" y1="26" x2="40" y2="48" />
            <line x1="64" y1="26" x2="64" y2="48" />
            <line x1="84" y1="26" x2="84" y2="48" />
          </g>
          {/* Pavilion railing */}
          <line x1="16" y1="40" x2="88" y2="40" stroke="#5A5247" strokeWidth="1.6" />
          {/* Sweeping upturned Giwa roof */}
          <path
            d="M2 27 Q 22 21 52 8 Q 82 21 102 27 Q 76 29 52 29 Q 28 29 2 27 Z"
            fill="#4B443B"
          />
          <path
            d="M12 22 Q 30 16 52 6 Q 74 16 92 22"
            stroke="#3C362E"
            strokeWidth="1.6"
            fill="none"
          />
          {/* Top roof ridge crest */}
          <path d="M32 10 Q 52 7 72 10" stroke="#3C362E" strokeWidth="2.2" strokeLinecap="round" />
        </g>

        {/* Scattered ink-wash pine tufts flanking the pavilion & slopes */}
        <SlopePine x={1226} y={258} scale={1.1} opacity={0.62} />
        <SlopePine x={1204} y={268} scale={0.85} opacity={0.52} />
        <SlopePine x={1360} y={248} scale={1.0} opacity={0.58} />
        <SlopePine x={1384} y={260} scale={0.8} opacity={0.48} />
        <SlopePine x={132} y={272} scale={0.95} opacity={0.42} />
        <SlopePine x={162} y={262} scale={0.78} opacity={0.38} />
      </svg>
    </div>
  );
}
