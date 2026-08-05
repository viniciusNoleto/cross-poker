import { EDrawSource } from '../enums/EDrawSource';
import { shuffle } from './Deck';

export type IDiscardPileEntry = { card_id: string; face_up: boolean };

// Shared card-draw structure, used by the Meld and Discard actions (never an independent turn
// action on its own — see game-concept.md, section "Compra de Cartas"). Pure function:
// no DB access, just transforms the received arrays and returns the new pile state.
export function drawCards(params: {
  deck: string[]; // card ids, order = bottom→top (top = last element — use .pop())
  discard: IDiscardPileEntry[]; // order = bottom→top (top = last element — use .pop())
  quantity: number;
  source: `${EDrawSource}`;
}): {
  drawnCards: string[];
  newDeck: string[];
  newDiscard: IDiscardPileEntry[];
} {
  const { quantity, source } = params;

  let deck = [...params.deck];
  let discard = [...params.discard];
  const drawnCards: string[] = [];

  if (source === EDrawSource.DISCARD) {
    for (let i = 0; i < quantity; i++) {
      const card = discard.pop();

      if (!card) break;

      drawnCards.push(card.card_id);
    }

    return { drawnCards, newDeck: deck, newDiscard: discard };
  }

  for (let i = 0; i < quantity; i++) {
    if (deck.length === 0) {
      if (discard.length === 0) break;

      // Deck exhaustion: shuffle all Discard cards (face up and face down, discarding the
      // face_up info) into a new Deck. The Discard pile becomes empty.
      deck = shuffle(discard.map((card) => card.card_id));
      discard = [];
    }

    const card = deck.pop();

    if (!card) break;

    drawnCards.push(card);
  }

  return { drawnCards, newDeck: deck, newDiscard: discard };
}
