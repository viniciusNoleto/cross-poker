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
        message: err?.message ? resolveApiMessage(err.message, 'pt-br') : 'Não foi possível fazer o Descarte. Tente novamente.',
        color: 'red',
      });
    },
  });

  return {
    playDiscardMutation,
  };
}

// "Descarte" action button. Like the Jogada, clicking it only opens the draw-source choice
// (`onChooseSource` → `DrawSourcePicker` on the page); discard + draw are then sent together in
// one request (`playDiscardMutation.mutate({ cards, source })`). See game-concept.md,
// "Compra junto com a ação".
// `selectedCards`: ids of the selected hand cards. `canPlay`: your turn and no pending Swap.
export function PlayDiscardLogicComponent({ selectedCards, canPlay, onChooseSource }: { selectedCards: string[]; canPlay: boolean; onChooseSource: () => void }) {
  const quantityValid = selectedCards.length >= 1 && selectedCards.length <= 5;

  return (
    <FormButton
      variant="white"
      color="dark"
      size="md"
      className="min-w-[112px]"
      disabled={!canPlay || !quantityValid}
      tooltip={!canPlay ? 'Aguarde sua vez' : (!quantityValid ? 'Selecione de 1 a 5 cartas' : undefined)}
      rightIcon="lucide:trash-2"
      onClick={() => {
        if (canPlay && quantityValid) onChooseSource();
      }}
    >
      Descarte
    </FormButton>
  );
}
