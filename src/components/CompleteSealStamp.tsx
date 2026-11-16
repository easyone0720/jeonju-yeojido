import { useId } from 'react';

interface CompleteSealStampProps {
  animate?: boolean;
  size?: 'xs' | 'sm' | 'md' | 'lg';
  className?: string;
  label?: string;
}

const SIZE_CLASSES: Record<NonNullable<CompleteSealStampProps['size']>, string> = {
  xs: 'w-9 h-9',
  sm: 'w-12 h-12',
  md: 'w-16 h-16',
  lg: 'w-20 h-20',
};

/**
 * Pure SVG + CSS Korean traditional cinnabar-red '完' seal stamp.
 * Transparent background, slightly distressed ink-stamped circular border, ~15° tilt,
 * no neon/glow, no external image generation APIs.
 */
export function CompleteSealStamp({
  animate = false,
  size = 'md',
  className = '',
  label = '방문 인증 완료 도장 (完)',
}: CompleteSealStampProps) {
  const uid = useId().replace(/:/g, '');
  const maskId = `seal-grain-${uid}`;

  return (
    <span
      role="img"
      aria-label={label}
      data-testid="complete-seal-stamp"
      data-animated={animate ? 'true' : 'false'}
      className={`inline-flex items-center justify-center shrink-0 select-none pointer-events-none ${SIZE_CLASSES[size]} ${
        animate ? 'animate-seal-slam' : 'seal-stamped-tilt'
      } ${className}`}
    >
      <svg
        viewBox="0 0 100 100"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden="true"
        className="w-full h-full overflow-visible"
      >
        <defs>
          {/* Subtle carved-ink distress cutouts for authentic Hanji stamp feel */}
          <mask id={maskId}>
            <rect x="0" y="0" width="100" height="100" fill="white" />
            <circle cx="15" cy="36" r="1.4" fill="black" />
            <circle cx="84" cy="64" r="1.5" fill="black" />
            <circle cx="62" cy="11" r="1.3" fill="black" />
            <circle cx="38" cy="89" r="1.4" fill="black" />
            <ellipse cx="26" cy="19" rx="2.4" ry="1.1" transform="rotate(-35 26 19)" fill="black" />
            <ellipse cx="76" cy="80" rx="2.2" ry="1.1" transform="rotate(-40 76 80)" fill="black" />
            <circle cx="48" cy="24" r="0.9" fill="black" />
            <circle cx="57" cy="49" r="1.0" fill="black" />
            <circle cx="39" cy="68" r="0.9" fill="black" />
            <circle cx="71" cy="34" r="0.85" fill="black" />
          </mask>
        </defs>

        <g mask={`url(#${maskId})`}>
          {/* Outer weathered cinnabar ring */}
          <path
            d="M 50 7.2
               C 74.2 7.0, 92.8 25.4, 92.7 49.8
               C 92.6 74.0, 74.1 92.8, 49.6 92.7
               C 25.3 92.6, 7.1 73.9, 7.3 49.6
               C 7.5 25.6, 25.8 7.4, 50 7.2 Z"
            stroke="#B42318"
            strokeWidth="4.6"
            strokeLinecap="round"
            strokeLinejoin="round"
            opacity="0.92"
          />

          {/* Subtle inner hairline rim for traditional 낙관 depth */}
          <circle
            cx="50"
            cy="50"
            r="37.4"
            stroke="#B42318"
            strokeWidth="1.25"
            strokeDasharray="18 3 9 2.5 24 3.5"
            opacity="0.72"
          />

          {/* Classical carved brush-calligraphy '完' (Complete) */}
          <g fill="#B42318" opacity="0.94">
            {/* Top dot (丶) */}
            <path d="M49.2 21.5 C51.2 22.8, 53.5 25.1, 53.2 27.6 C52.9 29.4, 50.1 29.5, 48.6 27.9 C47.3 26.4, 46.7 23.2, 47.7 21.8 Z" />

            {/* Roof left drop (丶/丨) */}
            <path d="M32.4 28.4 C33.8 28.6, 34.4 30.8, 33.7 34.4 C33.1 37.6, 31.4 40.3, 29.3 40.4 C27.4 40.5, 26.8 38.6, 27.9 36.4 C29.0 34.1, 30.6 31.1, 31.3 28.9 Z" />

            {/* Roof horizontal + right hook (乛) */}
            <path d="M32.5 30.8 C44.5 29.9, 57.5 29.0, 68.8 28.6 C71.5 28.5, 73.6 30.2, 72.8 32.8 C71.9 35.6, 68.7 38.5, 65.8 39.8 C64.2 40.5, 63.3 39.4, 64.4 37.9 C65.7 36.1, 66.8 34.1, 66.8 32.9 C66.8 32.1, 65.5 32.0, 63.2 32.1 C53.4 32.5, 42.2 33.2, 32.7 33.9 C31.2 34.0, 31.1 30.9, 32.5 30.8 Z" />

            {/* Upper horizontal stroke of 元 (二 top) */}
            <path d="M38.8 41.2 C45.2 40.3, 52.8 39.6, 59.8 39.5 C61.9 39.5, 62.9 41.0, 61.9 42.5 C61.1 43.7, 58.9 44.0, 56.2 44.0 C50.5 44.1, 44.4 44.5, 39.2 44.8 C37.2 44.9, 36.9 41.5, 38.8 41.2 Z" />

            {/* Middle wide horizontal stroke of 元 (二 bottom) */}
            <path d="M31.0 51.8 C43.2 50.6, 56.8 49.5, 68.8 49.3 C71.4 49.3, 72.7 51.1, 71.7 52.8 C70.7 54.4, 68.0 54.6, 64.5 54.6 C53.4 54.6, 41.2 55.2, 31.6 56.0 C29.3 56.2, 29.0 52.0, 31.0 51.8 Z" />

            {/* Left sweeping leg (丿) */}
            <path d="M43.8 54.2 C46.4 54.3, 47.4 56.4, 46.4 59.2 C44.0 65.9, 39.4 73.1, 31.2 77.6 C29.3 78.6, 27.8 77.2, 29.4 75.6 C35.8 69.5, 39.8 63.1, 41.2 56.6 C41.6 54.9, 42.4 54.2, 43.8 54.2 Z" />

            {/* Right curving leg with upward hook (乚) */}
            <path d="M54.6 53.5 C57.2 53.6, 58.1 55.2, 57.5 58.2 C56.6 62.7, 56.1 67.1, 56.4 69.5 C56.7 71.9, 58.6 72.7, 62.4 72.7 C65.8 72.7, 67.6 72.1, 68.6 70.4 C69.4 69.0, 69.9 66.2, 70.3 63.8 C70.6 62.0, 72.6 62.1, 72.9 64.0 C73.3 66.9, 73.9 69.8, 74.8 71.7 C75.7 73.6, 74.6 76.2, 71.6 77.0 C68.4 77.8, 64.8 78.1, 60.8 78.0 C54.5 77.8, 51.3 74.8, 51.3 69.2 C51.3 65.4, 51.7 60.2, 52.2 56.0 C52.4 54.2, 53.3 53.5, 54.6 53.5 Z" />
          </g>
        </g>
      </svg>
    </span>
  );
}
