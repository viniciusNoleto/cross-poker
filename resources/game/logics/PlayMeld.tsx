'use client';

import { useMutation } from '@tanstack/react-query';
import { notifications } from '@mantine/notifications';
import { FormButton } from '@/components/form/Button';
import { resolveApiMessage } from '@/utils/apiMessage';
import { playMeldService, PlayMeldServiceResponse } from '../services/playMeld';

export function usePlayMeldLogicData({ gameId, onSuccess }: { gameId: number; onSuccess: (result: PlayMeldServiceResponse) => void }) {
  const playMeldMutation = useMutation({
    mutationFn: (cards: string[]) => playMeldService({
      gameId,
      body: { cards },
    }),
    onSuccess: (res) => {
      onSuccess(res.data);
    },
    onError: (err: any) => {
      notifications.show({
        title: 'Erro',
        message: err?.message ? resolveApiMessage(err.message, 'pt-br') : 'Não foi possível jogar a Mesa. Tente novamente.',
        color: 'red',
      });
    },
  });

  return {
    playMeldMutation,
  };
}

/**
 * "Play Meld" action — replaces the disabled `FormButton` "Jogar Mesa" in
 * `app/games/[gameId]/page.tsx`.
 *
 * Props:
 * - `logicData`: return of `usePlayMeldLogicData({ gameId, onSuccess })`. `onSuccess` receives the
 *   play result (`{ points_scored, combo, melded_cards, scoring_cards, chips,
 *   multiplier }`) — use it to clear the selection (e.g. `setSelectedCards([])`) and store the
 *   result in local state to display in `MeldScoreAnimationSelf` (see
 *   `resources/game/components/MeldScoreAnimationSelf.tsx`). The game snapshot is already
 *   refetched automatically via SSE after the play, no manual refetch needed.
 * - `selectedCards`: ids of the cards currently selected in the player's hand (the existing
 *   `selectedCards: string[]` state on the page) — must have between 1 and 5 items.
 * - `disabled`: pass the same condition used by the other action buttons (`!you?.is_your_turn`);
 *   the route also validates server-side (turn, Melds remaining, pending Swap/Draw, etc.).
 *
 * The draw-source choice (Deck/Discard) happens AFTER this play, in a separate step
 * — see `ChooseDrawSource.tsx` (game-concept.md, "Compra após a ação"). This button only submits
 * the play itself.
 */
export function PlayMeldLogicComponent({ logicData, selectedCards, disabled }: {
  logicData: ReturnType<typeof usePlayMeldLogicData>;
  selectedCards: string[];
  disabled?: boolean;
}) {
  const {
    playMeldMutation: {
      mutate: playMeldMutate,
      isPending: playMeldIsPending,
    },
  } = logicData;

  const canPlay = selectedCards.length >= 1 && selectedCards.length <= 5 && !disabled;

  function playMeld() {
    if (!canPlay) return;

    playMeldMutate(selectedCards);
  }

  return (
    <FormButton
      color="secondary"
      size="md"
      radius={0}
      className="min-w-[112px]"
      disabled={!canPlay}
      loading={playMeldIsPending}
      tooltip={selectedCards.length === 0 ? 'Selecione de 1 a 5 cartas' : undefined}
      rightIcon="lucide:hand"
      onClick={playMeld}
    >
      Mesa
    </FormButton>
  );
}
