'use client';

import { useEffect } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { nFor, UtilsFor } from '@/components/utils/For';
import { Card } from './Card';
import { useAnimatedLastAction } from '../hooks/useAnimatedLastAction';
import { EActionType } from '../enums/EActionType';
import type { IGameState } from '../models/GameState';

// Same relative-seat mapping used in `app/games/[gameId]/page.tsx` — you always at the bottom,
// your partner always at the top, opponents on the sides, relative to whoever is viewing the screen.
const SEAT_POSITIONS = ['bottom', 'left', 'top', 'right'] as const;

// Offset (in px, from the board's center — where the Discard pile sits) of where each card
// "flies out from", based on the relative seat position of whoever discarded.
const ORIGIN_BY_SEAT: Record<(typeof SEAT_POSITIONS)[number], { x: number; y: number }> = {
  bottom: { x: 0, y: 210 },
  left: { x: -260, y: 0 },
  top: { x: 0, y: -210 },
  right: { x: 260, y: 0 },
};

// Small delay before the first card leaves — suggests "discard first, then draw" without
// depending on the draw animation (an independent visual layer, played by another agent).
const INITIAL_DELAY_MS = 220;
const STAGGER_MS = 90;
const DURATION_PER_CARD_MS = 500;

export type DiscardAnimationProps = {
  state: IGameState;
};

export function DiscardAnimation({ state }: DiscardAnimationProps) {
  const { newAction, clear } = useAnimatedLastAction(state.last_action);
  const you = state.you;

  const discardedCount = newAction?.discarded_count ?? 0;
  const firing = !!you && newAction?.type === EActionType.DISCARD && discardedCount > 0;

  useEffect(() => {
    if (!firing) return;

    const totalDurationMs = INITIAL_DELAY_MS + Math.max(0, discardedCount - 1) * STAGGER_MS + DURATION_PER_CARD_MS;

    const timer = setTimeout(() => clear(), totalDurationMs);

    return () => clearTimeout(timer);
  }, [firing, discardedCount, clear]);

  // Only compute the animated content when there's actually a new Discard action to show — keeps
  // `newAction`/`you` narrowed without a `!` outside the `if`'s scope.
  let content: React.ReactNode = null;

  if (firing && newAction && you) {
    const isYou = newAction.seat === you.seat;
    const relative = (newAction.seat - you.seat + 4) % 4;
    const origin = ORIGIN_BY_SEAT[SEAT_POSITIONS[relative]];
    const middle = (discardedCount - 1) / 2;

    content = (
      <motion.div
        key={newAction.id}
        className="absolute inset-0"
        exit={{ opacity: 0 }}
        transition={{ duration: 0.15 }}
      >
        <UtilsFor
          each={nFor(discardedCount)}
          eachKey={({ item }) => `${newAction.id}-${item}`}
        >
          {({ item: index }) => (
            <motion.div
              className="absolute left-1/2 top-1/2"
              style={{ translateX: '-50%', translateY: '-50%' }}
              initial={{
                x: origin.x + (index - middle) * 14,
                y: origin.y,
                opacity: 0,
                rotate: (index - middle) * 6,
                scale: 0.85,
              }}
              animate={{
                x: (index - middle) * 3,
                y: -index * 1.5,
                opacity: 1,
                rotate: (index - middle) * 2,
                scale: 1,
              }}
              transition={{
                duration: DURATION_PER_CARD_MS / 1000,
                delay: (INITIAL_DELAY_MS + index * STAGGER_MS) / 1000,
                ease: 'easeOut',
              }}
            >
              <Card
                card={null}
                size="md"
                className={isYou ? 'ring-2 ring-secondary-400/70 shadow-[0_0_10px_rgba(212,175,55,0.6)]' : ''}
              />
            </motion.div>
          )}
        </UtilsFor>
      </motion.div>
    );
  }

  // The container below (with `AnimatePresence`) must always stay mounted — only `content`
  // enters/leaves — otherwise `AnimatePresence` would never get a chance to animate the card group's exit.
  return (
    <div className="absolute inset-0 pointer-events-none z-30 overflow-visible">
      <AnimatePresence>
        {content}
      </AnimatePresence>
    </div>
  );
}
