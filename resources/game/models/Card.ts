import { ESuit } from '../enums/ESuit';
import { ERank } from '../enums/ERank';

export interface ICard {
  id: string; // e.g. "hearts-A-1" — identifies the physical card (suit-rank-deckNumber)
  suit: `${ESuit}`;
  rank: `${ERank}`;
}

export const CHIPS_BY_RANK: Record<`${ERank}`, number> = {
  [ERank.ACE]: 11,
  [ERank.KING]: 10,
  [ERank.QUEEN]: 10,
  [ERank.JACK]: 10,
  [ERank.TEN]: 10,
  [ERank.NINE]: 9,
  [ERank.EIGHT]: 8,
  [ERank.SEVEN]: 7,
  [ERank.SIX]: 6,
  [ERank.FIVE]: 5,
  [ERank.FOUR]: 4,
  [ERank.THREE]: 3,
  [ERank.TWO]: 2,
};

// High ordering (Jack > Queen > King > Ace) used to compare straights. The Ace can also
// complete the low straight A-2-3-4-5 (Balatro rule) — handle that separately in the Straight detector.
export const RANK_ORDER: Array<`${ERank}`> = [
  ERank.TWO,
  ERank.THREE,
  ERank.FOUR,
  ERank.FIVE,
  ERank.SIX,
  ERank.SEVEN,
  ERank.EIGHT,
  ERank.NINE,
  ERank.TEN,
  ERank.JACK,
  ERank.QUEEN,
  ERank.KING,
  ERank.ACE,
];

// Display order for suits when organizing the hand by suit (no in-game meaning).
export const SUIT_ORDER: Array<`${ESuit}`> = [
  ESuit.SPADES,
  ESuit.HEARTS,
  ESuit.CLUBS,
  ESuit.DIAMONDS,
];

export function chipsForCard(card: ICard): number {
  return CHIPS_BY_RANK[card.rank];
}

export function cardById(id: string): ICard {
  const [suit, rank] = id.split('-') as [`${ESuit}`, `${ERank}`];

  return { id, suit, rank };
}

export function sortCardsBySuit(cards: ICard[]): ICard[] {
  return [...cards].sort((a, b) => {
    const suitDiff = SUIT_ORDER.indexOf(a.suit) - SUIT_ORDER.indexOf(b.suit);

    if (suitDiff !== 0) return suitDiff;

    return RANK_ORDER.indexOf(a.rank) - RANK_ORDER.indexOf(b.rank);
  });
}

export function sortCardsByRank(cards: ICard[]): ICard[] {
  return [...cards].sort((a, b) => {
    const rankDiff = RANK_ORDER.indexOf(a.rank) - RANK_ORDER.indexOf(b.rank);

    if (rankDiff !== 0) return rankDiff;

    return SUIT_ORDER.indexOf(a.suit) - SUIT_ORDER.indexOf(b.suit);
  });
}
