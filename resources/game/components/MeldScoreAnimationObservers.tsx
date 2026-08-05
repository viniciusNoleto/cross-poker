'use client';

import { UtilsIf } from '@/components/utils/If';
import { MeldScoreAnimation } from './MeldScoreAnimation';
import { useAnimatedLastAction } from '../hooks/useAnimatedLastAction';
import { EActionType } from '../enums/EActionType';
import type { Point } from './MeldScoreAnimation';
import type { IGameState } from '../models/GameState';

// Same relative-position mapping used in `app/games/[gameId]/page.tsx` and the other
// animation layers (`DiscardAnimation.tsx`, `SwapAnimation.tsx`) — repeated here because
// this component can't import from `page.tsx` nor edit it (see game-concept.md, "Animações").
const SEAT_POSITIONS = ['bottom', 'left', 'top', 'right'] as const;

// Same offsets used in `DiscardAnimation.tsx`/`SwapAnimation.tsx`, so the played cards fly
// from the same visual point as the seat of whoever played.
const ORIGIN_BY_SEAT: Record<(typeof SEAT_POSITIONS)[number], Point> = {
  bottom: { x: 0, y: 210 },
  left: { x: -260, y: 0 },
  top: { x: 0, y: -210 },
  right: { x: 260, y: 0 },
};

export type MeldScoreAnimationObserversProps = {
  state: IGameState;
};

/**
 * View for the OTHER players when someone plays a Meld: reuses the same
 * `MeldScoreAnimation` engine, fed by `last_action` (always public for Meld plays —
 * see game-concept.md, "Feed de última ação"). The author of the play already sees the result
 * faster via `MeldScoreAnimationSelf.tsx` (direct return of `POST .../meld`), so this layer
 * ignores itself when `newAction.seat` is you — but the visual shown is the SAME engine, with
 * the SAME behavior, for both cases.
 */
export function MeldScoreAnimationObservers({ state }: MeldScoreAnimationObserversProps) {
  const { newAction, clear } = useAnimatedLastAction(state.last_action);
  const you = state.you;

  const player = newAction ? state.players.find((p) => p.seat === newAction.seat) : undefined;

  const firing = !!newAction
    && !!you
    && newAction.seat !== you.seat
    && newAction.type === EActionType.MELD
    && !!newAction.combo
    && !!newAction.melded_cards
    && !!newAction.scoring_cards
    && typeof newAction.chips === 'number'
    && typeof newAction.multiplier === 'number'
    && typeof newAction.points === 'number';

  const relative = firing ? (newAction!.seat - you!.seat + 4) % 4 : 0;
  const origin = ORIGIN_BY_SEAT[SEAT_POSITIONS[relative]];

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
          label={player?.name}
          onFinish={clear}
        />
      )}
    </UtilsIf>
  );
}
