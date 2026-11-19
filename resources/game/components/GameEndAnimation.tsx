'use client';

import { useEffect, useMemo, useRef } from 'react';
import { motion, useReducedMotion } from 'motion/react';
import { UtilsFor } from '@/components/utils/For';
import { UtilsIf } from '@/components/utils/If';
import { Card } from './Card';
import { CHIP_COLORS, PokerChip } from './PokerChip';
import { buildDeck } from '../models/Deck';
import { sounds } from '@/utils/sound';

const CARD_COUNT = 26;
const CHIP_COUNT = 30;
const DURATION_MS = 3400;

const CHIP_PALETTE = [CHIP_COLORS.gold, CHIP_COLORS.red, CHIP_COLORS.pink, CHIP_COLORS.ink, CHIP_COLORS.felt];

// Deterministic pseudo-random in [0, 1) — every viewer sees the same explosion, and the render
// stays pure (no Math.random during render).
function seeded(index: number, salt: number): number {
  const value = Math.sin(index * 12.9898 + salt * 78.233) * 43758.5453;

  return value - Math.floor(value);
}

type Flyer = {
  key: string;
  kind: 'card' | 'chip';
  index: number;
  x: number;
  peakY: number;
  fallY: number;
  rotate: number;
  delay: number;
  duration: number;
  scale: number;
};

function buildFlyers(): Flyer[] {
  const flyers: Flyer[] = [];
  const total = CARD_COUNT + CHIP_COUNT;

  for (let i = 0; i < total; i++) {
    const kind = i < CARD_COUNT ? 'card' : 'chip';
    // Fan of launch angles pointing mostly upwards, spread over the whole screen width.
    const angle = (-170 + seeded(i, 1) * 160) * (Math.PI / 180);
    const reach = 0.35 + seeded(i, 2) * 0.55; // fraction of the viewport

    flyers.push({
      key: `${kind}-${i}`,
      kind,
      index: i,
      x: Math.cos(angle) * reach * 60, // vw
      peakY: Math.sin(angle) * reach * 55, // vh (negative = up)
      fallY: 70 + seeded(i, 3) * 30, // vh, falls off the bottom
      rotate: (seeded(i, 4) > 0.5 ? 1 : -1) * (240 + seeded(i, 5) * 600),
      delay: seeded(i, 6) * 0.45,
      duration: 2.1 + seeded(i, 7) * 0.9,
      scale: kind === 'card' ? 0.9 + seeded(i, 8) * 0.5 : 0.8 + seeded(i, 8) * 0.8,
    });
  }

  return flyers;
}

/**
 * End-of-game celebration: every card of the deck and a pile of chips burst out of the center of
 * the table, spin through the air and rain down off the screen, with the end fanfare. Plays once
 * on mount and calls `onFinish` when done. Purely decorative (never blocks clicks).
 */
export function GameEndAnimation({ outcome, title, onFinish }: {
  outcome: 'win' | 'lose' | 'tie';
  title: string;
  onFinish: () => void;
}) {
  const reduce = !!useReducedMotion();
  const flyers = useMemo(() => buildFlyers(), []);
  const cards = useMemo(() => buildDeck(), []);
  const onFinishRef = useRef(onFinish);

  useEffect(() => {
    onFinishRef.current = onFinish;
  }, [onFinish]);

  useEffect(() => {
    const soundTimer = setTimeout(() => sounds.gameEnd(outcome), 60);
    const finishTimer = setTimeout(() => onFinishRef.current(), reduce ? 1200 : DURATION_MS);

    return () => {
      clearTimeout(soundTimer);
      clearTimeout(finishTimer);
    };
  }, [outcome, reduce]);

  return (
    <div
      className="pointer-events-none fixed inset-0 z-300 overflow-hidden"
      aria-hidden="true"
    >
      <motion.div
        className="absolute inset-0 bg-felt-night"
        initial={{ opacity: 0 }}
        animate={{ opacity: [0, 0.55, 0.55, 0] }}
        transition={{ duration: DURATION_MS / 1000, times: [0, 0.15, 0.8, 1] }}
      />

      <UtilsFor
        each={reduce ? [] : flyers}
        eachKey={({ item }) => item.key}
      >
        {({ item }) => (
          <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2">
            <motion.div
              initial={{ x: '0vw', y: '0vh', rotate: 0, opacity: 0, scale: 0.3 }}
              animate={{
                x: ['0vw', `${item.x * 0.7}vw`, `${item.x}vw`],
                y: ['0vh', `${item.peakY}vh`, `${item.fallY}vh`],
                rotate: item.rotate,
                opacity: [0, 1, 1, 0.9],
                scale: item.scale,
              }}
              transition={{ duration: item.duration, delay: item.delay, ease: ['easeOut', 'easeIn'], times: [0, 0.4, 1] }}
            >
              <UtilsIf
                cases={[
                  {
                    condition: item.kind === 'card',
                    content: () => (
                      <Card
                        card={cards[(item.index * 7) % cards.length]}
                        size="md"
                      />
                    ),
                  },
                  {
                    content: () => (
                      <PokerChip
                        color={CHIP_PALETTE[item.index % CHIP_PALETTE.length]}
                        className="w-8 h-8 drop-shadow-[0_3px_3px_rgba(0,0,0,0.4)]"
                      />
                    ),
                  },
                ]}
              />
            </motion.div>
          </div>
        )}
      </UtilsFor>

      <motion.div
        className="absolute inset-0 flex items-center justify-center"
        initial={{ opacity: 0, scale: 0.4 }}
        animate={{ opacity: [0, 1, 1, 0], scale: [0.4, 1.08, 1, 1.1] }}
        transition={{ duration: DURATION_MS / 1000, times: [0, 0.18, 0.78, 1] }}
      >
        <span className="font-display italic text-gold text-[clamp(2.75rem,8vw,6rem)] leading-none text-center px-4 drop-shadow-[0_6px_0_rgba(0,0,0,0.35)]">
          {title}
        </span>
      </motion.div>
    </div>
  );
}
