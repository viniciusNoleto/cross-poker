'use client';

import { ActionButton, CardsGlyph } from './ActionButton';
import { EDrawSource } from '../enums/EDrawSource';
import { EActionType } from '../enums/EActionType';
import { drawSourceAvailability } from '../models/Draw';
import type { IGameState } from '../models/GameState';

const ACTION_LABEL: Record<EActionType.MELD | EActionType.DISCARD, string> = {
  [EActionType.MELD]: 'Jogada',
  [EActionType.DISCARD]: 'Descarte',
};

/**
 * Second half of the Jogada/Descarte button: after picking the cards and clicking the action,
 * the player picks where the replacement cards come from (Monte or Descarte — never the Bolo).
 * Nothing is sent before this choice: the action + draw go in a SINGLE request (see
 * game-concept.md, "Compra junto com a ação"). Each source is disabled when it can't cover
 * `quantity` cards — same rule the server enforces (`drawSourceAvailability`, `Draw.ts`).
 */
export function DrawSourcePicker({ state, actionType, quantity, pendingSource, onPick, onCancel }: {
  state: IGameState;
  actionType: EActionType.MELD | EActionType.DISCARD;
  quantity: number;
  // Source of the request in flight (shows the loader on that button and locks the others).
  pendingSource: `${EDrawSource}` | null;
  onPick: (source: `${EDrawSource}`) => void;
  onCancel: () => void;
}) {
  const { deck: deckHasEnough, discard: discardHasEnough } = drawSourceAvailability({
    deckCount: state.deck_count,
    discardCount: state.discard_count,
    meldPileCount: state.meld_pile.length,
    quantity,
  });

  const busy = pendingSource !== null;

  return (
    <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-2">
      <span className="text-gold text-sm font-bold">
        {`${ACTION_LABEL[actionType]} · comprar ${quantity} carta(s) de:`}
      </span>

      <div className="flex items-center gap-3">
        <ActionButton
          label="Monte"
          tone="paper"
          size="md"
          badge={<CardsGlyph variant="stack" />}
          disabled={!deckHasEnough || (busy && pendingSource !== EDrawSource.DECK)}
          loading={pendingSource === EDrawSource.DECK}
          tooltip={!deckHasEnough ? 'O Monte (mesmo reembaralhando o Bolo) não tem cartas suficientes para esta compra' : undefined}
          onClick={() => onPick(EDrawSource.DECK)}
        />

        <ActionButton
          label="Descarte"
          tone="red"
          size="md"
          badge={<CardsGlyph variant="stack" />}
          disabled={!discardHasEnough || (busy && pendingSource !== EDrawSource.DISCARD)}
          loading={pendingSource === EDrawSource.DISCARD}
          tooltip={!discardHasEnough ? 'O Descarte não tem cartas suficientes para esta compra' : undefined}
          onClick={() => onPick(EDrawSource.DISCARD)}
        />

        <ActionButton
          label="Cancelar"
          tone="felt"
          size="md"
          disabled={busy}
          onClick={onCancel}
        />
      </div>
    </div>
  );
}
