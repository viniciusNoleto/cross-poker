'use client';

import { useEffect } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { UtilsFor, nFor } from '@/components/utils/For';
import { Card } from './Card';
import { useAnimatedLastAction } from '../hooks/useAnimatedLastAction';
import { EActionType } from '../enums/EActionType';
import type { IGameState } from '../models/GameState';

// Same relative-seat mapping used in `app/games/[gameId]/page.tsx` and in
// `DiscardAnimation.tsx` (you always at the bottom, your partner always at the top,
// opponents on the sides — opposite seats are always team partners).
const SEAT_POSITIONS = ['bottom', 'left', 'top', 'right'] as const;
type SeatPosition = (typeof SEAT_POSITIONS)[number];

// Offset (in px, from the board's center) of each relative position — same values used in
// `DiscardAnimation.tsx` to keep the visual scale consistent across animation layers.
const POINT_BY_SEAT: Record<SeatPosition, { x: number; y: number }> = {
  bottom: { x: 0, y: 210 },
  left: { x: -260, y: 0 },
  top: { x: 0, y: -210 },
  right: { x: 260, y: 0 },
};

// Duration of the crossing itself (one batch of cards) and stagger between cards in the same
// batch, when `swap_quantity > 1`.
const DURATION_MS = 750;
const STAGGER_MS = 70;
// Lateral separation between the two card streams (initiator→partner and partner→initiator)
// so the simultaneous crossing stays visually legible instead of the cards overlapping.
const PERPENDICULAR_LANE_PX = 22;
// Fan spread of each batch: wider at the start, converging near the destination.
const ORIGIN_FAN_PX = 16;
const DESTINATION_FAN_PX = 6;

type Point = { x: number; y: number };

export type SwapAnimationProps = {
  state: IGameState;
};

// Animation of the MOMENT a Swap resolves (both partners have already chosen and the server
// executed the swap) — see game-concept.md, section "Troca" and "Animações". The pending-phase
// UI (who starts, who chooses, the "Troca em andamento..." banner) already exists in
// `PlaySwap.tsx` and isn't touched here. Since the swap's content is always secret (even between
// the two participants themselves), the animation never shows real values — always
// `<Card card={null} />`.
export function SwapAnimation({ state }: SwapAnimationProps) {
  const { newAction, clear } = useAnimatedLastAction(state.last_action);
  const you = state.you;

  const firing = newAction?.type === EActionType.SWAP && typeof newAction.partner_seat === 'number' && !!newAction.swap_quantity;
  const show = firing && !!newAction && !!you;

  useEffect(() => {
    if (!firing || !newAction) return;

    const quantity = newAction.swap_quantity ?? 0;
    const totalDurationMs = DURATION_MS + Math.max(0, quantity - 1) * STAGGER_MS + 100;

    const timer = setTimeout(() => clear(), totalDurationMs);

    return () => clearTimeout(timer);
  }, [firing, newAction, clear]);

  return (
    <div className="absolute inset-0 pointer-events-none z-30 overflow-visible">
      <AnimatePresence>
        {show && newAction && you && (
          <SwapContent
            newAction={newAction}
            yourSeat={you.seat}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

function SwapContent({ newAction, yourSeat }: {
  newAction: NonNullable<IGameState['last_action']>;
  yourSeat: number;
}) {
  const quantity = newAction.swap_quantity ?? 0;
  const relativeInitiator = (newAction.seat - yourSeat + 4) % 4;
  const relativePartner = (newAction.partner_seat! - yourSeat + 4) % 4;
  const initiatorPoint = POINT_BY_SEAT[SEAT_POSITIONS[relativeInitiator]];
  const partnerPoint = POINT_BY_SEAT[SEAT_POSITIONS[relativePartner]];
  const perpendicular = calculatePerpendicular(initiatorPoint, partnerPoint);

  // You receive the cards from the side whose destination is your own position — a subtle
  // highlight on the cards "arriving" at your hand (the content stays invisible, it's just a highlight).
  const youAreInitiator = newAction.seat === yourSeat;
  const youArePartner = newAction.partner_seat === yourSeat;

  return (
    <motion.div
      key={newAction.id}
      className="absolute inset-0"
      exit={{ opacity: 0 }}
      transition={{ duration: 0.15 }}
    >
      <SwapStrip
        actionId={newAction.id}
        prefix="initiator-to-partner"
        quantity={quantity}
        origin={initiatorPoint}
        destination={partnerPoint}
        perpendicular={perpendicular}
        side={1}
        highlight={youArePartner}
      />

      <SwapStrip
        actionId={newAction.id}
        prefix="partner-to-initiator"
        quantity={quantity}
        origin={partnerPoint}
        destination={initiatorPoint}
        perpendicular={perpendicular}
        side={-1}
        highlight={youAreInitiator}
      />
    </motion.div>
  );
}

// A stream of `quantity` face-down cards, leaving `origin` toward `destination`, offset
// laterally (`side` × `perpendicular`) so the two streams (there and back) stay in separate
// "lanes" and the simultaneous crossing is legible.
function SwapStrip({ actionId, prefix, quantity, origin, destination, perpendicular, side, highlight }: {
  actionId: number;
  prefix: string;
  quantity: number;
  origin: Point;
  destination: Point;
  perpendicular: Point;
  side: 1 | -1;
  highlight: boolean;
}) {
  return (
    <UtilsFor
      each={nFor(quantity)}
      eachKey={({ item }) => `${actionId}-${prefix}-${item}`}
    >
      {({ item: index }) => {
        const centered = index - (quantity - 1) / 2;
        const laneOffset = { x: perpendicular.x * side * PERPENDICULAR_LANE_PX, y: perpendicular.y * side * PERPENDICULAR_LANE_PX };
        const originFan = { x: perpendicular.x * centered * ORIGIN_FAN_PX, y: perpendicular.y * centered * ORIGIN_FAN_PX };
        const destinationFan = { x: perpendicular.x * centered * DESTINATION_FAN_PX, y: perpendicular.y * centered * DESTINATION_FAN_PX };

        return (
          <motion.div
            className="absolute left-1/2 top-1/2"
            initial={{
              x: origin.x + laneOffset.x + originFan.x,
              y: origin.y + laneOffset.y + originFan.y,
              opacity: 0,
              rotate: centered * 5,
              scale: 0.85,
            }}
            animate={{
              x: destination.x + laneOffset.x + destinationFan.x,
              y: destination.y + laneOffset.y + destinationFan.y,
              opacity: 1,
              rotate: centered * 2,
              scale: 1,
            }}
            exit={{ opacity: 0 }}
            transition={{
              duration: DURATION_MS / 1000,
              delay: (index * STAGGER_MS) / 1000,
              ease: 'easeInOut',
            }}
            style={{ translateX: '-50%', translateY: '-50%' }}
          >
            <Card
              card={null}
              size="md"
              className={highlight ? 'outline-[3px] outline-gold' : ''}
            />
          </motion.div>
        );
      }}
    </UtilsFor>
  );
}

// Unit vector perpendicular to the origin→destination segment, used to separate the two card
// streams into parallel "lanes" instead of overlapping.
function calculatePerpendicular(origin: Point, destination: Point) {
  const dx = destination.x - origin.x;
  const dy = destination.y - origin.y;
  const length = Math.hypot(dx, dy) || 1;

  return { x: -dy / length, y: dx / length };
}
