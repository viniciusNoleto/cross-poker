'use client';

import { useEffect, useRef, useState } from 'react';
import { motion } from 'motion/react';
import { UtilsFor } from '@/components/utils/For';
import { UtilsIf } from '@/components/utils/If';
import { Card } from './Card';
import { useAnimatedLastAction } from '../hooks/useAnimatedLastAction';
import { EDrawSource } from '../enums/EDrawSource';
import type { IGameState } from '../models/GameState';
import type { ICard } from '../models/Card';

// Same relative-position mapping used in `app/games/[gameId]/page.tsx`
// (`relative = (player.seat - you.seat + 4) % 4`) — repeated here because this component
// can't import from `page.tsx` nor edit it (see game-concept.md, "Animações").
const SEAT_POSITIONS = ['bottom', 'left', 'top', 'right'] as const;

// Percentage points (relative to the board container, which is where this component should be
// mounted — see the integration instructions in the agent's report) of where each relative seat
// sits. Deliberately approximate: doesn't need to be pixel-perfect, just visually correct.
const DESTINATION_POINT: Record<(typeof SEAT_POSITIONS)[number], { topPct: number; leftPct: number }> = {
  bottom: { topPct: 96, leftPct: 50 },
  left: { topPct: 50, leftPct: 4 },
  top: { topPct: 4, leftPct: 50 },
  right: { topPct: 50, leftPct: 96 },
};

// Center row in `page.tsx`: Monte · Bolo · Descarte. Horizontal distance (px) from the board's
// center to the Monte (left) and the Descarte (right) — the Bolo, in the middle, is never drawn from.
const PILE_OFFSET_X = { narrow: 80, wide: 108 };
const ORIGIN_SIDE: Record<`${EDrawSource}`, -1 | 1> = {
  [EDrawSource.DECK]: -1,
  [EDrawSource.DISCARD]: 1,
};

// "md" size of `<Card />` (see components/Card.tsx, `SIZES.md`: w-12 h-16).
const CARD_WIDTH = 48;
const CARD_HEIGHT = 64;

const DURATION_PER_CARD = 0.6;
const DELAY_BETWEEN_CARDS = 0.12;

type Point = { x: number; y: number };

type FlyingCard = {
  key: string;
  card: ICard | null;
  delay: number;
};

type Flight = {
  origin: Point;
  destination: Point;
  cards: FlyingCard[];
};

/**
 * Animates `drawn_count` cards leaving the Deck/Discard (board center) to the hand of the
 * player who drew, at the correct relative position for EACH observer — see game-concept.md,
 * "Compra junto com a ação" and "Feed de última ação". Must be mounted inside the relative
 * container wrapping the 4 seats (`app/games/[gameId]/page.tsx`), as an absolute overlay.
 *
 * When `newAction.seat` is you, `drawn_cards` comes filled in and the real cards are shown
 * flying to your own hand (the "bottom" position). For other players, the API never sends the
 * identity of drawn cards — it animates face-down cards flying to that player's seat.
 */
export function DrawAnimation({ state }: { state: IGameState }) {
  const { newAction, clear } = useAnimatedLastAction(state.last_action);
  const containerRef = useRef<HTMLDivElement>(null);
  const [flight, setFlight] = useState<Flight | null>(null);

  const you = state.you;

  useEffect(() => {
    if (!newAction) return undefined;

    if (!newAction.draw_source || !you) {
      clear();
      return undefined;
    }

    const quantity = newAction.drawn_count ?? 0;

    if (quantity <= 0) {
      clear();
      return undefined;
    }

    const container = containerRef.current;
    const width = container?.clientWidth ?? 0;
    const height = container?.clientHeight ?? 0;

    const relative = (newAction.seat - you.seat + 4) % 4;
    const destinationPoint = DESTINATION_POINT[SEAT_POSITIONS[relative]];
    const pileOffset = width < 768 ? PILE_OFFSET_X.narrow : PILE_OFFSET_X.wide;
    const originPixels: Point = {
      x: width / 2 + ORIGIN_SIDE[newAction.draw_source] * pileOffset - CARD_WIDTH / 2,
      y: height / 2 - CARD_HEIGHT / 2,
    };

    function toPixels({ topPct, leftPct }: { topPct: number; leftPct: number }): Point {
      return {
        x: (leftPct / 100) * width - CARD_WIDTH / 2,
        y: (topPct / 100) * height - CARD_HEIGHT / 2,
      };
    }

    const isYou = newAction.seat === you.seat;
    const realCards = isYou ? newAction.drawn_cards ?? [] : [];

    setFlight({
      origin: originPixels,
      destination: toPixels(destinationPoint),
      cards: Array.from({ length: quantity }).map((_, index) => ({
        key: `${newAction.id}-${index}`,
        card: isYou ? realCards[index] ?? null : null,
        delay: index * DELAY_BETWEEN_CARDS,
      })),
    });

    const totalDurationMs = ((quantity - 1) * DELAY_BETWEEN_CARDS + DURATION_PER_CARD) * 1000;
    const timeout = setTimeout(() => {
      setFlight(null);
      clear();
    }, totalDurationMs + 150);

    return () => clearTimeout(timeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [newAction]);

  return (
    <div
      ref={containerRef}
      className="pointer-events-none absolute inset-0 z-50"
    >
      <UtilsIf condition={!!flight}>
        {() => (
          <UtilsFor
            each={flight!.cards}
            eachKey={({ item }) => item.key}
          >
            {({ item }) => (
              <motion.div
                className="absolute top-0 left-0"
                initial={{ x: flight!.origin.x, y: flight!.origin.y, opacity: 0, scale: 0.6 }}
                animate={{
                  x: flight!.destination.x,
                  y: flight!.destination.y,
                  opacity: [0, 1, 1, 0],
                  scale: [0.6, 1, 1, 0.85],
                }}
                transition={{ duration: DURATION_PER_CARD, delay: item.delay, ease: 'easeInOut' }}
              >
                <Card
                  card={item.card}
                  size="md"
                />
              </motion.div>
            )}
          </UtilsFor>
        )}
      </UtilsIf>
    </div>
  );
}
