import { useMutation } from '@tanstack/react-query';
import { notifications } from '@mantine/notifications';
import { ActionButton, CountChip } from '../components/ActionButton';
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
// `remaining`: Descartes left (shown on the button's chip).
export function PlayDiscardLogicComponent({ selectedCards, canPlay, remaining, onChooseSource }: { selectedCards: string[]; canPlay: boolean; remaining: number; onChooseSource: () => void }) {
  const quantityValid = selectedCards.length >= 1 && selectedCards.length <= 5;
  const enabled = canPlay && quantityValid && remaining > 0;

  return (
    <ActionButton
      label="Descarte"
      tone="red"
      badge={(
        <CountChip
          count={remaining}
          textClassName="text-paper"
        />
      )}
      disabled={!enabled}
      tooltip={remaining === 0 ? 'Você não tem mais Descartes' : (!canPlay ? 'Aguarde sua vez' : (!quantityValid ? 'Selecione de 1 a 5 cartas' : undefined))}
      onClick={() => {
        if (enabled) onChooseSource();
      }}
    />
  );
}
