import { EDrawSource } from '../enums/EDrawSource';
import { shuffle } from './Deck';

// Shared card-draw structure, used by the Jogada (Meld) and Descarte (Discard) actions (never an
// independent turn action on its own — see game-concept.md, "Compra"). Pure function: no DB
// access, just transforms the received arrays and returns the new pile state.
//
// The three piles (all card ids, order = bottom→top, top = last element — use .pop()):
// - `deck` (Monte): drawable.
// - `discard` (Descarte): face-down discarded cards, drawable (LIFO).
// - `meldPile` (Bolo): face-up cards from Jogadas. NEVER drawable directly — it is only shuffled
//   back into a new Monte when the Monte runs out mid-draw.
export function drawCards(params: {
  deck: string[];
  discard: string[];
  meldPile: string[];
  quantity: number;
  source: `${EDrawSource}`;
}): {
  drawnCards: string[];
  newDeck: string[];
  newDiscard: string[];
  newMeldPile: string[];
} {
  const { quantity, source } = params;

  let deck = [...params.deck];
  const discard = [...params.discard];
  let meldPile = [...params.meldPile];
  const drawnCards: string[] = [];

  if (source === EDrawSource.DISCARD) {
    for (let i = 0; i < quantity; i++) {
      const card = discard.pop();

      if (!card) break;

      drawnCards.push(card);
    }

    return { drawnCards, newDeck: deck, newDiscard: discard, newMeldPile: meldPile };
  }

  for (let i = 0; i < quantity; i++) {
    if (deck.length === 0) {
      if (meldPile.length === 0) break;

      // Monte exhaustion: shuffle the whole Bolo into a new Monte. The Bolo becomes empty; the
      // Descarte is left alone (it stays a drawable pile on its own).
      deck = shuffle(meldPile);
      meldPile = [];
    }

    const card = deck.pop();

    if (!card) break;

    drawnCards.push(card);
  }

  return { drawnCards, newDeck: deck, newDiscard: discard, newMeldPile: meldPile };
}

// Whether each draw source can be chosen for a draw of `quantity` cards — same rule on the
// server (`libs/actionDraw.ts`, used by `POST .../meld` and `.../discard`) and on the client
// (`DrawSourcePicker.tsx`). The Descarte only counts
// if it alone has enough cards. The Monte counts with the Bolo behind it (reshuffle); if neither
// source has enough, the Monte is still allowed and delivers whatever exists (decision 5).
export function drawSourceAvailability({ deckCount, discardCount, meldPileCount, quantity }: {
  deckCount: number;
  discardCount: number;
  meldPileCount: number;
  quantity: number;
}) {
  const discard = discardCount >= quantity;
  const deck = (deckCount + meldPileCount) >= quantity || !discard;

  return { deck, discard };
}
