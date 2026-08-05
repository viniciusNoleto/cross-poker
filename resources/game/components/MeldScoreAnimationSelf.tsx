'use client';

import { UtilsIf } from '@/components/utils/If';
import { MeldScoreAnimation } from './MeldScoreAnimation';
import type { PlayMeldServiceResponse } from '../services/playMeld';

// You always play your Meld from your own hand, always rendered at the bottom of the
// screen (relative position "bottom" — see `app/games/[gameId]/page.tsx`) — same offset
// used for that position in the other animation layers (`DiscardAnimation.tsx`).
const ORIGIN = { x: 0, y: 210 };

/**
 * View for the AUTHOR of a Meld play: same `MeldScoreAnimation` engine used by
 * `MeldScoreAnimationObservers.tsx` — the animation is identical for everyone (see
 * game-concept.md, "Animações"). The only difference is the data source: here it comes from
 * the direct return of `POST .../meld` (`result`, filled in `app/games/[gameId]/page.tsx` in
 * the `onSuccess` of `usePlayMeldLogicData`), which arrives before `last_action` exists — see
 * "Compra após a ação" in game-concept.md.
 */
export function MeldScoreAnimationSelf({ result, onFinish }: {
  result: PlayMeldServiceResponse | null;
  onFinish: () => void;
}) {
  return (
    <UtilsIf condition={!!result}>
      {() => (
        <MeldScoreAnimation
          combo={result!.combo}
          meldedCards={result!.melded_cards}
          scoringCards={result!.scoring_cards}
          chips={result!.chips}
          multiplier={result!.multiplier}
          points={result!.points_scored}
          origin={ORIGIN}
          onFinish={onFinish}
        />
      )}
    </UtilsIf>
  );
}
