'use client';

import { motion } from 'motion/react';
import { CrossLogo } from './Card';
import { CHIP_COLORS, PokerChip } from './PokerChip';

export type TurnChipSide = 'bottom' | 'left' | 'top' | 'right';

// Where the chip sits around the seat: always on the side facing the centre of the table
// (the seat at the bottom gets it above, the one on the left gets it on its right, etc.).
const SIDE_PLACEMENT: Record<TurnChipSide, string> = {
  bottom: 'inset-x-0 bottom-[calc(100%+4px)] justify-center',
  top: 'inset-x-0 top-[calc(100%+4px)] justify-center',
  left: 'inset-y-0 left-[calc(100%-8px)] items-center',
  right: 'inset-y-0 right-[calc(100%-8px)] items-center',
};

/**
 * The turn marker: a black chip with the Cross Poker cross in gold, set in front of the player
 * whose turn it is. Only one is mounted at a time (in the current seat) and they all share the
 * same `layoutId`, so when the turn moves the chip slides across the table to the next seat,
 * spinning on the way.
 */
export function TurnChip({ side, turnKey }: { side: TurnChipSide; turnKey: string }) {
  return (
    <div
      className={`pointer-events-none absolute z-20 flex ${SIDE_PLACEMENT[side]}`}
      aria-hidden="true"
    >
      <motion.div
        key={turnKey}
        layoutId="turn-chip"
        className="relative w-9 h-9 md:w-11 md:h-11 rounded-full shadow-[0_3px_0_rgba(0,0,0,0.45),0_6px_14px_-4px_rgba(0,0,0,0.6)]"
        initial={{ rotate: -360 }}
        animate={{ rotate: 0 }}
        transition={{
          layout: { type: 'spring', stiffness: 140, damping: 20, mass: 1 },
          rotate: { duration: 0.9, ease: 'easeOut' },
        }}
      >
        <PokerChip
          color={CHIP_COLORS.ink}
          className="absolute inset-0 w-full h-full"
        />

        <span className="absolute inset-0 flex items-center justify-center">
          <CrossLogo className="w-[46%] h-[46%] text-gold" />
        </span>
      </motion.div>
    </div>
  );
}
