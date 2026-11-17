'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion, useInView, useReducedMotion } from 'motion/react';
import { UtilsFor } from '@/components/utils/For';
import { UtilsIf } from '@/components/utils/If';
import { COMBO_NAME } from '@/resources/game/components/MeldScoreAnimation';
import { bestCombo } from '@/resources/game/models/Combo';
import type { ICard } from '@/resources/game/models/Card';
import { ChipBurst } from '@/resources/game/components/ChipBurst';
import { sounds } from '@/utils/sound';

const SYMBOL: Record<string, string> = { hearts: '♥', diamonds: '♦', clubs: '♣', spades: '♠' };

const RED = ['hearts', 'diamonds'];

const TILE = 104;

const SPIN_MS = 1100;

const REEL_GAP_MS = 320;

const CYCLE_MS = 5600;

function card(suit: string, rank: string): ICard {
  return { id: `${suit}-${rank}-1`, suit, rank } as ICard;
}

// Fixed outcomes (no randomness, so server and browser render the same first frame).
const OUTCOMES: ICard[][] = [
  [card('hearts', 'K'), card('spades', 'K'), card('clubs', 'K')],
  [card('diamonds', 'A'), card('clubs', '9'), card('spades', 'A')],
  [card('clubs', '7'), card('hearts', '7'), card('diamonds', '7')],
  [card('spades', 'Q'), card('hearts', 'Q'), card('spades', '4')],
  [card('hearts', 'J'), card('hearts', '10'), card('hearts', 'A')],
];

const FILLER: ICard[] = [
  card('spades', '2'), card('hearts', '8'), card('clubs', 'Q'), card('diamonds', '5'),
  card('spades', 'J'), card('hearts', '3'), card('clubs', '10'), card('diamonds', 'K'),
  card('spades', '6'), card('hearts', 'A'), card('clubs', '4'), card('diamonds', '9'),
];

function Tile({ item, state }: { item: ICard; state: 'idle' | 'scoring' | 'dim' }) {
  const color = RED.includes(item.suit) ? 'text-suit-red' : 'text-ink';

  return (
    <div
      className="flex items-center justify-center"
      style={{ height: TILE }}
    >
      <div
        className={`card-face w-[76px] h-[88px] rounded-[6px] flex flex-col items-center justify-center gap-0.5 transition-[opacity,box-shadow] duration-300 ${color} ${state === 'scoring' ? 'shadow-[0_0_0_3px_var(--gold),0_0_24px_rgba(242,183,57,0.55)]' : ''} ${state === 'dim' ? 'opacity-40' : ''}`}
      >
        <span className="font-display text-[2rem] leading-none font-medium">
          {item.rank}
        </span>

        <span className="text-[1.5rem] leading-none">
          {SYMBOL[item.suit]}
        </span>
      </div>
    </div>
  );
}

/**
 * Three-reel "slot machine" that keeps landing small hands and scoring them the way the game
 * does (chips of the scoring cards plus the hand's base, times the multiplier). Starts only when
 * on screen and stays still for people who prefer reduced motion.
 */
export function HomeSlotReels() {
  const reduce = !!useReducedMotion();
  const rootRef = useRef<HTMLDivElement>(null);
  const inView = useInView(rootRef, { amount: 0.4 });

  const [cycle, setCycle] = useState(0);
  const [settledCycle, setSettledCycle] = useState(-1);

  const running = inView && !reduce;
  const spinning = running && settledCycle !== cycle;
  const outcome = OUTCOMES[cycle % OUTCOMES.length];
  const combo = useMemo(() => bestCombo(outcome), [outcome]);
  const scoringIds = combo.scoringCards.map((item) => item.id);
  const cardChips = combo.chips;

  useEffect(() => {
    if (!running) return undefined;

    // Reel ticks slowing down until the last reel lands (silent until the visitor interacts with
    // the page — browsers block audio before that — or when sounds are muted).
    const spinSound = window.setTimeout(() => sounds.roulette(SPIN_MS + REEL_GAP_MS * 2), 0);
    const settle = window.setTimeout(() => setSettledCycle(cycle), SPIN_MS + REEL_GAP_MS * 2 + 120);
    const next = window.setTimeout(() => setCycle((value) => value + 1), CYCLE_MS);

    return () => {
      window.clearTimeout(spinSound);
      window.clearTimeout(settle);
      window.clearTimeout(next);
    };
  }, [cycle, running]);

  return (
    <div
      ref={rootRef}
      className="relative bg-felt-night px-5 py-7 md:px-8 md:py-8 flex flex-col items-center gap-7"
      aria-hidden="true"
    >
      <div className="flex gap-3 md:gap-4 p-3 md:p-4 bg-ink rounded-[10px] shadow-[inset_0_2px_0_rgba(255,255,255,0.06)]">
        <UtilsFor
          each={outcome}
          eachKey={({ index }) => index}
        >
          {({ item: target, index }) => {
            const strip = [...FILLER.slice(index * 3), ...FILLER.slice(0, index * 3), target];
            const end = -(strip.length - 1) * TILE;

            return (
              <div
                className="relative overflow-hidden rounded-[6px] bg-felt-deep w-[84px]"
                style={{ height: TILE }}
              >
                <motion.div
                  key={`${cycle}-${running}`}
                  initial={running ? { y: 0 } : false}
                  animate={{ y: end }}
                  transition={{ duration: (SPIN_MS + index * REEL_GAP_MS) / 1000, ease: [0.18, 0.72, 0.24, 1.06] }}
                >
                  <UtilsFor
                    each={strip}
                    eachKey={({ index: stripIndex }) => stripIndex}
                  >
                    {({ item, index: stripIndex }) => (
                      <Tile
                        item={item}
                        state={stripIndex !== strip.length - 1 || spinning ? 'idle' : scoringIds.includes(item.id) ? 'scoring' : 'dim'}
                      />
                    )}
                  </UtilsFor>
                </motion.div>

                <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(to_bottom,rgba(6,31,22,0.55),transparent_28%,transparent_72%,rgba(6,31,22,0.55))]" />
              </div>
            );
          }}
        </UtilsFor>
      </div>

      <div className="relative w-full min-h-[112px] flex flex-col items-center justify-center text-center text-paper">
        <AnimatePresence mode="wait">
          <UtilsIf
            cases={[
              {
                condition: spinning,
                content: () => (
                  <motion.span
                    key="spin"
                    className="font-display italic text-[1.75rem] text-paper/50"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                  >
                    girando…
                  </motion.span>
                ),
              },
              {
                content: () => (
                  <motion.div
                    key={`score-${cycle}`}
                    className="flex flex-col items-center gap-2"
                    initial={{ opacity: 0, scale: 0.8, y: 10 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, y: -8 }}
                    transition={{ type: 'spring', stiffness: 420, damping: 22 }}
                  >
                    <span className="font-display italic text-[1.75rem] leading-none text-gold">
                      {COMBO_NAME[combo.type]}
                    </span>

                    <span className="flex items-baseline gap-2 tabular text-[1.0625rem]">
                      <span className="bg-[#1d5fa8] px-2 py-0.5 rounded-[4px] font-bold">
                        {cardChips}
                      </span>

                      <span>
                        ×
                      </span>

                      <span className="bg-suit-red px-2 py-0.5 rounded-[4px] font-bold">
                        {combo.multiplier}
                      </span>

                      <span>
                        =
                      </span>

                      <motion.span
                        className="font-display text-[2.5rem] leading-none text-gold"
                        initial={{ scale: 1.6 }}
                        animate={{ scale: 1 }}
                        transition={{ delay: 0.15, type: 'spring', stiffness: 300, damping: 12 }}
                      >
                        {combo.points}
                      </motion.span>
                    </span>
                  </motion.div>
                ),
              },
            ]}
          />
        </AnimatePresence>

        <UtilsIf condition={!spinning && running}>
          {() => (
            <ChipBurst
              key={cycle}
              count={7}
              reach={110}
              size={28}
              delay={0.1}
            />
          )}
        </UtilsIf>
      </div>
    </div>
  );
}
