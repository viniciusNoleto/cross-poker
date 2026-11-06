'use client';

import { useEffect, useRef, useState } from 'react';
import { animate, motion } from 'motion/react';
import { UtilsFor } from '@/components/utils/For';
import { UtilsIf } from '@/components/utils/If';
import { Card } from './Card';
import { ChipBurst } from './ChipBurst';
import { chipsForCard } from '../models/Card';
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
};

const INITIAL_STATE: AnimationState = {
  phase: 'flying', cardsRevealed: 0, chipsShown: 0, pointsShown: 0,
};

export type Point = { x: number; y: number };

export type MeldScoreAnimationProps = {
  combo: `${ECombo}`;
  // All cards played in the Meld, in the order they were played — includes ones that don't
  // score (see game-concept.md: "all played cards, scoring or not, go to the Discard pile").
  meldedCards: ICard[];
  // Subset of `meldedCards` that makes up the combo — only these add up Chips.
  scoringCards: ICard[];
  chips: number;
  multiplier: number;
  points: number;
  // Point (px, relative to the board's center) from which the cards fly out — the seat position
  // of whoever played. See `ORIGIN_BY_SEAT` in `MeldScoreAnimationObservers.tsx`
  // and `MeldScoreAnimationSelf.tsx`.
  origin: Point;
  // Optional label shown above the combo (e.g. the name of who played, in the observer view).
  label?: string;
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
  combo, meldedCards, scoringCards, chips, multiplier, points, origin, label, onFinish,
}: MeldScoreAnimationProps) {
  const [{
    phase, cardsRevealed, chipsShown, pointsShown,
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

        setState((s) => ({ ...s, phase: 'total' }));

        await animate(chips, points, {
          duration: TOTAL_DURATION_MS / 1000,
          ease: EASE_SLOT_MACHINE,
          onUpdate: (value) => {
            if (!cancelled) setState((s) => ({ ...s, pointsShown: Math.round(value) }));
          },
        });

        if (cancelled) return;

        await wait(1800);

        if (!cancelled) onFinishRef.current();

        return;
      }

      const card = scoringCards[index];
      const el = cardRefs.current[card.id];

      if (el) {
        animate(el, { y: [Y_SCORING, Y_SCORING - 26, Y_SCORING], scale: [1, 1.16, 1] }, { duration: HOP_DURATION_MS / 1000, ease: 'easeOut' });
      }

      setState((s) => ({ ...s, cardsRevealed: index + 1 }));

      const target = accumulated + chipsForCard(card);

      await animate(accumulated, target, {
        duration: HOP_DURATION_MS / 1000,
        ease: EASE_SLOT_MACHINE,
        onUpdate: (value) => {
          if (!cancelled) setState((s) => ({ ...s, chipsShown: Math.round(value) }));
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

    wait(totalFlightDurationMs).then(() => {
      if (cancelled) return undefined;

      setState((s) => ({ ...s, phase: 'cards' }));

      return animate(0, baseChips, {
        duration: HOP_DURATION_MS / 1000,
        ease: EASE_SLOT_MACHINE,
        onUpdate: (value) => {
          if (!cancelled) setState((s) => ({ ...s, chipsShown: Math.round(value) }));
        },
      }).then(() => hopCard(0, baseChips));
    });

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [combo, meldedCards, scoringCards, chips, multiplier, points]);

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
                  className="absolute left-0 top-0 text-gold font-display font-medium text-2xl tabular whitespace-nowrap"
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

      <div
        className="absolute left-1/2 top-1/2 flex flex-col items-center gap-1.5 bg-felt-night px-7 py-4 min-w-[220px] shadow-[0_18px_40px_-16px_rgba(0,0,0,0.7)]"
        style={{ transform: 'translate(-50%, 86px)' }}
      >
        <UtilsIf condition={phase !== 'flying' && !!label}>
          {() => (
            <span className="text-paper/80 text-[13px]">
              {label}
            </span>
          )}
        </UtilsIf>

        <UtilsIf condition={phase !== 'flying'}>
          {() => (
            <span className="text-gold font-display italic text-[26px] leading-none">
              {COMBO_NAME[combo]}
            </span>
          )}
        </UtilsIf>

        <UtilsIf condition={phase !== 'flying'}>
          {() => (
            <div className="flex items-center gap-2 font-display tabular">
              <span className="text-paper text-[30px] leading-none">
                {chipsShown}
              </span>

              <UtilsIf condition={phase === 'multiplier' || phase === 'total'}>
                {() => (
                  <>
                    <span className="text-paper/60 text-xl">
                      ×
                    </span>

                    <motion.span
                      initial={{ scale: 0, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      transition={{ duration: 0.3, ease: 'backOut' }}
                      className="text-gold text-[30px] leading-none"
                    >
                      {multiplier}
                    </motion.span>
                  </>
                )}
              </UtilsIf>
            </div>
          )}
        </UtilsIf>

        <UtilsIf condition={phase === 'total'}>
          {() => (
            <ChipBurst
              count={Math.min(14, 5 + Math.floor(points / 40))}
              reach={140}
              size={26}
              delay={0.15}
            />
          )}
        </UtilsIf>

        <UtilsIf condition={phase === 'total'}>
          {() => (
            <motion.span
              initial={{ scale: 0.4, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ duration: 0.35, ease: 'backOut' }}
              className="text-paper font-display tabular text-[36px] leading-none"
            >
              {`= ${pointsShown} pontos`}
            </motion.span>
          )}
        </UtilsIf>
      </div>
    </div>
  );
}
