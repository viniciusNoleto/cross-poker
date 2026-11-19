'use client';

import type { ReactNode } from 'react';
import Link from 'next/link';
import { Icon } from '@iconify/react';
import { Tooltip } from '@mantine/core';
import { motion, type Variants } from 'motion/react';
import { UtilsFor } from '@/components/utils/For';
import { UtilsIf } from '@/components/utils/If';
import { CHIP_COLORS, PokerChip } from './PokerChip';

/**
 * The game's buttons — the action ones (Jogada, Descarte, Troca, the draw-source choice) and every
 * other button of the system (forms, lobby, result screen, header controls, home page).
 *
 * Each one is a physical plaque with thickness: a flat face over a solid, darker edge. Hover lifts
 * the face, pressing pushes it down into the edge, and a blocked action sinks and goes dull — so
 * it's the moment the turn arrives that the buttons visibly pop up. No gradients, no blurred shadows:
 * the depth is the edge itself. The colours are the deck's own:
 *
 * - `gold`  — Jogada and the main call to action (the logo/score gold);
 * - `red`   — Descarte (the red of the card backs, the Descarte pile is face down);
 * - `paper` — Troca and neutral choices (the card face);
 * - `ink`   — primary action over a paper background (where `paper` would disappear);
 * - `felt`  — low-key controls sitting on the table (header icons, hand ordering).
 *
 * `badge` sits on the left of the label (a `CountChip` with the tokens left, or a `CardsGlyph`);
 * `icon` (iconify string) sits on the right. Without `label` text shown (`size="icon"`) only the
 * icon is drawn. `href` turns the plaque into a link; `pressed` keeps the face sunk (toggles).
 * The accessible name is always `label` alone, so the badge/icon never changes how it is named.
 */

export type ActionButtonTone = 'gold' | 'red' | 'paper' | 'ink' | 'felt';

const TONES: Record<ActionButtonTone, { face: string; edge: string; text: string }> = {
  gold: { face: 'bg-gold', edge: 'bg-gold-deep', text: 'text-gold-ink' },
  red: { face: 'bg-suit-red', edge: 'bg-suit-red-deep', text: 'text-paper' },
  paper: { face: 'bg-paper', edge: 'bg-paper-3', text: 'text-ink' },
  ink: { face: 'bg-ink', edge: 'bg-black', text: 'text-paper' },
  felt: { face: 'bg-felt-light', edge: 'bg-felt-night', text: 'text-paper' },
};

const SIZES = {
  lg: {
    edge: 6,
    face: 'h-11 md:h-14 gap-1.5 md:gap-2.5',
    padBadge: 'pl-1.5 pr-3 md:pl-2.5 md:pr-5',
    pad: 'px-4 md:px-6',
    label: 'text-[18px] md:text-[24px]',
    icon: 'w-5 h-5 md:w-6 md:h-6',
    round: 'rounded-xl',
  },
  md: {
    edge: 5,
    face: 'h-11 gap-1.5 md:gap-2',
    padBadge: 'pl-1.5 pr-3 md:pl-2 md:pr-4',
    pad: 'px-4 md:px-5',
    label: 'text-[18px] md:text-[19px]',
    icon: 'w-5 h-5',
    round: 'rounded-[10px]',
  },
  sm: {
    edge: 4,
    face: 'h-8 gap-1.5',
    padBadge: 'pl-1 pr-2.5',
    pad: 'px-3',
    label: 'text-[15px]',
    icon: 'w-4 h-4',
    round: 'rounded-lg',
  },
  icon: {
    edge: 4,
    face: 'h-9 w-9 justify-center',
    padBadge: '',
    pad: '',
    label: 'sr-only',
    icon: 'w-4.5 h-4.5',
    round: 'rounded-lg',
  },
};

// Face offset (px) for each state; the edge shows `edge - y` px under the face.
function faceVariants(edge: number): Variants {
  return {
    rest: { y: 0, transition: { type: 'spring', stiffness: 520, damping: 16 } },
    hover: { y: -2, transition: { type: 'spring', stiffness: 600, damping: 22 } },
    pressed: { y: edge - 2, transition: { type: 'spring', stiffness: 600, damping: 22 } },
    tap: { y: edge - 1, transition: { duration: 0.06 } },
    off: { y: edge - 2, transition: { duration: 0.18 } },
  };
}

const MotionLink = motion.create(Link);

export function ActionButton({ label, tone, size = 'lg', badge, icon, iconClassName = '', labelClassName = '', href, pressed, fullWidth, disabled, loading, tooltip, type = 'button', onClick }: {
  label: string;
  tone: ActionButtonTone;
  size?: keyof typeof SIZES;
  badge?: ReactNode;
  icon?: string;
  iconClassName?: string;
  // Extra classes for the visible label (ex.: `hidden sm:inline` to show only the icon on phones).
  labelClassName?: string;
  href?: string;
  pressed?: boolean;
  fullWidth?: boolean;
  disabled?: boolean;
  loading?: boolean;
  tooltip?: string;
  type?: 'button' | 'submit';
  onClick?: () => void;
}) {
  const colors = TONES[tone];
  const sizing = SIZES[size];
  const blocked = !!disabled || !!loading;
  const padding = badge ? sizing.padBadge : sizing.pad;

  const shared = {
    'aria-label': label,
    'aria-busy': loading || undefined,
    'aria-pressed': pressed,
    initial: false as const,
    animate: blocked ? 'off' : pressed ? 'pressed' : 'rest',
    whileHover: blocked || pressed ? undefined : 'hover',
    whileTap: blocked ? undefined : 'tap',
    onClick,
    className: `relative ${fullWidth ? 'flex w-full' : 'block'} select-none ${sizing.round} ${colors.edge} ${blocked ? 'cursor-not-allowed' : 'cursor-pointer'} ${disabled ? 'opacity-45 saturate-[0.35]' : ''} transition-[opacity,filter] duration-200 focus-visible:outline-offset-4`,
    style: { paddingBottom: sizing.edge },
  };

  const face = (
    <motion.span
      variants={faceVariants(sizing.edge)}
      className={`relative flex flex-1 items-center ${fullWidth ? 'justify-center' : ''} ${sizing.face} ${padding} ${sizing.round} ${colors.face} ${colors.text}`}
    >
      {badge}

      <span className={`font-display font-medium leading-none tracking-[-0.01em] whitespace-nowrap ${sizing.label} ${loading ? 'opacity-0' : ''} ${labelClassName}`}>
        {label}
      </span>

      <UtilsIf condition={!!icon}>
        {() => (
          <Icon
            icon={icon!}
            className={`shrink-0 ${sizing.icon} ${loading ? 'opacity-0' : ''} ${iconClassName}`}
            aria-hidden="true"
          />
        )}
      </UtilsIf>

      {loading ? <LoadingDots /> : null}
    </motion.span>
  );

  return (
    <Tooltip
      label={tooltip}
      disabled={!tooltip}
      withArrow
    >
      {/* A disabled <button> fires no pointer events, so the tooltip hangs on this wrapper. */}
      <span className={fullWidth ? 'flex w-full' : 'inline-flex'}>
        <UtilsIf
          cases={[
            {
              condition: !!href && !blocked,
              content: () => (
                <MotionLink
                  href={href!}
                  {...shared}
                >
                  {face}
                </MotionLink>
              ),
            },
            {
              content: () => (
                <motion.button
                  type={type}
                  disabled={blocked}
                  {...shared}
                >
                  {face}
                </motion.button>
              ),
            },
          ]}
        />
      </span>
    </Tooltip>
  );
}

function LoadingDots() {
  return (
    <span
      className="absolute inset-y-0 right-4 flex items-center gap-1"
      aria-hidden="true"
    >
      <UtilsFor each={[0, 1, 2]}>
        {({ item: dot }) => (
          <motion.span
            className="w-1.5 h-1.5 rounded-full bg-current"
            animate={{ opacity: [0.25, 1, 0.25] }}
            transition={{ duration: 0.9, repeat: Infinity, delay: dot * 0.15 }}
          />
        )}
      </UtilsFor>
    </span>
  );
}

/**
 * A casino chip with a number on it — how many tokens of this action (Jogadas/Descartes) are left.
 * When the number changes the chip flips over, like a chip being taken off the pile.
 */
export function CountChip({ count, color = CHIP_COLORS.ink, textClassName = 'text-gold' }: { count: number; color?: string; textClassName?: string }) {
  return (
    <span
      className="relative inline-flex w-8 h-8 md:w-10 md:h-10 shrink-0"
      aria-hidden="true"
    >
      <motion.span
        key={count}
        className="absolute inset-0"
        initial={{ rotateY: 180, scale: 0.8 }}
        animate={{ rotateY: 0, scale: 1 }}
        transition={{ type: 'spring', stiffness: 300, damping: 18 }}
      >
        <PokerChip
          color={color}
          className="absolute inset-0 w-full h-full"
        />

        <span className={`absolute inset-0 flex items-center justify-center font-display font-medium tabular-nums text-[15px] md:text-[19px] leading-none ${textClassName}`}>
          {count}
        </span>
      </motion.span>
    </span>
  );
}

/**
 * Little face-down cards drawn inside a button: `crossed` (two cards changing hands — Troca) or
 * `stack` (a pile to draw from — Monte / Descarte in the draw-source choice).
 */
export function CardsGlyph({ variant }: { variant: 'crossed' | 'stack' }) {
  const cards = variant === 'crossed'
    ? [{ rotate: -14, x: -5, y: 0 }, { rotate: 14, x: 5, y: 0 }]
    : [{ rotate: -6, x: -3, y: 2 }, { rotate: 0, x: 0, y: 0 }, { rotate: 6, x: 3, y: -2 }];

  return (
    <span
      className="relative inline-flex items-center justify-center w-8 h-8 md:w-10 md:h-10 shrink-0"
      aria-hidden="true"
    >
      <UtilsFor each={cards}>
        {({ item: card }) => (
          <span
            className="card-back absolute w-3.75 h-5.25 md:w-4.75 md:h-6.75 rounded-[3px] border-[1.5px] border-paper"
            style={{ transform: `translate(${card.x}px, ${card.y}px) rotate(${card.rotate}deg)` }}
          />
        )}
      </UtilsFor>
    </span>
  );
}
