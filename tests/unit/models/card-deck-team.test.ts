import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  CHIPS_BY_RANK,
  RANK_ORDER,
  cardById,
  chipsForCard,
  sortCardsByRank,
  sortCardsBySuit,
} from '@/resources/game/models/Card';
import { buildDeck, shuffle } from '@/resources/game/models/Deck';
import { teamForSeat } from '@/resources/game/models/Team';
import { ERank } from '@/resources/game/enums/ERank';
import { ESuit } from '@/resources/game/enums/ESuit';
import { cards } from '../../support/factories';

describe('Card', () => {
  it('Chips por valor: Ás 11, figuras e 10 valem 10, demais o valor de face', () => {
    expect(CHIPS_BY_RANK).toEqual({
      A: 11, K: 10, Q: 10, J: 10, 10: 10, 9: 9, 8: 8, 7: 7, 6: 6, 5: 5, 4: 4, 3: 3, 2: 2,
    });
  });

  it('chipsForCard lê a tabela pelo valor', () => {
    expect(chipsForCard(cardById('hearts-A-1'))).toBe(11);
    expect(chipsForCard(cardById('clubs-7-1'))).toBe(7);
  });

  it('cardById reconstrói naipe e valor a partir do id (inclusive o 10, com dois dígitos)', () => {
    expect(cardById('spades-10-1')).toEqual({ id: 'spades-10-1', suit: 'spades', rank: '10' });
    expect(cardById('diamonds-Q-2')).toEqual({ id: 'diamonds-Q-2', suit: 'diamonds', rank: 'Q' });
  });

  it('RANK_ORDER vai do 2 ao Ás', () => {
    expect(RANK_ORDER[0]).toBe(ERank.TWO);
    expect(RANK_ORDER.at(-1)).toBe(ERank.ACE);
    expect(RANK_ORDER).toHaveLength(13);
  });

  it('sortCardsBySuit agrupa por naipe (♠ ♥ ♣ ♦) e ordena pelo valor dentro do naipe', () => {
    const sorted = sortCardsBySuit(cards('diamonds-2', 'hearts-K', 'spades-A', 'hearts-3', 'spades-4'));

    expect(sorted.map((card) => card.id)).toEqual(['spades-4-1', 'spades-A-1', 'hearts-3-1', 'hearts-K-1', 'diamonds-2-1']);
  });

  it('sortCardsByRank ordena pelo valor e desempata pelo naipe', () => {
    const sorted = sortCardsByRank(cards('hearts-K', 'spades-K', 'clubs-2', 'diamonds-A'));

    expect(sorted.map((card) => card.id)).toEqual(['clubs-2-1', 'spades-K-1', 'hearts-K-1', 'diamonds-A-1']);
  });

  it('as funções de ordenação não mutam o array recebido', () => {
    const hand = cards('hearts-K', 'clubs-2');
    const copy = [...hand];

    sortCardsByRank(hand);
    sortCardsBySuit(hand);

    expect(hand).toEqual(copy);
  });
});

describe('Deck', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('buildDeck monta 52 cartas únicas (4 naipes × 13 valores)', () => {
    const deck = buildDeck();

    expect(deck).toHaveLength(52);
    expect(new Set(deck.map((card) => card.id)).size).toBe(52);
    Object.values(ESuit).forEach((suit) => {
      expect(deck.filter((card) => card.suit === suit)).toHaveLength(13);
    });
  });

  it('buildDeck com 2 baralhos numera as cópias físicas', () => {
    const deck = buildDeck(2);

    expect(deck).toHaveLength(104);
    expect(deck.map((card) => card.id)).toEqual(expect.arrayContaining(['hearts-A-1', 'hearts-A-2']));
  });

  it('shuffle devolve uma permutação sem mutar a entrada', () => {
    const items = Array.from({ length: 30 }, (_, i) => i);
    const result = shuffle(items);

    expect(items).toEqual(Array.from({ length: 30 }, (_, i) => i));
    expect([...result].sort((a, b) => a - b)).toEqual(items);
  });

  it('shuffle é um Fisher-Yates: com Math.random fixo, o resultado é determinístico', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0);

    // j = 0 sempre: cada posição i troca com a 0 → [2, 3, 4, 1]... calculado passo a passo:
    // [1,2,3,4] → i=3 troca com 0 → [4,2,3,1] → i=2 → [3,2,4,1] → i=1 → [2,3,4,1]
    expect(shuffle([1, 2, 3, 4])).toEqual([2, 3, 4, 1]);
  });

  it('shuffle de lista vazia ou de um item', () => {
    expect(shuffle([])).toEqual([]);
    expect(shuffle(['x'])).toEqual(['x']);
  });
});

describe('Team', () => {
  it('assentos opostos formam a mesma equipe (A = 0 e 2, B = 1 e 3)', () => {
    expect([0, 1, 2, 3].map(teamForSeat)).toEqual(['A', 'B', 'A', 'B']);
  });
});
