'use client';

import { UtilsIf } from '@/components/utils/If';
import { MeldScoreAnimation } from './MeldScoreAnimation';
import { useAnimatedLastAction } from '../hooks/useAnimatedLastAction';
import { EActionType } from '../enums/EActionType';
import type { Point } from './MeldScoreAnimation';
import type { IGameState } from '../models/GameState';

// Same relative-position mapping used in `app/games/[gameId]/page.tsx` and the other
// animation layers (`DiscardAnimation.tsx`, `SwapAnimation.tsx`).
const SEAT_POSITIONS = ['bottom', 'left', 'top', 'right'] as const;

// Same offsets used in `DiscardAnimation.tsx`/`SwapAnimation.tsx`, so the played cards fly
// from the same visual point as the seat of whoever played.
const ORIGIN_BY_SEAT: Record<(typeof SEAT_POSITIONS)[number], Point> = {
  bottom: { x: 0, y: 210 },
  left: { x: -260, y: 0 },
  top: { x: 0, y: -210 },
  right: { x: 260, y: 0 },
};

export type MeldScoreAnimationLayerProps = {
  state: IGameState;
  // Called with the `last_action.id` once its score count finished playing — the page holds the
  // Jogada's points out of the scoreboard until then (see `displayedPlayers` in the game page).
  onScoreCounted?: (actionId: number) => void;
};

/**
 * Meld score animation for EVERY player, the author included, fed only by `last_action`
 * (always public for Jogadas — see game-concept.md, "Feed de última ação"). A Jogada and its
 * draw are a single request, so `last_action` only appears once the play is complete — and
 * reaches everyone through the same SSE event, so all four players see the count together.
 */
export function MeldScoreAnimationLayer({ state, onScoreCounted }: MeldScoreAnimationLayerProps) {
  const { newAction, clear } = useAnimatedLastAction(state.last_action);
  const you = state.you;

  const player = newAction ? state.players.find((p) => p.seat === newAction.seat) : undefined;

  const firing = !!newAction
    && !!you
    && newAction.type === EActionType.MELD
    && !!newAction.combo
    && !!newAction.melded_cards
    && !!newAction.scoring_cards
    && typeof newAction.chips === 'number'
    && typeof newAction.multiplier === 'number'
    && typeof newAction.points === 'number';

  const isYou = firing && newAction!.seat === you!.seat;
  const relative = firing ? (newAction!.seat - you!.seat + 4) % 4 : 0;
  const origin = ORIGIN_BY_SEAT[SEAT_POSITIONS[relative]];

  function finish() {
    if (newAction) onScoreCounted?.(newAction.id);

    clear();
  }

  return (
    <UtilsIf condition={firing}>
      {() => (
        <MeldScoreAnimation
          combo={newAction!.combo!}
          meldedCards={newAction!.melded_cards!}
          scoringCards={newAction!.scoring_cards!}
          chips={newAction!.chips!}
          multiplier={newAction!.multiplier!}
          points={newAction!.points!}
          origin={origin}
          label={isYou ? undefined : player?.name}
          bigScoreSound={isYou}
          onFinish={finish}
        />
      )}
    </UtilsIf>
  );
}
