'use client';

import { useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { animate, motion } from 'motion/react';
import { UtilsFor } from '@/components/utils/For';
import { UtilsIf } from '@/components/utils/If';
import { Card } from './Card';
import { ChipBurst } from './ChipBurst';
import { MarqueeBulbs, SlotReel } from './SlotReel';
import { chipsForCard } from '../models/Card';
import { sounds } from '@/utils/sound';
import { ECombo } from '../enums/ECombo';
import type { ICard } from '../models/Card';

// Portuguese display names — same source of truth as the table in `.claude/rules/game-concept.md`,
// section 2, "Combinações e pontuação" (see also `ComboReference.tsx`, which uses the same names).
export const COMBO_NAME: Record<`${ECombo}`, string> = {
  [ECombo.HIGH_CARD]: 'Carta Alta',
  [ECombo.PAIR]: 'Par',
  [ECombo.TWO_PAIR]: 'Dois Pares',
  [ECombo.THREE_OF_A_KIND]: 'Trinca',
  [ECombo.STRAIGHT]: 'Sequência',
  [ECombo.FLUSH]: 'Flush',
  [ECombo.FULL_HOUSE]: 'Full House',
  [ECombo.FOUR_OF_A_KIND]: 'Quadra',
  [ECombo.STRAIGHT_FLUSH]: 'Straight Flush',
};

// "Slot machine" easing curve: accelerates fast at the start and decelerates heavily near the
// end, giving the feeling of "spinning and landing" on the right value instead of a linear count.
const EASE_SLOT_MACHINE: [number, number, number, number] = [0.11, 0.75, 0.24, 1];

const CARD_WIDTH = 48; // "md" size of <Card /> — see components/Card.tsx, SIZES.md
const CARD_HEIGHT = 64;
const FAN_SPACING = 40;
const Y_SCORING = -16; // scoring cards rise up and stay in evidence
const Y_NOT_SCORING = 20; // non-scoring cards recede behind, smaller and faded

const FLIGHT_DURATION_MS = 480;
const FLIGHT_STAGGER_MS = 70;
const HOP_DURATION_MS = 420;
const INTERVAL_BETWEEN_CARDS_MS = 220;
const MULTIPLIER_DURATION_MS = 450;
const TOTAL_DURATION_MS = 850;
const BIG_SCORE_POINTS = 500;
const EXIT_DURATION_MS = 480;

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

type Phase = 'flying' | 'cards' | 'multiplier' | 'total';

type AnimationState = {
  phase: Phase;
  cardsRevealed: number;
  chipsShown: number;
  pointsShown: number;
  // The total reel stopped on the final value — bulbs flash, the window lights up.
  landed: boolean;
};

const INITIAL_STATE: AnimationState = {
  phase: 'flying', cardsRevealed: 0, chipsShown: 0, pointsShown: 0, landed: false,
};

export type Point = { x: number; y: number };

export type MeldScoreAnimationProps = {
  combo: `${ECombo}`;
  // All cards played in the Jogada, in the order they were played — includes ones that don't
  // score (see game-concept.md: "all played cards, scoring or not, go to the Bolo").
  meldedCards: ICard[];
  // Subset of `meldedCards` that makes up the combo — only these add up Chips.
  scoringCards: ICard[];
  chips: number;
  multiplier: number;
  points: number;
  // Point (px, relative to the board's center) from which the cards fly out — the seat position
  // of whoever played. See `ORIGIN_BY_SEAT` in `MeldScoreAnimationLayer.tsx`.
  origin: Point;
  // Optional label shown above the combo (e.g. the name of who played).
  label?: string;
  // Plays the slot-machine roulette (instead of the regular chip roll) on totals above
  // BIG_SCORE_POINTS — only for the author of the Jogada.
  bigScoreSound?: boolean;
  onFinish: () => void;
};

/**
 * Meld score animation engine — SINGLE and IDENTICAL for the play's author and for the other
 * players (see game-concept.md, "Animações"): the played cards fly from the seat of whoever
 * played to the board's center; only the combo's cards (`scoringCards`) stay in evidence
 * (larger, raised, glowing) — the rest land smaller and faded behind. Then, card by card, each
 * scoring card hops and reveals its Chips value, adding to a counter; finally it shows the
 * hand's multiplier and the total (`points`).
 *
 * Calls `onFinish` exactly once, at the end of the full sequence plus the result display time.
 * Always restarts whenever the play's data changes.
 */
export function MeldScoreAnimation({
  combo, meldedCards, scoringCards, chips, multiplier, points, origin, label, bigScoreSound, onFinish,
}: MeldScoreAnimationProps) {
  const [{
    phase, cardsRevealed, chipsShown, pointsShown, landed,
  }, setState] = useState<AnimationState>(INITIAL_STATE);

  const onFinishRef = useRef(onFinish);
  const cardRefs = useRef<Record<string, HTMLDivElement | null>>({});

  useEffect(() => {
    onFinishRef.current = onFinish;
  }, [onFinish]);

  const scoringIds = new Set(scoringCards.map((card) => card.id));
  const n = meldedCards.length;

  function finalPosition(index: number): Point {
    return { x: (index - (n - 1) / 2) * FAN_SPACING, y: scoringIds.has(meldedCards[index].id) ? Y_SCORING : Y_NOT_SCORING };
  }

  // Scoring card that just hopped — used to display the floating "+N" right above it.
  const justRevealedCard = phase === 'cards' && cardsRevealed > 0 ? scoringCards[cardsRevealed - 1] : null;
  const justRevealedIndex = justRevealedCard ? meldedCards.findIndex((card) => card.id === justRevealedCard.id) : -1;

  useEffect(() => {
    let cancelled = false;

    const baseChips = chips - scoringCards.reduce((sum, card) => sum + chipsForCard(card), 0);
    const totalFlightDurationMs = FLIGHT_DURATION_MS + Math.max(0, n - 1) * FLIGHT_STAGGER_MS;

    async function hopCard(index: number, accumulated: number): Promise<void> {
      if (cancelled) return;

      if (index >= scoringCards.length) {
        setState((s) => ({ ...s, phase: 'multiplier' }));
        await wait(MULTIPLIER_DURATION_MS);

        if (cancelled) return;

        setState((s) => ({ ...s, phase: 'total', pointsShown: chips }));
        if (bigScoreSound && points > BIG_SCORE_POINTS) sounds.roulette(TOTAL_DURATION_MS + 500);
        else sounds.chipRoll();

        await animate(chips, points, {
          duration: TOTAL_DURATION_MS / 1000,
          ease: EASE_SLOT_MACHINE,
          onUpdate: (value) => {
            if (!cancelled) setState((s) => ({ ...s, pointsShown: value }));
          },
        });

        if (cancelled) return;

        setState((s) => ({ ...s, pointsShown: points, landed: true }));

        await wait(1900);

        if (!cancelled) onFinishRef.current();

        return;
      }

      const card = scoringCards[index];
      const el = cardRefs.current[card.id];

      if (el) {
        animate(el, { y: [Y_SCORING, Y_SCORING - 26, Y_SCORING], scale: [1, 1.16, 1] }, { duration: HOP_DURATION_MS / 1000, ease: 'easeOut' });
      }

      setState((s) => ({ ...s, cardsRevealed: index + 1 }));
      sounds.chipTick(index);

      const target = accumulated + chipsForCard(card);

      await animate(accumulated, target, {
        duration: HOP_DURATION_MS / 1000,
        ease: EASE_SLOT_MACHINE,
        onUpdate: (value) => {
          if (!cancelled) setState((s) => ({ ...s, chipsShown: value }));
        },
      });

      if (cancelled) return;

      await wait(INTERVAL_BETWEEN_CARDS_MS);

      await hopCard(index + 1, target);
    }

    // Restarts the visual sequence whenever a NEW play arrives (effect dependencies) —
    // needed because the component may be reused (without unmounting) between consecutive
    // plays.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setState(INITIAL_STATE);

    // Deferred a tick (and guarded by `cancelled`) so a StrictMode double-run doesn't play it twice.
    wait(40).then(() => {
      if (!cancelled) sounds.cardsPlayed(n);
    });

    wait(totalFlightDurationMs).then(() => {
      if (cancelled) return undefined;

      setState((s) => ({ ...s, phase: 'cards' }));

      return animate(0, baseChips, {
        duration: HOP_DURATION_MS / 1000,
        ease: EASE_SLOT_MACHINE,
        onUpdate: (value) => {
          if (!cancelled) setState((s) => ({ ...s, chipsShown: value }));
        },
      }).then(() => hopCard(0, baseChips));
    });

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [combo, meldedCards, scoringCards, chips, multiplier, points]);

  const counting = phase !== 'flying';
  const multiplierKnown = phase === 'multiplier' || phase === 'total';
  const chipsDigits = Math.max(2, String(chips).length);
  const pointsDigits = Math.max(3, String(points).length);

  const bulbsMode = landed ? 'flash' : 'chase';

  return (
    <div className="pointer-events-none absolute inset-0 z-40 overflow-visible">
      <div
        className="absolute left-1/2 top-1/2"
        style={{ transform: 'translate(-50%, -50%)' }}
      >
        <UtilsFor
          each={meldedCards}
          eachKey={({ item }) => item.id}
        >
          {({ item: card, index }) => {
            const scoring = scoringIds.has(card.id);
            const final = finalPosition(index);

            return (
              <motion.div
                ref={(el) => { cardRefs.current[card.id] = el; }}
                className="absolute left-0 top-0"
                style={{ marginLeft: -CARD_WIDTH / 2, zIndex: scoring ? 2 : 1 }}
                initial={{ x: origin.x, y: origin.y, opacity: 0, scale: 0.6 }}
                animate={{
                  x: final.x,
                  y: final.y,
                  opacity: scoring ? 1 : 0.4,
                  scale: scoring ? 1 : 0.72,
                }}
                exit={{
                  x: 0,
                  y: 0,
                  opacity: 0,
                  scale: 0.55,
                  transition: { duration: EXIT_DURATION_MS / 1000, delay: (index * 40) / 1000, ease: 'easeIn' },
                }}
                transition={{ duration: FLIGHT_DURATION_MS / 1000, delay: (index * FLIGHT_STAGGER_MS) / 1000, ease: 'easeOut' }}
              >
                <Card
                  card={card}
                  size="md"
                  className={scoring ? 'outline-[3px] outline-gold' : 'grayscale'}
                />
              </motion.div>
            );
          }}
        </UtilsFor>

        <UtilsIf condition={justRevealedIndex >= 0}>
          {() => {
            const pos = finalPosition(justRevealedIndex);
            const card = meldedCards[justRevealedIndex];

            return (
              <>
                <div
                  key={`burst-${card.id}`}
                  className="absolute left-0 top-0"
                  style={{ transform: `translate(${pos.x}px, ${pos.y - CARD_HEIGHT / 2}px)` }}
                >
                  <ChipBurst
                    count={3}
                    reach={48}
                    size={16}
                  />
                </div>

                <motion.span
                  key={card.id}
                  className="absolute left-0 top-0 text-gold font-display font-medium text-2xl tabular-nums whitespace-nowrap"
                  style={{ translateX: '-50%' }}
                  initial={{ x: pos.x, y: pos.y - CARD_HEIGHT / 2, opacity: 0, scale: 0.6 }}
                  animate={{ x: pos.x, y: pos.y - CARD_HEIGHT / 2 - 34, opacity: [0, 1, 1, 0], scale: 1 }}
                  transition={{ duration: (HOP_DURATION_MS + 150) / 1000, ease: 'easeOut' }}
                >
                  {`+${chipsForCard(card)}`}
                </motion.span>
              </>
            );
          }}
        </UtilsIf>
      </div>

      {/* The slot cabinet. Positioned by the outer div; the inner one is the motion element, so its
          enter/exit transforms don't fight the centring translate. */}
      <div
        className="absolute left-1/2 top-1/2"
        style={{ transform: 'translate(-50%, 78px)' }}
      >
        <motion.div
          className="relative flex flex-col items-center gap-2.5 bg-felt-night border-[3px] border-gold-deep px-4 md:px-5 pt-2.5 pb-3 shadow-[0_22px_44px_-18px_rgba(0,0,0,0.75)]"
          initial={{ opacity: 0, y: 36, scale: 0.86 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{
            opacity: 0,
            y: 28,
            scale: 0.92,
            transition: { duration: EXIT_DURATION_MS / 1000, ease: [0.4, 0, 0.7, 0.2] },
          }}
          transition={{ type: 'spring', stiffness: 260, damping: 22, delay: 0.12 }}
        >
          <MarqueeBulbs
            count={13}
            mode={bulbsMode}
          />

          <div className="flex flex-col items-center gap-1 min-h-11 justify-end">
            <UtilsIf condition={!!label}>
              {() => (
                <span className="text-paper/80 text-[13px] leading-none">
                  {label}
                </span>
              )}
            </UtilsIf>

            <motion.span
              className="text-gold font-display italic text-[24px] md:text-[28px] leading-none whitespace-nowrap"
              initial={false}
              animate={{ opacity: counting ? 1 : 0, y: counting ? 0 : -10, scale: landed ? [1, 1.12, 1] : 1 }}
              transition={{ duration: 0.4, ease: 'easeOut' }}
            >
              {COMBO_NAME[combo]}
            </motion.span>
          </div>

          <div className="flex items-start gap-1.5 md:gap-2 text-[24px] md:text-[30px]">
            <ReelSlot caption="fichas">
              <SlotReel
                value={chipsShown}
                digits={chipsDigits}
                spinning={!counting}
              />
            </ReelSlot>

            <span className="font-display text-gold text-[0.9em] leading-[1.45em]">
              ×
            </span>

            <ReelSlot caption="mult.">
              <SlotReel
                value={multiplierKnown ? multiplier : 0}
                digits={String(multiplier).length}
                spinning={!multiplierKnown}
                tone="gold"
              />
            </ReelSlot>

            <span className="font-display text-gold text-[0.9em] leading-[1.45em]">
              =
            </span>

            <ReelSlot caption="pontos">
              <motion.span
                className="relative block"
                animate={{ scale: landed ? [1, 1.14, 1] : 1 }}
                transition={{ duration: 0.45, ease: 'backOut' }}
              >
                <SlotReel
                  value={phase === 'total' ? pointsShown : 0}
                  digits={pointsDigits}
                  spinning={phase !== 'total'}
                  lit={landed}
                />

                <UtilsIf condition={landed}>
                  {() => (
                    <ChipBurst
                      count={Math.min(14, 5 + Math.floor(points / 40))}
                      reach={140}
                      size={26}
                    />
                  )}
                </UtilsIf>
              </motion.span>
            </ReelSlot>
          </div>

          <MarqueeBulbs
            count={13}
            mode={bulbsMode}
          />
        </motion.div>
      </div>
    </div>
  );
}

// One reel window with its caption underneath.
function ReelSlot({ caption, children }: { caption: string; children: ReactNode }) {
  return (
    <span className="flex flex-col items-center gap-1">
      {children}

      <span className="text-paper/70 text-[12px] leading-none">
        {caption}
      </span>
    </span>
  );
}
