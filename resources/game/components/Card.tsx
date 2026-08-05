import { motion } from 'motion/react';
import { ESuit } from '../enums/ESuit';
import { ERank } from '../enums/ERank';
import type { ICard } from '../models/Card';

const SUIT_SYMBOL: Record<`${ESuit}`, string> = {
  [ESuit.HEARTS]: '♥',
  [ESuit.DIAMONDS]: '♦',
  [ESuit.CLUBS]: '♣',
  [ESuit.SPADES]: '♠',
};

const RED_SUITS: Array<`${ESuit}`> = [ESuit.HEARTS, ESuit.DIAMONDS];

// Emoji for the royal cards' central figure — King, Queen and Jack (represented by a
// generic person emoji, since there's no universal "prince/page" emoji).
const ROYAL_EMOJI: Partial<Record<`${ERank}`, string>> = {
  [ERank.KING]: '🤴',
  [ERank.QUEEN]: '👸',
  [ERank.JACK]: '🧑',
};

// Number of pips to draw on the card body — number cards (and the Ace, with 1 large
// central pip) use this to build the classic deck layout; J/Q/K aren't included here.
const PIP_COUNT: Partial<Record<`${ERank}`, number>> = {
  [ERank.ACE]: 1,
  [ERank.TWO]: 2,
  [ERank.THREE]: 3,
  [ERank.FOUR]: 4,
  [ERank.FIVE]: 5,
  [ERank.SIX]: 6,
  [ERank.SEVEN]: 7,
  [ERank.EIGHT]: 8,
  [ERank.NINE]: 9,
  [ERank.TEN]: 10,
};

type PipPosition = {
  x: 'left' | 'center' | 'right';
  y: number;
  rotate?: boolean;
};

const PIP_X: Record<PipPosition['x'], number> = {
  left: 25,
  center: 50,
  right: 75,
};

// Classic French deck layout: pips organized in columns, mirrored on the lower half
// of the card (rotated 180°) — replicates the layout of a real physical deck.
// Rows sit between 22% and 78% height to avoid colliding with the corner indices.
const PIP_LAYOUT: Record<number, PipPosition[]> = {
  1: [
    { x: 'center', y: 50 },
  ],
  2: [
    { x: 'center', y: 24 },
    { x: 'center', y: 76, rotate: true },
  ],
  3: [
    { x: 'center', y: 24 },
    { x: 'center', y: 50 },
    { x: 'center', y: 76, rotate: true },
  ],
  4: [
    { x: 'left', y: 24 },
    { x: 'right', y: 24 },
    { x: 'left', y: 76, rotate: true },
    { x: 'right', y: 76, rotate: true },
  ],
  5: [
    { x: 'left', y: 24 },
    { x: 'right', y: 24 },
    { x: 'center', y: 50 },
    { x: 'left', y: 76, rotate: true },
    { x: 'right', y: 76, rotate: true },
  ],
  6: [
    { x: 'left', y: 22 },
    { x: 'right', y: 22 },
    { x: 'left', y: 50 },
    { x: 'right', y: 50 },
    { x: 'left', y: 78, rotate: true },
    { x: 'right', y: 78, rotate: true },
  ],
  7: [
    { x: 'left', y: 22 },
    { x: 'right', y: 22 },
    { x: 'center', y: 36 },
    { x: 'left', y: 50 },
    { x: 'right', y: 50 },
    { x: 'left', y: 78, rotate: true },
    { x: 'right', y: 78, rotate: true },
  ],
  8: [
    { x: 'left', y: 22 },
    { x: 'right', y: 22 },
    { x: 'center', y: 36 },
    { x: 'left', y: 50 },
    { x: 'right', y: 50 },
    { x: 'center', y: 64, rotate: true },
    { x: 'left', y: 78, rotate: true },
    { x: 'right', y: 78, rotate: true },
  ],
  9: [
    { x: 'left', y: 22 },
    { x: 'right', y: 22 },
    { x: 'left', y: 38 },
    { x: 'right', y: 38 },
    { x: 'center', y: 50 },
    { x: 'left', y: 62, rotate: true },
    { x: 'right', y: 62, rotate: true },
    { x: 'left', y: 78, rotate: true },
    { x: 'right', y: 78, rotate: true },
  ],
  10: [
    { x: 'left', y: 22 },
    { x: 'right', y: 22 },
    { x: 'center', y: 33 },
    { x: 'left', y: 38 },
    { x: 'right', y: 38 },
    { x: 'left', y: 62, rotate: true },
    { x: 'right', y: 62, rotate: true },
    { x: 'center', y: 67, rotate: true },
    { x: 'left', y: 78, rotate: true },
    { x: 'right', y: 78, rotate: true },
  ],
};

const SIZES = {
  sm: 'w-8 h-11 text-[10px] gap-0',
  md: 'w-12 h-16 text-sm gap-0.5',
  lg: 'w-16 h-24 text-lg gap-1',
};

const CORNER_SIZES = {
  sm: 'text-[6px]',
  md: 'text-[9px]',
  lg: 'text-xs',
};

const PIP_SIZES = {
  sm: 'text-[9px]',
  md: 'text-sm',
  lg: 'text-xl',
};

const ACE_PIP_SIZES = {
  sm: 'text-lg',
  md: 'text-2xl',
  lg: 'text-4xl',
};

const ROYAL_EMOJI_SIZES = {
  sm: 'text-sm',
  md: 'text-xl',
  lg: 'text-2xl',
};

const ROYAL_SUIT_SIZES = {
  sm: 'text-[9px]',
  md: 'text-sm',
  lg: 'text-lg',
};

// Reserved space between the central pips area and the corner indices, to avoid collisions.
const PIP_PADDING = {
  sm: 'inset-1',
  md: 'inset-1.5',
  lg: 'inset-2.5',
};

export type CardProps = {
  // When `card` is null/undefined, the card renders face down — the server never sends
  // the identity of cards the player can't see (see game-concept.md).
  card?: ICard | null;
  size?: keyof typeof SIZES;
  selected?: boolean;
  onClick?: () => void;
  className?: string;
  // Stable identifier for shared layout animation (`motion` library, see
  // game-concept.md "Animações"). Two <Card> with the same `layoutId`, even in different
  // positions/screens of the tree, animate the transition between them automatically (e.g. a card
  // "flying" from the Deck to the hand). Omit when you don't need this animation — the component works the same.
  layoutId?: string;
};

export function Card({ card, size = 'md', selected, onClick, className = '', layoutId }: CardProps) {
  const clickable = !!onClick;

  if (!card) {
    return (
      <motion.div
        layout
        layoutId={layoutId}
        className={`${SIZES[size]} rounded-md bg-gradient-to-br from-primary-700 to-primary-900 border border-primary-950/40 shadow-sm ${className}`}
      />
    );
  }

  const color = RED_SUITS.includes(card.suit) ? 'text-red-600' : 'text-gray-900';
  const symbol = SUIT_SYMBOL[card.suit];
  const pipCount = PIP_COUNT[card.rank];
  const royalEmoji = ROYAL_EMOJI[card.rank];

  return (
    <motion.button
      layout
      layoutId={layoutId}
      type="button"
      disabled={!clickable}
      onClick={onClick}
      className={`card-face relative ${SIZES[size]} ${color} font-bold ${clickable ? 'cursor-pointer hover:-translate-y-1 transition-transform' : 'cursor-default'} ${selected ? '-translate-y-2 ring-2 ring-secondary-500' : ''} ${className}`}
    >
      <span className={`absolute top-0.5 left-1 flex flex-col items-center leading-none ${CORNER_SIZES[size]}`}>
        <span>
          {card.rank}
        </span>

        <span>
          {symbol}
        </span>
      </span>

      <span className={`absolute bottom-0.5 right-1 flex flex-col items-center leading-none rotate-180 ${CORNER_SIZES[size]}`}>
        <span>
          {card.rank}
        </span>

        <span>
          {symbol}
        </span>
      </span>

      {royalEmoji && (
        <span className="absolute inset-0 flex flex-col items-center justify-center gap-0.5">
          <span className={ROYAL_EMOJI_SIZES[size]}>
            {royalEmoji}
          </span>

          <span className={`${ROYAL_SUIT_SIZES[size]} leading-none`}>
            {symbol}
          </span>
        </span>
      )}

      {pipCount !== undefined && (
        <span className={`absolute ${PIP_PADDING[size]}`}>
          {PIP_LAYOUT[pipCount].map((pip, index) => (
            <span
              key={index}
              className={`absolute -translate-x-1/2 -translate-y-1/2 leading-none ${pipCount === 1 ? ACE_PIP_SIZES[size] : PIP_SIZES[size]} ${pip.rotate ? 'rotate-180' : ''}`}
              style={{ left: `${PIP_X[pip.x]}%`, top: `${pip.y}%` }}
            >
              {symbol}
            </span>
          ))}
        </span>
      )}
    </motion.button>
  );
}
