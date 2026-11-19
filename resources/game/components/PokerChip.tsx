import type { CSSProperties } from 'react';
import { FELT_PALETTE, GOLD_PALETTE, INK_PALETTE, SUIT_RED_PALETTE, TEAM_PALETTE } from '@/shared/constants/colors';

// Chip colours shared by the home and the game: gold/ink for Team A, pink/red for Team B.
export const CHIP_COLORS = {
  gold: GOLD_PALETTE.DEFAULT,
  red: SUIT_RED_PALETTE.DEFAULT,
  pink: TEAM_PALETTE.b,
  ink: INK_PALETTE.DEFAULT,
  felt: FELT_PALETTE.light,
};

// A casino chip drawn in SVG: coloured disc, six paper stripes on the edge and a dashed inner
// ring. Used by the home animations and by the game (score burst, scoreboard towers).
export function PokerChip({ color, className = '', stretch = false, style }: { color: string; className?: string; stretch?: boolean; style?: CSSProperties }) {
  return (
    <svg
      viewBox="0 0 100 100"
      preserveAspectRatio={stretch ? 'none' : undefined}
      className={className}
      style={style}
      aria-hidden="true"
    >
      <circle
        cx="50"
        cy="50"
        r="48"
        fill={color}
      />

      <circle
        cx="50"
        cy="50"
        r="41"
        fill="none"
        stroke="#f4f4f1"
        strokeWidth="13"
        strokeDasharray="16 26.9"
      />

      <circle
        cx="50"
        cy="50"
        r="29"
        fill={color}
        stroke="#f4f4f1"
        strokeWidth="2"
        strokeDasharray="5 4"
      />

      <circle
        cx="50"
        cy="50"
        r="48"
        fill="none"
        stroke="rgba(0,0,0,0.25)"
        strokeWidth="2"
      />
    </svg>
  );
}

/**
 * A chip seen from the side, ready to be piled: the face (stretched disc) on top of a darker
 * edge. Pile several with `bottom: index * step` (step ≈ width / 10) and growing `zIndex`.
 */
export function StackedChip({ color, width }: { color: string; width: number }) {
  const face = Math.round(width * 0.43);
  const edge = Math.max(3, Math.round(width * 0.09));

  return (
    <div
      className="relative"
      style={{ width, height: face + edge }}
    >
      <div
        className="absolute inset-x-0 rounded-b-[50%] brightness-[0.62] shadow-[0_2px_0_rgba(0,0,0,0.35)]"
        style={{ top: face / 2, height: face / 2 + edge, background: color }}
      />

      <PokerChip
        color={color}
        stretch
        className="absolute inset-x-0 top-0 w-full"
        style={{ height: face }}
      />
    </div>
  );
}
