import { motion } from 'motion/react';
import { ESuit } from '../enums/ESuit';
import { ERank } from '../enums/ERank';
import type { ICard } from '../models/Card';

const SUIT_SYMBOL: Record<`${ESuit}`, string> = {
  [ESuit.HEARTS]: '♥\uFE0E',
  [ESuit.DIAMONDS]: '♦\uFE0E',
  [ESuit.CLUBS]: '♣\uFE0E',
  [ESuit.SPADES]: '♠\uFE0E',
};

const SUIT_NAME: Record<`${ESuit}`, string> = {
  [ESuit.HEARTS]: 'copas',
  [ESuit.DIAMONDS]: 'ouros',
  [ESuit.CLUBS]: 'paus',
  [ESuit.SPADES]: 'espadas',
};

// Suit glyphs always use the sans font (the same as the pips in the card body): the display font
// (Boska) has its own, different ♠/♣ glyphs, which made the corner index and the centre disagree.
const SUIT_FONT = 'font-normal not-italic [font-family:var(--font-sans)]';

const RED_SUITS: Array<`${ESuit}`> = [ESuit.HEARTS, ESuit.DIAMONDS];

const ROYAL_RANKS: Array<`${ERank}`> = [ERank.KING, ERank.QUEEN, ERank.JACK];

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

// Proportions follow a real playing card (≈ 5:7). `md` keeps 48px of width because the
// animation layers (MeldScoreAnimation, DrawAnimation) use it as their reference size.
const SIZES = {
  sm: 'w-8 h-[45px] rounded-[4px]',
  md: 'w-12 h-[67px] rounded-[6px]',
  lg: 'w-[68px] h-[95px] rounded-[7px]',
  xl: 'w-[104px] h-[146px] rounded-[10px]',
};

const CORNER_SIZES = {
  sm: 'text-[8px] top-[2px] left-[3px]',
  md: 'text-[11px] top-[3px] left-[4px]',
  lg: 'text-[14px] top-[4px] left-[5px]',
  xl: 'text-[20px] top-[6px] left-[8px]',
};

const CORNER_SIZES_BOTTOM = {
  sm: 'text-[8px] bottom-[2px] right-[3px]',
  md: 'text-[11px] bottom-[3px] right-[4px]',
  lg: 'text-[14px] bottom-[4px] right-[5px]',
  xl: 'text-[20px] bottom-[6px] right-[8px]',
};

const PIP_SIZES = {
  sm: 'text-[8px]',
  md: 'text-[12px]',
  lg: 'text-[16px]',
  xl: 'text-[25px]',
};

const ACE_PIP_SIZES = {
  sm: 'text-lg',
  md: 'text-[28px]',
  lg: 'text-[40px]',
  xl: 'text-[64px]',
};

// Court-card frame: wide, with a notch cut out of the top-left and bottom-right corners, exactly
// where the corner index (rank + suit) sits, plus a small gap — so the frame never touches it.
// Notch sizes were measured from the rendered index (Boska rank + sans suit) at each size.
const ROYAL_FRAME = {
  sm: 'inset-x-[5px] inset-y-[9px] rounded-[2px]',
  md: 'inset-x-[7px] inset-y-[13px] rounded-[3px]',
  lg: 'inset-x-[9px] inset-y-[17px] rounded-[4px]',
  xl: 'inset-x-[14px] inset-y-[26px] rounded-[6px]',
};

const ROYAL_NOTCH = {
  sm: { x: 6, y: 8 },
  md: { x: 8, y: 11 },
  lg: { x: 10, y: 13 },
  xl: { x: 12, y: 16 },
};

function royalClipPath(size: keyof typeof ROYAL_NOTCH): string {
  const { x, y } = ROYAL_NOTCH[size];

  return `polygon(${x}px 0, 100% 0, 100% calc(100% - ${y}px), calc(100% - ${x}px) calc(100% - ${y}px), calc(100% - ${x}px) 100%, 0 100%, 0 ${y}px, ${x}px ${y}px)`;
}

const ROYAL_LETTER_SIZES = {
  sm: 'text-[15px]',
  md: 'text-[24px]',
  lg: 'text-[34px]',
  xl: 'text-[54px]',
};

// Reserved space between the central pips area and the corner indices, to avoid collisions.
const PIP_PADDING = {
  sm: 'inset-x-[5px] inset-y-1',
  md: 'inset-x-[8px] inset-y-1.5',
  lg: 'inset-x-[11px] inset-y-2',
  xl: 'inset-x-[17px] inset-y-3',
};

const BACK_FRAME = {
  sm: 'inset-[2px] rounded-[2px]',
  md: 'inset-[3px] rounded-[4px]',
  lg: 'inset-[4px] rounded-[5px]',
  xl: 'inset-[6px] rounded-[7px]',
};

const BACK_LOGO = {
  sm: 'w-3 h-3',
  md: 'w-5 h-5',
  lg: 'w-7 h-7',
  xl: 'w-10 h-10',
};

// The two-suit cross of the Cross Poker logo (public/icon.svg), redrawn as a single path to be
// coloured by `currentColor` on the card back.
const LOGO_PATH = 'M251.126 354.535C251.488 354.535 251.846 354.614 252.174 354.768C252.501 354.921 252.791 355.145 253.021 355.423L270.617 376.699C271.333 377.565 271.725 378.649 271.725 379.768C271.725 380.886 271.333 381.97 270.617 382.835L253.021 404.111C252.791 404.389 252.501 404.613 252.174 404.767C251.846 404.92 251.488 405 251.126 405C250.764 405 250.406 404.92 250.078 404.767C249.751 404.613 249.461 404.389 249.231 404.111L231.635 382.835C230.919 381.97 230.528 380.886 230.528 379.769C230.528 378.651 230.919 377.567 231.635 376.702L249.231 355.423C249.461 355.145 249.751 354.921 250.078 354.768C250.406 354.614 250.764 354.535 251.126 354.535ZM249.581 95C249.591 95.0054 390.163 172.011 390.163 277.306C390.165 293.717 384.931 309.703 375.221 322.943C365.511 336.184 351.829 345.99 336.161 350.939C320.493 355.889 303.653 355.724 288.085 350.469C284.958 349.413 281.916 348.163 278.973 346.73L277.577 344.454C268.314 329.448 259.924 315.849 259.022 293.724L259.312 293.918C276.519 305.151 292.37 315.5 308.2 315.5C318.491 315.5 328.359 311.412 335.636 304.136C342.912 296.859 347 286.991 347 276.7C347 266.41 342.912 256.541 335.636 249.265C328.359 241.988 318.491 237.9 308.2 237.9C294.756 237.9 286.123 244.66 272.775 255.098C270.351 257.012 267.738 259.036 264.939 261.17L267.218 257.688C278.45 240.481 288.8 224.63 288.8 208.8C288.8 198.509 284.712 188.641 277.436 181.364C270.159 174.088 260.29 170 250 170C239.71 170 229.841 174.088 222.564 181.364C215.288 188.641 211.2 198.509 211.2 208.8C211.2 224.64 221.55 240.49 232.782 257.688L235.062 261.17C232.262 259.03 229.65 257.005 227.225 255.098C213.877 244.66 205.244 237.9 191.8 237.9C181.51 237.9 171.641 241.988 164.364 249.265C157.088 256.541 153 266.41 153 276.7C153 286.991 157.088 296.859 164.364 304.136C171.641 311.412 181.51 315.5 191.8 315.5C207.64 315.5 223.49 305.151 240.689 293.918L240.979 293.724C240.076 315.849 231.686 329.448 222.423 344.454L221.395 346.131C218.08 347.816 214.633 349.269 211.078 350.469C195.51 355.724 178.67 355.889 163.002 350.939C147.334 345.99 133.652 336.184 123.941 322.943C114.231 309.703 108.998 293.717 109 277.306C109 172.108 249.313 95.147 249.581 95Z';

export function CrossLogo({ className = '' }: { className?: string }) {
  return (
    <svg
      viewBox="100 90 300 320"
      aria-hidden="true"
      className={className}
    >
      <path
        d={LOGO_PATH}
        fill="currentColor"
      />
    </svg>
  );
}

const CARD_SHADOW = 'shadow-[0_1px_0_rgba(0,0,0,0.22),0_3px_8px_-2px_rgba(0,0,0,0.35)]';

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
        className={`card-back relative shrink-0 ${SIZES[size]} ${CARD_SHADOW} ${className}`}
      >
        <span className={`absolute ${BACK_FRAME[size]} flex items-center justify-center ring-[1.5px] ring-paper/70`}>
          <CrossLogo className={`${BACK_LOGO[size]} text-gold`} />
        </span>
      </motion.div>
    );
  }

  const color = RED_SUITS.includes(card.suit) ? 'text-suit-red' : 'text-ink';
  const symbol = SUIT_SYMBOL[card.suit];
  const pipCount = PIP_COUNT[card.rank];
  const isRoyal = ROYAL_RANKS.includes(card.rank);

  return (
    <motion.button
      layout
      layoutId={layoutId}
      type="button"
      disabled={!clickable}
      onClick={onClick}
      aria-label={`${card.rank} de ${SUIT_NAME[card.suit]}`}
      aria-pressed={clickable ? !!selected : undefined}
      className={`card-face relative shrink-0 ${SIZES[size]} ${CARD_SHADOW} ${color} select-none transition-[translate,box-shadow] duration-200 ease-out ${clickable ? 'cursor-pointer hover:-translate-y-1.5' : 'cursor-default'} ${selected ? '-translate-y-3 hover:-translate-y-3 outline-[3px] outline-gold outline-offset-0' : ''} ${className}`}
    >
      <span className={`absolute flex flex-col items-center leading-[0.9] font-display font-medium ${CORNER_SIZES[size]}`}>
        <span>
          {card.rank}
        </span>

        <span className={`text-[0.85em] ${SUIT_FONT}`}>
          {symbol}
        </span>
      </span>

      <span className={`absolute flex flex-col items-center leading-[0.9] font-display font-medium rotate-180 ${CORNER_SIZES_BOTTOM[size]}`}>
        <span>
          {card.rank}
        </span>

        <span className={`text-[0.85em] ${SUIT_FONT}`}>
          {symbol}
        </span>
      </span>

      {isRoyal && (
        <span
          className={`absolute ${ROYAL_FRAME[size]} flex items-center justify-center ${RED_SUITS.includes(card.suit) ? 'bg-suit-red/10' : 'bg-ink/[0.07]'}`}
          style={{ clipPath: royalClipPath(size) }}
        >
          <span className={`font-display italic font-medium leading-none ${ROYAL_LETTER_SIZES[size]}`}>
            {card.rank}
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
