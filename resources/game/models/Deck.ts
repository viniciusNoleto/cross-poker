import { ESuit } from '../enums/ESuit';
import { ERank } from '../enums/ERank';
import type { ICard } from './Card';

const SUITS = Object.values(ESuit);
const RANKS = Object.values(ERank);

export function buildDeck(deckCount = 1): ICard[] {
  const cards: ICard[] = [];

  for (let deckIndex = 1; deckIndex <= deckCount; deckIndex++) {
    for (const suit of SUITS) {
      for (const rank of RANKS) {
        cards.push({ id: `${suit}-${rank}-${deckIndex}`, suit, rank });
      }
    }
  }

  return cards;
}

export function shuffle<T>(items: T[]): T[] {
  const result = [...items];

  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }

  return result;
}
