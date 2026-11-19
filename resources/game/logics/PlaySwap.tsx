import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { notifications } from '@mantine/notifications';
import { sounds } from '@/utils/sound';
import { FormNumberInput } from '@/components/form/Number';
import { UtilsIf } from '@/components/utils/If';
import { nFor, UtilsFor } from '@/components/utils/For';
import { Form } from '@/components/form/Form';
import { Modal } from '@mantine/core';
import { Icon } from '@iconify/react';
import { motion } from 'motion/react';
import { Card } from '../components/Card';
import { ActionButton, CardsGlyph } from '../components/ActionButton';
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
      sounds.swapDeal();
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

// Face-down cards representing how many cards one side of the Swap is giving. All MAX_QUANTITY
// slots are always mounted and only the first `quantity` are shown, so each card pops in / out as
// the quantity changes and the number in the input reads as a physical pile of cards.
function SwapQuantityCards({ quantity, owner }: { quantity: number; owner: 'you' | 'partner' }) {
  const offsetY = owner === 'partner' ? -24 : 24;

  return (
    <div className="flex items-center justify-center min-h-23.75">
      <UtilsFor each={nFor(MAX_QUANTITY)}>
        {({ item }) => (
          <motion.div
            initial={false}
            animate={item < quantity
              ? { width: 'auto', opacity: 1, y: 0, scale: 1, rotate: (item - (quantity - 1) / 2) * 4 }
              : { width: 0, opacity: 0, y: offsetY, scale: 0.6, rotate: 0 }}
            transition={{ type: 'spring', stiffness: 420, damping: 30 }}
            className="flex justify-center"
          >
            <div className="px-1">
              <Card
                card={null}
                size="lg"
              />
            </div>
          </motion.div>
        )}
      </UtilsFor>
    </div>
  );
}

export function StartSwapLogicComponent({ logicData, disabled, partnerName }: { logicData: ReturnType<typeof useStartSwapLogicData>; disabled: boolean; partnerName?: string }) {
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

  function closeStartSwap() {
    if (startSwapIsPending) return;

    setStartSwapOpen(false);
    setStartSwapQuantity(MIN_QUANTITY);
  }

  function changeStartSwapQuantity(value: number) {
    const quantity = Math.min(MAX_QUANTITY, Math.max(MIN_QUANTITY, Number(value) || MIN_QUANTITY));

    if (quantity > startSwapQuantity) sounds.swapCardAppear(quantity);
    else if (quantity < startSwapQuantity) sounds.swapCardVanish(quantity);

    setStartSwapQuantity(quantity);
  }

  return (
    <>
      <ActionButton
        label="Troca"
        tone="paper"
        badge={<CardsGlyph variant="crossed" />}
        disabled={disabled}
        tooltip={!disabled && partnerName ? `Trocar cartas em segredo com ${partnerName}` : undefined}
        onClick={() => {
          sounds.chooseSwap();
          setStartSwapOpen(true);
        }}
      />

      {/* Same look as the Bolo modal: felt with the wooden rim. Partner's cards on top, the
          quantity in the middle, your cards at the bottom — both sides give the same amount. */}
      <Modal
        opened={startSwapOpen}
        onClose={closeStartSwap}
        title="Troca"
        size="lg"
        radius={24}
        centered
        withCloseButton={false}
        classNames={{
          content: 'felt-surface! border-10 md:border-14 border-[#3a2414] shadow-[0_24px_60px_-20px_rgba(0,0,0,0.8)]',
          header: 'bg-transparent! justify-center pt-5! pb-0!',
          title: 'font-display italic text-gold text-[26px] leading-none',
          body: 'pb-6!',
        }}
      >
        <Form
          onSubmit={() => startSwap()}
          className="flex flex-col items-center gap-4 pt-2"
        >
          <span className="text-paper/70 text-xs uppercase tracking-[0.12em]">
            {partnerName ? `${partnerName} entrega` : 'Seu aliado entrega'}
          </span>

          <SwapQuantityCards
            quantity={startSwapQuantity}
            owner="partner"
          />

          <div className="flex flex-col items-center gap-2 py-1">
            <div className="flex items-center gap-3">
              <Icon
                icon="lucide:arrow-up-down"
                className="w-5 h-5 text-gold"
              />

              <FormNumberInput
                value={startSwapQuantity}
                onChange={changeStartSwapQuantity}
                min={MIN_QUANTITY}
                max={MAX_QUANTITY}
                clampBehavior="strict"
                allowDecimal={false}
                size="md"
                radius={6}
                className="w-24"
                classNames={{ input: 'text-center! font-display! text-xl! font-medium!' }}
                disabled={startSwapIsPending}
                data-autofocus
              />

              <Icon
                icon="lucide:arrow-up-down"
                className="w-5 h-5 text-gold"
              />
            </div>

            <span className="text-paper/85 text-sm text-center">
              {`Cada um escolhe ${startSwapQuantity} carta(s) em segredo para trocar.`}
            </span>
          </div>

          <SwapQuantityCards
            quantity={startSwapQuantity}
            owner="you"
          />

          <span className="text-paper/70 text-xs uppercase tracking-[0.12em]">
            Você entrega
          </span>

          <div className="flex items-center justify-center gap-3 pt-2">
            <ActionButton
              label="Cancelar"
              tone="felt"
              size="md"
              disabled={startSwapIsPending}
              onClick={closeStartSwap}
            />

            <ActionButton
              type="submit"
              label="Confirmar"
              tone="paper"
              size="md"
              badge={<CardsGlyph variant="crossed" />}
              loading={startSwapIsPending}
            />
          </div>
        </Form>
      </Modal>
    </>
  );
}

// Phase 2 — any Swap participant (initiator OR partner, even outside their own turn) secretly
// chooses the cards they're offering. Reuses the page's own `selectedCards` state (the same
// selection used by the player's hand) instead of a parallel state.
export function useChooseSwapLogicData({ gameId, onSuccess }: { gameId: number; onSuccess: () => void }) {
  const chooseSwapMutation = useMutation({
    mutationFn: (cards: string[]) => chooseSwapService({ gameId, body: { cards } }),
    onSuccess: (res) => {
      sounds.swapDeal();

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

                <ActionButton
                  label="Confirmar troca"
                  tone="paper"
                  size="md"
                  badge={<CardsGlyph variant="crossed" />}
                  loading={chooseSwapIsPending}
                  disabled={selectedCards.length !== pendingSwap.quantity}
                  onClick={confirmSwapChoice}
                />
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
