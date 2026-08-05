import { ECombo } from '../enums/ECombo';
import { RANK_ORDER, chipsForCard, type ICard } from './Card';
import { ERank } from '../enums/ERank';

export interface IBestCombo {
  type: `${ECombo}`;
  scoringCards: ICard[];
  chips: number;
  multiplier: number;
  points: number;
}

// Base chips + multiplier per combo — see game-concept.md, section "Combinações e pontuação".
const SCORE_BY_COMBO: Record<ECombo, { baseChips: number; multiplier: number }> = {
  [ECombo.HIGH_CARD]: { baseChips: 5, multiplier: 1 },
  [ECombo.PAIR]: { baseChips: 10, multiplier: 2 },
  [ECombo.TWO_PAIR]: { baseChips: 20, multiplier: 2 },
  [ECombo.THREE_OF_A_KIND]: { baseChips: 30, multiplier: 3 },
  [ECombo.STRAIGHT]: { baseChips: 30, multiplier: 4 },
  [ECombo.FLUSH]: { baseChips: 35, multiplier: 4 },
  [ECombo.FULL_HOUSE]: { baseChips: 40, multiplier: 4 },
  [ECombo.FOUR_OF_A_KIND]: { baseChips: 60, multiplier: 7 },
  [ECombo.STRAIGHT_FLUSH]: { baseChips: 100, multiplier: 8 },
};

// Balatro's low straight: A-2-3-4-5 (Ace completing from below). RANK_ORDER doesn't cover
// this case since it always treats the Ace as the highest rank — see note in Card.ts.
const LOW_STRAIGHT: Array<`${ERank}`> = [
  ERank.ACE,
  ERank.TWO,
  ERank.THREE,
  ERank.FOUR,
  ERank.FIVE,
];

function buildResult(type: `${ECombo}`, scoringCards: ICard[]): IBestCombo {
  const { baseChips, multiplier } = SCORE_BY_COMBO[type as ECombo];
  const chips = baseChips + scoringCards.reduce((sum, card) => sum + chipsForCard(card), 0);

  return {
    type,
    scoringCards,
    chips,
    multiplier,
    points: chips * multiplier,
  };
}

function groupByRank(cards: ICard[]): ICard[][] {
  const map = new Map<string, ICard[]>();

  cards.forEach((card) => {
    const group = map.get(card.rank) ?? [];

    group.push(card);
    map.set(card.rank, group);
  });

  return Array.from(map.values());
}

function isFlush(cards: ICard[]): boolean {
  return cards.every((card) => card.suit === cards[0].suit);
}

function isStraight(cards: ICard[]): boolean {
  const ranks = new Set(cards.map((card) => card.rank));

  // Repeated cards never form a straight (5 cards need 5 distinct ranks).
  if (ranks.size !== cards.length) return false;

  if (LOW_STRAIGHT.every((rank) => ranks.has(rank))) return true;

  const indices = cards
    .map((card) => RANK_ORDER.indexOf(card.rank))
    .sort((a, b) => a - b);

  return indices.every((index, position) => position === 0 || index === indices[position - 1] + 1);
}

// Receives 1 to 5 already-played cards (quantity/ownership validation is the caller's
// responsibility) and identifies the best valid combo, strongest to weakest — see
// game-concept.md, section "Combinações e pontuação".
export function bestCombo(cards: ICard[]): IBestCombo {
  const fiveCards = cards.length === 5;
  const groups = groupByRank(cards);

  const flush = fiveCards && isFlush(cards);
  const straight = fiveCards && isStraight(cards);

  if (flush && straight) return buildResult(ECombo.STRAIGHT_FLUSH, cards);

  const fourOfAKind = groups.find((group) => group.length === 4);

  if (fourOfAKind) return buildResult(ECombo.FOUR_OF_A_KIND, fourOfAKind);

  if (fiveCards) {
    const threeForFullHouse = groups.find((group) => group.length === 3);
    const pairForFullHouse = groups.find((group) => group.length === 2);

    if (threeForFullHouse && pairForFullHouse) return buildResult(ECombo.FULL_HOUSE, [...threeForFullHouse, ...pairForFullHouse]);
  }

  if (flush) return buildResult(ECombo.FLUSH, cards);

  if (straight) return buildResult(ECombo.STRAIGHT, cards);

  const threeOfAKind = groups.find((group) => group.length === 3);

  if (threeOfAKind) return buildResult(ECombo.THREE_OF_A_KIND, threeOfAKind);

  const pairs = groups.filter((group) => group.length === 2);

  if (pairs.length >= 2) return buildResult(ECombo.TWO_PAIR, [...pairs[0], ...pairs[1]]);

  if (pairs.length === 1) return buildResult(ECombo.PAIR, pairs[0]);

  const highCard = cards.reduce((highest, card) => (chipsForCard(card) > chipsForCard(highest) ? card : highest));

  return buildResult(ECombo.HIGH_CARD, [highCard]);
}
