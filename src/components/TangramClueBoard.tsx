import { MapPin } from 'lucide-react';
import type { ClueCategory, ClueRecord, ClueSpotId } from '../types/jeonju';

export interface ClueGridMeta {
  category: ClueCategory;
  spotId: ClueSpotId;
  question: string;
  spotName: string;
}

interface TangramClueBoardProps {
  clueGrid: ClueGridMeta[];
  clues: Partial<Record<ClueCategory, ClueRecord>>;
  onInspectClue: (category: ClueCategory) => void;
  onGoToSpot: (spotId: ClueSpotId) => void;
}

/** Delicate traditional Korean corner lattice fret (완자살 귀틀) */
function CornerLatticeOrnament({ position }: { position: 'tl' | 'tr' | 'bl' | 'br' }) {
  const posClasses: Record<typeof position, string> = {
    tl: 'top-2.5 left-2.5',
    tr: 'top-2.5 right-2.5 -scale-x-100',
    bl: 'bottom-2.5 left-2.5 -scale-y-100',
    br: 'bottom-2.5 right-2.5 -scale-x-100 -scale-y-100',
  };

  return (
    <svg
      viewBox="0 0 36 36"
      className={`pointer-events-none absolute w-7 h-7 sm:w-8 sm:h-8 text-[#C7B693]/85 ${posClasses[position]}`}
      fill="none"
      aria-hidden="true"
    >
      <path
        d="M2 34V2H34M2 10H18V2M10 2V18H2M10 10H24V2"
        stroke="currentColor"
        strokeWidth="1.35"
        strokeLinecap="square"
      />
    </svg>
  );
}

/** Center 4-petal traditional Korean rosette at the 2x2 grid intersection */
function CenterRosetteOrnament() {
  return (
    <div
      className="pointer-events-none hidden md:flex items-center justify-center absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-10 w-10 h-10 rounded-full bg-[#F9F3E4]"
      aria-hidden="true"
    >
      <svg viewBox="0 0 40 40" className="w-8 h-8 text-[#B79D6B]" fill="none">
        <path
          d="M20 5C23 11 23 15 20 20C17 15 17 11 20 5ZM20 35C23 29 23 25 20 20C17 25 17 29 20 35ZM5 20C11 17 15 17 20 20C15 23 11 23 5 20ZM35 20C29 17 25 17 20 20C25 23 29 23 35 20Z"
          stroke="currentColor"
          strokeWidth="1.4"
          fill="#EFE4CA"
        />
        <circle cx="20" cy="20" r="2.6" fill="currentColor" />
      </svg>
    </div>
  );
}

/** Soft traditional background watercolor scenery behind each tangram */
function QuadrantScenery({ category }: { category: ClueCategory }) {
  if (category === 'era') {
    return (
      <svg
        viewBox="0 0 420 230"
        preserveAspectRatio="xMidYMid slice"
        className="pointer-events-none absolute inset-0 w-full h-full opacity-35 text-[#8E7757]"
        fill="none"
        aria-hidden="true"
      >
        {/* Swirling cloud */}
        <path
          d="M128 32c8-6 20-5 24 2 4-5 14-5 18 1 5 0 9 4 9 9 0 6-5 10-12 10h-38c-7 0-12-4-12-9s5-9 11-9z"
          stroke="currentColor"
          strokeWidth="1.4"
        />
        <path d="M108 46h28M156 42h32" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round" />
        {/* Top-right pine tree bough */}
        <path d="M420 12c-34 8-62 20-90 36" stroke="#6E7856" strokeWidth="3.5" strokeLinecap="round" />
        <g fill="#6E7856" opacity="0.72">
          <ellipse cx="322" cy="40" rx="18" ry="8" />
          <ellipse cx="352" cy="26" rx="22" ry="9" />
          <ellipse cx="388" cy="18" rx="24" ry="10" />
          <ellipse cx="348" cy="46" rx="16" ry="7" />
        </g>
        {/* Distant miniature Hanok silhouette bottom-left */}
        <path
          d="M124 188l22-10 22 10h-6v18h-32v-18h-6zm20-12h4"
          fill="#B6A488"
          opacity="0.5"
        />
        {/* Traditional wave bottom border */}
        <path
          d="M0 224c28-18 56-18 84 0 28-18 56-18 84 0 28-18 56-18 84 0 28-18 56-18 84 0 28-18 56-18 84 0"
          stroke="#CDBEA2"
          strokeWidth="1.5"
          fill="#EFE5CE"
          opacity="0.65"
        />
      </svg>
    );
  }

  if (category === 'status') {
    return (
      <svg
        viewBox="0 0 420 230"
        preserveAspectRatio="xMidYMid slice"
        className="pointer-events-none absolute inset-0 w-full h-full opacity-35 text-[#8E7757]"
        fill="none"
        aria-hidden="true"
      >
        <path
          d="M118 36c7-5 18-4 21 2 4-4 13-4 16 1 5 0 8 4 8 8 0 5-5 8-11 8h-34c-6 0-11-3-11-8s5-8 11-11z"
          stroke="currentColor"
          strokeWidth="1.4"
        />
        {/* Fortress ramparts & flags */}
        <g fill="#B6A488" opacity="0.55">
          <path d="M138 220v-62h10v8h12v-8h12v8h12v-8h12v8h12v-8h10v62z" />
          <path d="M312 220v-74h12v9h14v-9h14v9h14v-9h14v9h14v-9h12v74z" />
          <path d="M188 122v36M188 124l24 6-4 14-20-4z" stroke="#9C876A" strokeWidth="1.4" />
          <path d="M352 94v52M352 96l38 8-6 22-32-6z" stroke="#9C876A" strokeWidth="1.4" />
        </g>
        <path
          d="M0 224c28-18 56-18 84 0 28-18 56-18 84 0 28-18 56-18 84 0 28-18 56-18 84 0 28-18 56-18 84 0"
          stroke="#CDBEA2"
          strokeWidth="1.5"
          fill="#EFE5CE"
          opacity="0.65"
        />
      </svg>
    );
  }

  if (category === 'story') {
    return (
      <svg
        viewBox="0 0 420 230"
        preserveAspectRatio="xMidYMid slice"
        className="pointer-events-none absolute inset-0 w-full h-full opacity-35 text-[#8E7757]"
        fill="none"
        aria-hidden="true"
      >
        <path
          d="M126 30c8-5 18-4 21 2 4-4 13-4 17 1 4 0 8 4 8 8 0 5-5 8-11 8h-35c-6 0-11-3-11-8s5-8 11-11z"
          stroke="currentColor"
          strokeWidth="1.4"
        />
        {/* Stacked classic thread-bound books bottom-left */}
        <g fill="#B6A488" stroke="#8C785B" strokeWidth="1.2" opacity="0.7">
          <path d="M114 196l48-8 18 10-48 8z" />
          <path d="M114 196v12l18 10v-12z" />
          <path d="M132 208l48-8v12l-48 8z" />
          <path d="M122 184l46-7 16 9-46 7z" />
        </g>
        {/* Calligraphy brush holder bottom-right */}
        <g stroke="#8C785B" strokeWidth="1.4" opacity="0.7">
          <path d="M368 208v-42h28v42c0 4-28 4-28 0z" fill="#C4B49A" />
          <circle cx="382" cy="188" r="6" fill="#EFE5CE" />
          <path d="M376 166l-4-38M388 166l5-44" strokeWidth="2.4" strokeLinecap="round" />
        </g>
        <path
          d="M0 224c28-18 56-18 84 0 28-18 56-18 84 0 28-18 56-18 84 0 28-18 56-18 84 0 28-18 56-18 84 0"
          stroke="#CDBEA2"
          strokeWidth="1.5"
          fill="#EFE5CE"
          opacity="0.65"
        />
      </svg>
    );
  }

  return (
    <svg
      viewBox="0 0 420 230"
      preserveAspectRatio="xMidYMid slice"
      className="pointer-events-none absolute inset-0 w-full h-full opacity-35 text-[#8E7757]"
      fill="none"
      aria-hidden="true"
    >
      {/* Market stall awning top-right */}
      <g fill="#B6A488" stroke="#8C785B" strokeWidth="1.2" opacity="0.62">
        <path d="M326 24h94v26l-10 8-12-8-12 8-12-8-12 8-12-8-12 8-12-8z" />
        <path d="M342 58v92M406 58v92" strokeWidth="2.4" />
      </g>
      {/* Woven market baskets */}
      <g fill="#C6B69B" stroke="#8C785B" strokeWidth="1.2" opacity="0.72">
        <path d="M126 184h38l-5 24h-28z" />
        <circle cx="138" cy="180" r="4" fill="#E6DAC2" />
        <circle cx="146" cy="179" r="4" fill="#E6DAC2" />
        <circle cx="154" cy="180" r="4" fill="#E6DAC2" />
        <path d="M352 174h46l-6 30h-34z" />
        <circle cx="366" cy="170" r="5" fill="#E6DAC2" />
        <circle cx="376" cy="168" r="5" fill="#E6DAC2" />
        <circle cx="386" cy="170" r="5" fill="#E6DAC2" />
      </g>
      <path
        d="M0 224c28-18 56-18 84 0 28-18 56-18 84 0 28-18 56-18 84 0 28-18 56-18 84 0 28-18 56-18 84 0"
        stroke="#CDBEA2"
        strokeWidth="1.5"
        fill="#EFE5CE"
        opacity="0.65"
      />
    </svg>
  );
}

/** Korean Tangram (칠교놀이) SVG illustration per Jeonju heritage spot */
function TangramFigure({ category, unlocked }: { category: ClueCategory; unlocked: boolean }) {
  const seam = '#F8F1E1';
  const patternId = `tangram-grain-${category}`;

  const paperPattern = (
    <defs>
      <pattern id={patternId} width="14" height="14" patternUnits="userSpaceOnUse">
        <circle cx="3" cy="4" r="0.65" fill="#FFFFFF" opacity="0.22" />
        <circle cx="10" cy="9" r="0.7" fill="#3B2F1E" opacity="0.12" />
        <path d="M1 12L5 10M9 3L13 5" stroke="#FFF8EB" strokeWidth="0.45" opacity="0.24" />
      </pattern>
    </defs>
  );

  if (category === 'era') {
    return (
      <svg viewBox="0 0 260 200" className="w-full h-full drop-shadow-xs" aria-hidden="true">
        {paperPattern}
        {/* Stone terrace & stairs */}
        <g fill="#E2D7BE" stroke="#C5B698" strokeWidth="1">
          <rect x="40" y="160" width="180" height="7" rx="1" />
          <rect x="86" y="167" width="88" height="6" />
          <rect x="78" y="173" width="104" height="6" />
          <rect x="70" y="179" width="120" height="7" />
        </g>

        <g stroke={seam} strokeWidth="2.1" strokeLinejoin="round">
          {/* Roof ridge horns (치미) */}
          <polygon points="78,56 78,40 97,56" fill="#3C5473" />
          <polygon points="182,56 182,40 163,56" fill="#3C5473" />

          {/* Main upper Hanok roof */}
          <polygon points="24,78 96,56 130,86" fill="#344B68" />
          <polygon points="96,56 164,56 130,86" fill="#293C54" />
          <polygon points="164,56 236,78 130,86" fill="#344B68" />
          <polygon points="24,78 70,86 45,96" fill="#425D80" />
          <polygon points="24,78 130,86 70,86" fill="#2E425D" />
          <polygon points="236,78 190,86 215,96" fill="#425D80" />
          <polygon points="236,78 130,86 190,86" fill="#2E425D" />

          {/* Side sage eaves */}
          <polygon points="68,86 112,86 72,114" fill="#54694B" />
          <polygon points="192,86 148,86 188,114" fill="#54694B" />

          {/* Side terracotta pavilions & columns */}
          <polygon points="28,120 80,120 54,102" fill="#A94731" />
          <rect x="46" y="120" width="16" height="40" fill="#B64E36" />
          <polygon points="180,120 232,120 206,102" fill="#A94731" />
          <rect x="198" y="120" width="16" height="40" fill="#B64E36" />

          {/* Central hall body */}
          <rect x="72" y="114" width="10" height="46" fill="#4B3E35" />
          <rect x="178" y="114" width="10" height="46" fill="#4B3E35" />
          <polygon points="82,114 144,114 82,160" fill="#A94731" />
          <polygon points="82,160 144,114 144,160" fill="#B8523A" />
          <polygon points="144,114 178,114 178,160 144,160" fill="#D98F2E" />
        </g>

        {/* Subtle grain overlay across solid tangram body */}
        <rect x="24" y="38" width="212" height="126" fill={`url(#${patternId})`} pointerEvents="none" />

        {/* Missing / unlocked tangram piece */}
        {unlocked ? (
          <g>
            <polygon
              points="114,158 164,158 148,124 114,124"
              fill="#C2410C"
              stroke={seam}
              strokeWidth="2.2"
              strokeLinejoin="round"
            />
            <polygon
              points="114,124 148,124 114,158"
              fill="#D97706"
              opacity="0.55"
            />
          </g>
        ) : (
          <g>
            <polygon
              points="114,158 164,158 148,124 114,124"
              fill="#FBF5E8"
              stroke="#9D8160"
              strokeWidth="1.8"
              strokeDasharray="4 3"
              strokeLinejoin="round"
            />
            <text
              x="136"
              y="149"
              textAnchor="middle"
              className="font-serif-kr"
              fontSize="21"
              fontWeight="700"
              fill="#6E5940"
            >
              ?
            </text>
          </g>
        )}
      </svg>
    );
  }

  if (category === 'status') {
    return (
      <svg viewBox="0 0 260 200" className="w-full h-full drop-shadow-xs" aria-hidden="true">
        {paperPattern}
        <g stroke={seam} strokeWidth="2.1" strokeLinejoin="round">
          {/* Gat (갓) crown & brim */}
          <polygon points="104,14 130,14 130,52 96,52" fill="#3B4557" />
          <polygon points="130,14 156,14 164,52 130,52" fill="#2D3647" />
          <polygon points="52,65 96,52 114,65" fill="#363433" />
          <polygon points="208,65 164,52 146,65" fill="#363433" />

          {/* Hair / topknot wedges */}
          <polygon points="96,52 130,52 108,74" fill="#383534" />
          <polygon points="164,52 130,52 152,74" fill="#383534" />

          {/* Face polygon */}
          <polygon points="130,52 152,74 130,104 108,74" fill="#EFE0C4" />

          {/* Collar & neck */}
          <polygon points="108,86 130,104 116,116" fill="#A94731" />
          <polygon points="152,86 130,104 144,116" fill="#D98F2E" />
          <polygon points="118,104 142,104 130,115" fill="#F8F1E1" />

          {/* Wide Dopo / Robes */}
          <polygon points="54,142 108,86 92,152" fill="#334865" />
          <polygon points="54,142 92,152 88,188 54,188" fill="#2B3E57" />
          <polygon points="92,152 108,86 124,142" fill="#A94731" />
          <polygon points="88,188 92,152 130,188" fill="#53684B" />
          <polygon points="92,152 130,142 130,188" fill="#D98F2E" />
          <polygon points="130,142 168,188 130,188" fill="#A94731" />
          <polygon points="152,86 168,152 136,142" fill="#B55039" />
          <polygon points="152,86 206,142 168,152" fill="#334865" />
          <polygon points="168,152 206,142 206,188 168,188" fill="#2B3E57" />
        </g>

        <rect x="52" y="14" width="156" height="174" fill={`url(#${patternId})`} pointerEvents="none" />

        {unlocked ? (
          <polygon
            points="102,114 158,114 130,152"
            fill="#D97706"
            stroke={seam}
            strokeWidth="2.2"
            strokeLinejoin="round"
          />
        ) : (
          <g>
            <polygon
              points="102,114 158,114 130,152"
              fill="#FBF5E8"
              stroke="#9D8160"
              strokeWidth="1.8"
              strokeDasharray="4 3"
              strokeLinejoin="round"
            />
            <text
              x="130"
              y="136"
              textAnchor="middle"
              className="font-serif-kr"
              fontSize="21"
              fontWeight="700"
              fill="#6E5940"
            >
              ?
            </text>
          </g>
        )}
      </svg>
    );
  }

  if (category === 'story') {
    return (
      <svg viewBox="0 0 260 200" className="w-full h-full drop-shadow-xs" aria-hidden="true">
        {paperPattern}
        <g stroke={seam} strokeWidth="2.1" strokeLinejoin="round">
          {/* Outer dark cover boards */}
          <polygon points="24,42 48,42 58,154 32,162" fill="#4C4037" />
          <polygon points="212,42 236,42 228,162 202,154" fill="#4C4037" />

          {/* Bottom diamond clasp */}
          <polygon points="130,162 145,176 130,190 115,176" fill="#344B68" />

          {/* Left page tangrams */}
          <polygon points="44,32 104,56 62,130" fill="#D98F2E" />
          <polygon points="104,56 130,66 116,102" fill="#A94731" />
          <polygon points="62,130 130,66 114,142" fill="#53684B" />
          <polygon points="56,154 62,130 114,142" fill="#E19C3A" />
          <polygon points="56,154 114,142 130,162" fill="#344B68" />
          <polygon points="114,142 130,66 130,162" fill="#DFCEAC" />

          {/* Right page tangrams */}
          <polygon points="130,66 216,32 166,94" fill="#B54E35" />
          <polygon points="216,32 204,154 166,94" fill="#DF9632" />
          <polygon points="130,66 166,94 130,148" fill="#53684B" />
          <polygon points="130,162 204,154 166,138" fill="#344B68" />
        </g>

        <rect x="24" y="32" width="212" height="158" fill={`url(#${patternId})`} pointerEvents="none" />

        {unlocked ? (
          <polygon
            points="134,136 200,136 167,86"
            fill="#C2410C"
            stroke={seam}
            strokeWidth="2.2"
            strokeLinejoin="round"
          />
        ) : (
          <g>
            <polygon
              points="134,136 200,136 167,86"
              fill="#FBF5E8"
              stroke="#9D8160"
              strokeWidth="1.8"
              strokeDasharray="4 3"
              strokeLinejoin="round"
            />
            <text
              x="167"
              y="126"
              textAnchor="middle"
              className="font-serif-kr"
              fontSize="21"
              fontWeight="700"
              fill="#6E5940"
            >
              ?
            </text>
          </g>
        )}
      </svg>
    );
  }

  // item — 남부시장 (Bokjumeoni Fortune Pouch Tangram)
  return (
    <svg viewBox="0 0 260 200" className="w-full h-full drop-shadow-xs" aria-hidden="true">
      {paperPattern}
      <g stroke={seam} strokeWidth="2.1" strokeLinejoin="round">
        {/* Top gathered pouch fan */}
        <polygon points="74,34 114,20 108,72" fill="#A94731" />
        <polygon points="114,20 148,16 130,72" fill="#DF9632" />
        <polygon points="148,16 178,32 146,72" fill="#53684B" />
        <polygon points="164,34 188,42 152,72" fill="#B54E35" />

        {/* Lower fortune pouch hexagonal tangram body */}
        <polygon points="100,74 64,122 108,128" fill="#344B68" />
        <polygon points="64,122 86,166 108,128" fill="#2B3E57" />
        <polygon points="100,74 134,112 108,128" fill="#53684B" />
        <polygon points="86,166 108,128 130,154" fill="#4D6245" />
        <polygon points="100,74 156,74 134,112" fill="#D98F2E" />
        <polygon points="156,74 188,122 144,116" fill="#A94731" />
        <polygon points="86,166 122,184 130,152" fill="#DF9632" />
        <polygon points="122,184 170,174 146,152" fill="#383638" />
        <polygon points="170,174 188,122 162,152" fill="#A94731" />
      </g>

      <rect x="64" y="16" width="128" height="170" fill={`url(#${patternId})`} pointerEvents="none" />

      {/* Crimson silk drawstring, knot & tassel */}
      <g fill="none" stroke="#B6432B" strokeLinecap="round" strokeLinejoin="round">
        <path d="M98 72H158" strokeWidth="4.2" />
        <path d="M158 72C176 72 184 82 192 90" strokeWidth="2.2" />
        {/* Korean clover knot */}
        <circle cx="194" cy="84" r="4.2" strokeWidth="2" />
        <circle cx="202" cy="92" r="4.2" strokeWidth="2" />
        <circle cx="194" cy="100" r="4.2" strokeWidth="2" />
        <circle cx="186" cy="92" r="4.2" strokeWidth="2" />
        <circle cx="194" cy="92" r="2.6" fill="#B6432B" stroke="none" />
        {/* Tassel */}
        <path d="M196 104L204 120M198 120v24M202 120v26M206 120v25M210 120v22" strokeWidth="1.8" />
        <rect x="197" y="116" width="14" height="4" rx="1.5" fill="#B6432B" stroke="none" />
      </g>

      {unlocked ? (
        <polygon
          points="120,152 178,152 149,110"
          fill="#D97706"
          stroke={seam}
          strokeWidth="2.2"
          strokeLinejoin="round"
        />
      ) : (
        <g>
          <polygon
            points="120,152 178,152 149,110"
            fill="#FBF5E8"
            stroke="#9D8160"
            strokeWidth="1.8"
            strokeDasharray="4 3"
            strokeLinejoin="round"
          />
          <text
            x="149"
            y="144"
            textAnchor="middle"
            className="font-serif-kr"
            fontSize="21"
            fontWeight="700"
            fill="#6E5940"
          >
            ?
          </text>
        </g>
      )}
    </svg>
  );
}

export function TangramClueBoard({
  clueGrid,
  clues,
  onInspectClue,
  onGoToSpot,
}: TangramClueBoardProps) {
  return (
    <div className="relative rounded-2xl border border-[#D4C7AE] bg-[#FBF6EA]/95 shadow-sm overflow-hidden">
      {/* Subtle inner hairline border frame matching reference mockup */}
      <div
        className="pointer-events-none absolute inset-2 rounded-xl border border-[#E5DAC2]/80 z-10"
        aria-hidden="true"
      />
      <CornerLatticeOrnament position="tl" />
      <CornerLatticeOrnament position="tr" />
      <CornerLatticeOrnament position="bl" />
      <CornerLatticeOrnament position="br" />
      <CenterRosetteOrnament />

      {/* Responsive 1-col mobile / 2x2 desktop tangram board */}
      <div className="grid grid-cols-1 md:grid-cols-2">
        {clueGrid.map((item, idx) => {
          const clue = clues[item.category];
          const dividerClasses = [
            idx % 2 === 0 ? 'md:border-r md:border-[#DFD4BC]' : '',
            idx < 2
              ? 'border-b border-[#DFD4BC]'
              : idx === 2
                ? 'border-b border-[#DFD4BC] md:border-b-0'
                : '',
          ].join(' ');

          return (
            <button
              key={item.category}
              type="button"
              onClick={() => {
                if (clue) {
                  onInspectClue(item.category);
                } else {
                  onGoToSpot(item.spotId);
                }
              }}
              aria-label={
                clue
                  ? `${item.spotName} · ${item.question} ${clue.value} 입니다. 자세히 보기`
                  : `${item.spotName} · ${item.question} 미획득. 지도에서 방문하기`
              }
              className={`group relative min-h-[196px] sm:min-h-[248px] px-5 py-6 sm:px-7 sm:py-7 flex items-center justify-between gap-3 sm:gap-4 text-left overflow-hidden transition-colors hover:bg-[#F5ECD7]/65 ${dividerClasses}`}
            >
              <QuadrantScenery category={item.category} />

              {/* Left Text & Status Column */}
              <div className="relative z-10 flex-1 min-w-0 flex flex-col items-start gap-2 sm:gap-2.5 pl-1 sm:pl-2">
                <div className="flex items-center gap-1.5 text-xs sm:text-sm font-semibold text-[#6E5940]">
                  <MapPin className="w-3.5 h-3.5 shrink-0 text-[#7A6348]" aria-hidden="true" />
                  <span>{item.spotName}</span>
                </div>

                <div className="relative inline-block">
                  {/* Soft warm brush highlight behind question baseline */}
                  <span
                    className="pointer-events-none absolute -bottom-0.5 left-0 right-1 h-2.5 rounded-full bg-[#E8D7B9]/85"
                    aria-hidden="true"
                  />
                  <p className="relative font-serif-kr text-[21px] sm:text-[26px] font-bold text-[#1C1917] leading-tight">
                    {item.question}
                  </p>
                </div>

                {clue ? (
                  <div className="space-y-1.5 pt-1">
                    <div className="inline-flex flex-wrap items-baseline gap-1.5">
                      <span className="inline-block px-3 py-1.5 rounded-xl border border-[#9A3412]/45 bg-[#FFFDF8]/95 font-serif-kr text-sm sm:text-base font-bold text-[#9A3412] shadow-2xs">
                        {clue.value}
                      </span>
                      <span className="text-sm sm:text-base text-[#44403C]">입니다</span>
                    </div>
                    <div>
                      <span className="text-xs text-[#78716C] underline underline-offset-2">
                        자세히 보기
                      </span>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center gap-3 pt-1">
                    {/* Traditional paper tile with terracotta corner fold */}
                    <span
                      className="relative w-12 h-12 sm:w-14 sm:h-14 rounded-xl border border-[#C6B799] bg-[#F7F0DF] flex items-center justify-center shadow-2xs overflow-hidden shrink-0"
                      aria-hidden="true"
                    >
                      <svg
                        viewBox="0 0 24 24"
                        className="absolute bottom-0 right-0 w-5 h-5"
                        aria-hidden="true"
                      >
                        <polygon points="24,2 24,24 2,24" fill="#B56C4D" opacity="0.88" />
                        <polygon points="24,2 14,14 2,24" fill="#D4A68B" opacity="0.5" />
                      </svg>
                      <span className="relative font-serif-kr text-xl sm:text-2xl font-bold text-[#6E5940] -translate-x-0.5 -translate-y-0.5">
                        ?
                      </span>
                    </span>
                    <span className="text-sm sm:text-lg text-[#44403C]">입니다</span>
                  </div>
                )}
              </div>

              {/* Right Tangram (칠교놀이) Artwork */}
              <div className="relative z-10 w-[148px] h-[120px] sm:w-[220px] sm:h-[176px] md:w-[244px] md:h-[192px] shrink-0 transition-transform duration-300 ease-out group-hover:scale-[1.03]">
                <TangramFigure category={item.category} unlocked={Boolean(clue)} />
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
