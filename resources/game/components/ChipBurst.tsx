'use client';

import { motion } from 'motion/react';
import { UtilsFor } from '@/components/utils/For';
import { CHIP_COLORS, PokerChip } from './PokerChip';

const PALETTE = [CHIP_COLORS.gold, CHIP_COLORS.red, CHIP_COLORS.felt, CHIP_COLORS.gold, CHIP_COLORS.ink, CHIP_COLORS.pink];

// Deterministic fan of directions (no Math.random, so every viewer sees the same burst).
function chipPath(index: number, count: number, reach: number) {
  const spread = count > 1 ? index / (count - 1) : 0.5;
  const angle = (-160 + spread * 140) * (Math.PI / 180);
  const distance = reach * (0.7 + ((index * 37) % 10) / 30);

  return {
    x: Math.cos(angle) * distance,
    y: Math.sin(angle) * distance,
    rotate: (index % 2 ? 1 : -1) * (180 + index * 25),
  };
}

/**
 * A handful of casino chips that jump out of a point, spin and fall away — the "jackpot" beat
 * of a score. Mount it (or change its `key`) at the moment the burst should play; it is purely
 * decorative and never blocks clicks.
 */
export function ChipBurst({ count = 8, reach = 120, size = 26, delay = 0 }: { count?: number; reach?: number; size?: number; delay?: number }) {
  const chips = Array.from({ length: count }, (_, index) => index);

  return (
    <div
      className="pointer-events-none absolute left-1/2 top-1/2 w-0 h-0"
      aria-hidden="true"
    >
      <UtilsFor
        each={chips}
        eachKey={({ item }) => item}
      >
        {({ item: index }) => {
          const path = chipPath(index, count, reach);

          return (
            <motion.div
              className="absolute"
              style={{ width: size, height: size, left: -size / 2, top: -size / 2 }}
              initial={{ x: 0, y: 0, opacity: 1, rotate: 0, scale: 0.5 }}
              animate={{ x: path.x, y: [0, path.y, path.y + reach * 0.6], opacity: [1, 1, 0], rotate: path.rotate, scale: 1 }}
              transition={{ duration: 1.15, delay: delay + index * 0.025, ease: 'easeOut' }}
            >
              <PokerChip
                color={PALETTE[index % PALETTE.length]}
                className="w-full h-full drop-shadow-[0_2px_2px_rgba(0,0,0,0.35)]"
              />
            </motion.div>
          );
        }}
      </UtilsFor>
    </div>
  );
}
