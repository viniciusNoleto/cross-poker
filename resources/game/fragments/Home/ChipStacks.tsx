'use client';

import { useEffect, useRef, useState } from 'react';
import { motion, useInView, useReducedMotion } from 'motion/react';
import { UtilsFor } from '@/components/utils/For';
import { TEAM_PALETTE } from '@/shared/constants/colors';
import { StackedChip } from '@/resources/game/components/PokerChip';

const SUITS = [
  { symbol: '♠', left: '8%', top: '14%', size: '3.5rem', delay: '0s', red: false },
  { symbol: '♥', left: '78%', top: '9%', size: '4.5rem', delay: '-3s', red: true },
  { symbol: '♦', left: '86%', top: '58%', size: '3rem', delay: '-6s', red: true },
  { symbol: '♣', left: '14%', top: '62%', size: '4rem', delay: '-9s', red: false },
  { symbol: '♥', left: '44%', top: '6%', size: '2.5rem', delay: '-4.5s', red: true },
];

// How many chips each team ends up with in one round of the loop, and the colour of each chip.
const TEAM_A = ['#f2b739', '#f2b739', '#17140f', '#f2b739', '#b3132b', '#f2b739', '#f2b739', '#17140f', '#f2b739'];

const TEAM_B = ['#ef6f7f', '#b3132b', '#ef6f7f', '#17140f', '#ef6f7f', '#ef6f7f', '#b3132b'];

const DROP_MS = 420;

const HOLD_MS = 2400;

const CHIP_STEP = 11;

function Stack({ colors, count, label, accent }: { colors: string[]; count: number; label: string; accent: string }) {
  return (
    <div className="flex flex-col items-center gap-5">
      <div
        className="relative w-28"
        style={{ height: 58 + colors.length * CHIP_STEP }}
      >
        <UtilsFor
          each={colors.slice(0, count)}
          eachKey={({ index }) => index}
        >
          {({ item, index }) => (
            <motion.div
              className="absolute inset-x-0"
              style={{ bottom: index * CHIP_STEP, zIndex: index }}
              initial={{ y: -260, opacity: 0, rotate: index % 2 ? 8 : -8 }}
              animate={{ y: 0, opacity: 1, rotate: 0 }}
              transition={{ type: 'spring', stiffness: 520, damping: 26, mass: 0.8 }}
            >
              <StackedChip
                color={item}
                width={112}
              />
            </motion.div>
          )}
        </UtilsFor>
      </div>

      <div className="flex flex-col items-center gap-1">
        <span
          className="text-[0.9375rem] font-bold"
          style={{ color: accent }}
        >
          {label}
        </span>

        <span className="font-display text-[1.75rem] leading-none tabular-nums text-paper">
          {count * 25}
        </span>
      </div>
    </div>
  );
}

/**
 * Two chip towers, one per team, filling up turn after turn (chips alternate between them, like
 * the turn order alternates the teams) over a felt with drifting suits. Loops while on screen.
 */
export function HomeChipStacks() {
  const reduce = !!useReducedMotion();
  const rootRef = useRef<HTMLDivElement>(null);
  const inView = useInView(rootRef, { amount: 0.35 });
  const total = TEAM_A.length + TEAM_B.length;

  const [dropped, setDropped] = useState(total);
  const [round, setRound] = useState(0);

  const running = inView && !reduce;

  useEffect(() => {
    if (!running) return undefined;

    if (dropped >= total) {
      const reset = window.setTimeout(() => {
        setRound((value) => value + 1);
        setDropped(0);
      }, HOLD_MS);

      return () => window.clearTimeout(reset);
    }

    const next = window.setTimeout(() => setDropped((value) => value + 1), DROP_MS);

    return () => window.clearTimeout(next);
  }, [dropped, running, total]);

  // Chips alternate A, B, A, B… until Team B's pile is full; the rest all go to Team A.
  const countA = dropped <= TEAM_B.length * 2 ? Math.ceil(dropped / 2) : dropped - TEAM_B.length;
  const countB = dropped - countA;

  return (
    <div
      ref={rootRef}
      className="felt-surface relative overflow-hidden min-h-110 md:min-h-130 flex items-end justify-center gap-10 md:gap-16 px-6 pb-12 pt-24"
      aria-hidden="true"
    >
      <UtilsFor
        each={SUITS}
        eachKey={({ index }) => index}
      >
        {({ item }) => (
          <span
            className={`suit-float absolute leading-none ${item.red ? 'text-suit-red' : 'text-felt-night'}`}
            style={{ left: item.left, top: item.top, fontSize: item.size, animationDelay: item.delay }}
          >
            {item.symbol}
          </span>
        )}
      </UtilsFor>

      <div
        key={round}
        className="relative flex items-end gap-10 md:gap-16"
      >
        <Stack
          colors={TEAM_A}
          count={countA}
          label="Dupla A"
          accent={TEAM_PALETTE.a}
        />

        <Stack
          colors={TEAM_B}
          count={countB}
          label="Dupla B"
          accent={TEAM_PALETTE.b}
        />
      </div>
    </div>
  );
}
