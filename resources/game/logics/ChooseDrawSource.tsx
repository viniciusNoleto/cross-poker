import { useMutation } from '@tanstack/react-query';
import { notifications } from '@mantine/notifications';
import { FormButton } from '@/components/form/Button';
import { resolveApiMessage } from '@/utils/apiMessage';
import { chooseDrawSourceService } from '../services/chooseDrawSource';
import { EDrawSource } from '../enums/EDrawSource';
import { IGameState } from '../models/GameState';

// Phase 2 of Meld/Discard — after playing the Meld or discarding, the player chooses where
// the draw comes from (Deck or Discard). See game-concept.md, "Compra após a ação".
export function useChooseDrawSourceLogicData({ gameId, onSuccess }: { gameId: number; onSuccess: () => void }) {
  const chooseDrawSourceMutation = useMutation({
    mutationFn: (source: `${EDrawSource}`) => chooseDrawSourceService({ gameId, body: { source } }),
    onSuccess: () => {
      onSuccess();
    },
    onError: (err: any) => {
      notifications.show({
        title: 'Erro',
        message: err?.message ? resolveApiMessage(err.message, 'pt-br') : 'Não foi possível confirmar a origem da compra. Tente novamente.',
        color: 'red',
      });
    },
  });

  return {
    chooseDrawSourceMutation,
  };
}

// Only renders something when `state.you.needs_to_choose_draw` is true — i.e. when there is
// a Meld/Discard pending a draw and it's you who needs to choose the source. Each button is
// disabled when the corresponding source doesn't have enough cards for the pending `quantity`
// (same rule enforced server-side, see `POST /api/games/[gameId]/draw`):
// Discard requires `discard.length >= quantity`; Deck requires `deck_count + discard.length >= quantity`.
export function ChooseDrawSourceLogicComponent({ state, logicData }: {
  state: IGameState;
  logicData: ReturnType<typeof useChooseDrawSourceLogicData>;
}) {
  const { pending_draw: pendingDraw, you } = state;

  const {
    chooseDrawSourceMutation: {
      mutate: chooseDrawSource,
      isPending: chooseDrawSourceIsPending,
      variables: chooseDrawSourceVariables,
    },
  } = logicData;

  if (!pendingDraw || !you?.needs_to_choose_draw) return null;

  const { quantity } = pendingDraw;
  const discardHasEnough = state.discard.length >= quantity;
  const deckHasEnough = (state.deck_count + state.discard.length) >= quantity;

  return (
    <div className="flex flex-col items-center gap-2 bg-black/30 backdrop-blur-sm rounded-lg px-4 py-2 border border-secondary-400/40">
      <span className="text-white text-sm">
        {`Escolha de onde comprar ${quantity} carta(s)`}
      </span>

      <div className="flex items-center gap-2">
        <FormButton
          color="primary"
          disabled={!deckHasEnough || chooseDrawSourceIsPending}
          loading={chooseDrawSourceIsPending && chooseDrawSourceVariables === EDrawSource.DECK}
          tooltip={!deckHasEnough ? 'O Monte e o Bolo juntos não têm cartas suficientes para esta compra' : undefined}
          rightIcon="lucide:layers"
          onClick={() => chooseDrawSource(EDrawSource.DECK)}
        >
          Comprar do Monte
        </FormButton>

        <FormButton
          color="secondary"
          disabled={!discardHasEnough || chooseDrawSourceIsPending}
          loading={chooseDrawSourceIsPending && chooseDrawSourceVariables === EDrawSource.DISCARD}
          tooltip={!discardHasEnough ? 'O Bolo não tem cartas suficientes para esta compra' : undefined}
          rightIcon="lucide:layers"
          onClick={() => chooseDrawSource(EDrawSource.DISCARD)}
        >
          Comprar do Bolo
        </FormButton>
      </div>
    </div>
  );
}
