import { useMutation } from '@tanstack/react-query';
import { notifications } from '@mantine/notifications';
import { FormButton } from '@/components/form/Button';
import { resolveApiMessage } from '@/utils/apiMessage';
import { playDiscardService, PlayDiscardServicePayload } from '../services/playDiscard';

export function usePlayDiscardLogicData({ gameId, onSuccess }: { gameId: number; onSuccess: () => void }) {
  const playDiscardMutation = useMutation({
    mutationFn: (payload: PlayDiscardServicePayload) => playDiscardService({ gameId, body: payload }),
    onSuccess: () => {
      onSuccess();
    },
    onError: (err: any) => {
      notifications.show({
        title: 'Erro',
        message: err?.message ? resolveApiMessage(err.message, 'pt-br') : 'Não foi possível jogar o Bolo. Tente novamente.',
        color: 'red',
      });
    },
  });

  return {
    playDiscardMutation,
  };
}

// `selectedCards`: ids of the cards from your own hand currently selected on the game page.
// `canPlay`: whether it's the player's turn (`you.is_your_turn`) — the button is disabled otherwise.
// The draw-source choice (Deck/Discard) happens AFTER this discard, in a separate step
// — see `ChooseDrawSource.tsx` (game-concept.md, "Compra após a ação"). This button only submits the discard.
export function PlayDiscardLogicComponent({ logicData, selectedCards, canPlay }: { logicData: ReturnType<typeof usePlayDiscardLogicData>; selectedCards: string[]; canPlay: boolean }) {
  const {
    playDiscardMutation: {
      mutate: playDiscardMutate,
      isPending: playDiscardIsPending,
    },
  } = logicData;

  const quantityValid = selectedCards.length >= 1 && selectedCards.length <= 5;

  function playDiscard() {
    if (!quantityValid || playDiscardIsPending || !canPlay) return;

    playDiscardMutate({ cards: selectedCards });
  }

  return (
    <FormButton
      variant="white"
      color="dark"
      size="md"
      radius={0}
      className="min-w-[112px]"
      disabled={!canPlay || !quantityValid}
      loading={playDiscardIsPending}
      tooltip={!canPlay ? 'Aguarde sua vez' : (!quantityValid ? 'Selecione de 1 a 5 cartas' : undefined)}
      rightIcon="lucide:trash-2"
      onClick={playDiscard}
    >
      Bolo
    </FormButton>
  );
}
