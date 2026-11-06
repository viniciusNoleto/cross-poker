import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { notifications } from '@mantine/notifications';
import { FormButton } from '@/components/form/Button';
import { FormNumberInput } from '@/components/form/Number';
import { UtilsIf } from '@/components/utils/If';
import { resolveApiMessage } from '@/utils/apiMessage';
import { startSwapService } from '../services/startSwap';
import { chooseSwapService } from '../services/chooseSwap';
import { IGameState } from '../models/GameState';

const MIN_QUANTITY = 1;
const MAX_QUANTITY = 5;

// Phase 1 — the current-turn player declares how many cards they want to swap with their
// partner (opposite seat) and starts the Swap. Replaces a Discard action — there's no draw
// afterwards (see game-concept.md).
export function useStartSwapLogicData({ gameId, onSuccess }: { gameId: number; onSuccess: () => void }) {
  const [startSwapOpen, setStartSwapOpen] = useState(false);
  const [startSwapQuantity, setStartSwapQuantity] = useState(MIN_QUANTITY);

  const startSwapMutation = useMutation({
    mutationFn: () => startSwapService({ gameId, body: { quantity: startSwapQuantity } }),
    onSuccess: () => {
      setStartSwapOpen(false);
      setStartSwapQuantity(MIN_QUANTITY);

      onSuccess();
    },
    onError: (err: any) => {
      notifications.show({
        title: 'Erro',
        message: err?.message ? resolveApiMessage(err.message, 'pt-br') : 'Não foi possível iniciar a troca. Tente novamente.',
        color: 'red',
      });
    },
  });

  return {
    startSwapOpen,
    setStartSwapOpen,
    startSwapQuantity,
    setStartSwapQuantity,
    startSwapMutation,
  };
}

export function StartSwapLogicComponent({ logicData, disabled }: { logicData: ReturnType<typeof useStartSwapLogicData>; disabled: boolean }) {
  const {
    startSwapOpen,
    setStartSwapOpen,
    startSwapQuantity,
    setStartSwapQuantity,
    startSwapMutation: {
      mutate: startSwap,
      isPending: startSwapIsPending,
    },
  } = logicData;

  return (
    <UtilsIf
      cases={[
        {
          condition: startSwapOpen,
          content: () => (
            <div className="flex items-center gap-2 bg-felt-night px-3 py-1.5">
              <span className="text-paper text-sm whitespace-nowrap">
                Trocar quantas cartas?
              </span>

              <FormNumberInput
                value={startSwapQuantity}
                onChange={(value) => setStartSwapQuantity(Math.min(MAX_QUANTITY, Math.max(MIN_QUANTITY, Number(value) || MIN_QUANTITY)))}
                min={MIN_QUANTITY}
                max={MAX_QUANTITY}
                size="sm"
                radius={0}
                className="w-16"
                disabled={startSwapIsPending}
              />

              <FormButton
                size="sm"
                radius={0}
                variant="subtle"
                color="gray.0"
                disabled={startSwapIsPending}
                onClick={() => setStartSwapOpen(false)}
              >
                Cancelar
              </FormButton>

              <FormButton
                size="sm"
                radius={0}
                color="tertiary"
                loading={startSwapIsPending}
                rightIcon="lucide:repeat"
                onClick={() => startSwap()}
              >
                Confirmar
              </FormButton>
            </div>
          ),
        },
        {
          content: () => (
            <FormButton
              variant="filled"
              color="tertiary"
              size="md"
              radius={0}
              className="min-w-[112px]"
              disabled={disabled}
              rightIcon="lucide:repeat"
              onClick={() => setStartSwapOpen(true)}
            >
              Troca
            </FormButton>
          ),
        },
      ]}
    />
  );
}

// Phase 2 — any Swap participant (initiator OR partner, even outside their own turn) secretly
// chooses the cards they're offering. Reuses the page's own `selectedCards` state (the same
// selection used by the player's hand) instead of a parallel state.
export function useChooseSwapLogicData({ gameId, onSuccess }: { gameId: number; onSuccess: () => void }) {
  const chooseSwapMutation = useMutation({
    mutationFn: (cards: string[]) => chooseSwapService({ gameId, body: { cards } }),
    onSuccess: (res) => {
      onSuccess();

      notifications.show({
        message: res.data.waiting_for_partner
          ? 'Cartas escolhidas. Aguardando seu parceiro confirmar a troca...'
          : 'Troca concluída!',
        color: res.data.waiting_for_partner ? 'blue' : 'green',
      });
    },
    onError: (err: any) => {
      notifications.show({
        title: 'Erro',
        message: err?.message ? resolveApiMessage(err.message, 'pt-br') : 'Não foi possível confirmar a troca. Tente novamente.',
        color: 'red',
      });
    },
  });

  return {
    chooseSwapMutation,
  };
}

export function ChooseSwapLogicComponent({ state, selectedCards, setSelectedCards, logicData }: {
  state: IGameState;
  selectedCards: string[];
  setSelectedCards: (value: string[]) => void;
  logicData: ReturnType<typeof useChooseSwapLogicData>;
}) {
  const { pending_swap: pendingSwap, you } = state;

  const {
    chooseSwapMutation: {
      mutate: chooseSwap,
      isPending: chooseSwapIsPending,
    },
  } = logicData;

  if (!pendingSwap || !you) return null;

  const isInitiator = pendingSwap.initiator_seat === you.seat;
  const isPartner = pendingSwap.partner_seat === you.seat;

  if (!isInitiator && !isPartner) return null;

  const iAlreadyChose = isInitiator ? pendingSwap.initiator_ready : pendingSwap.partner_ready;

  function confirmSwapChoice() {
    chooseSwap(selectedCards, {
      onSuccess: () => setSelectedCards([]),
    });
  }

  return (
    <div className="flex flex-wrap items-center justify-center gap-2">
      <UtilsIf
        cases={[
          {
            condition: iAlreadyChose,
            content: () => (
              <span className="text-paper/85 text-sm">
                Aguardando seu parceiro escolher as cartas da troca...
              </span>
            ),
          },
          {
            content: () => (
              <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-2">
                <span className="text-gold text-sm font-bold">
                  {`Escolha ${pendingSwap.quantity} carta(s) da sua mão para a troca (${selectedCards.length}/${pendingSwap.quantity})`}
                </span>

                <FormButton
                  color="secondary"
                  radius={0}
                  loading={chooseSwapIsPending}
                  disabled={selectedCards.length !== pendingSwap.quantity}
                  rightIcon="lucide:repeat"
                  onClick={confirmSwapChoice}
                >
                  Confirmar troca
                </FormButton>
              </div>
            ),
          },
        ]}
      />
    </div>
  );
}

export function PendingSwapBanner({ state }: { state: IGameState }) {
  const { pending_swap: pendingSwap, players } = state;

  if (!pendingSwap) return null;

  const initiator = players.find((player) => player.seat === pendingSwap.initiator_seat);
  const partner = players.find((player) => player.seat === pendingSwap.partner_seat);

  return (
    <span className="px-4 py-1.5 bg-felt-night text-paper/85 text-sm">
      {`Troca em andamento entre ${initiator?.name ?? '—'} e ${partner?.name ?? '—'}...`}
    </span>
  );
}
