'use client';

import { useMutation } from '@tanstack/react-query';
import { notifications } from '@mantine/notifications';
import { FormButton } from '@/components/form/Button';
import { resolveApiMessage } from '@/utils/apiMessage';
import { playMeldService, PlayMeldServicePayload } from '../services/playMeld';

export function usePlayMeldLogicData({ gameId, onSuccess }: { gameId: number; onSuccess: () => void }) {
  const playMeldMutation = useMutation({
    mutationFn: (payload: PlayMeldServicePayload) => playMeldService({ gameId, body: payload }),
    onSuccess: () => {
      onSuccess();
    },
    onError: (err: any) => {
      notifications.show({
        title: 'Erro',
        message: err?.message ? resolveApiMessage(err.message, 'pt-br') : 'Não foi possível fazer a Jogada. Tente novamente.',
        color: 'red',
      });
    },
  });

  return {
    playMeldMutation,
  };
}

/**
 * "Jogada" (Meld) action button, used in `app/games/[gameId]/page.tsx`.
 *
 * Clicking it does NOT send anything yet: it calls `onChooseSource`, and the page swaps the
 * action buttons for `DrawSourcePicker` (`resources/game/components/DrawSourcePicker.tsx`). Only
 * after the source is picked does the page call `playMeldMutation.mutate({ cards, source })` —
 * play + draw in a single request, so the score (and its animation, via `last_action`) shows up
 * for every player at the same time. See game-concept.md, "Compra junto com a ação".
 *
 * - `selectedCards`: ids of the cards selected in the hand — 1 to 5.
 * - `disabled`: not your turn / pending Swap; the route validates everything again server-side.
 */
export function PlayMeldLogicComponent({ selectedCards, disabled, onChooseSource }: {
  selectedCards: string[];
  disabled?: boolean;
  onChooseSource: () => void;
}) {
  const canPlay = selectedCards.length >= 1 && selectedCards.length <= 5 && !disabled;

  return (
    <FormButton
      color="secondary"
      size="md"
      className="min-w-[112px]"
      disabled={!canPlay}
      tooltip={selectedCards.length === 0 ? 'Selecione de 1 a 5 cartas' : undefined}
      rightIcon="lucide:hand"
      onClick={() => {
        if (canPlay) onChooseSource();
      }}
    >
      Jogada
    </FormButton>
  );
}
