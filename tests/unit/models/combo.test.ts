import { describe, expect, it } from 'vitest';
import { bestCombo } from '@/resources/game/models/Combo';
import { ECombo } from '@/resources/game/enums/ECombo';
import { cards } from '../../support/factories';

const ids = (list: { id: string }[]) => list.map((card) => card.id).sort();

describe('bestCombo — identificação da melhor combinação', () => {
  it('Carta Alta: só a carta de maior Chips pontua', () => {
    const result = bestCombo(cards('hearts-2', 'spades-9', 'clubs-4'));

    expect(result.type).toBe(ECombo.HIGH_CARD);
    expect(ids(result.scoringCards)).toEqual(['spades-9-1']);
    // (5 base + 9) × 1
    expect(result).toMatchObject({ chips: 14, multiplier: 1, points: 14 });
  });

  it('Carta Alta com uma carta só', () => {
    const result = bestCombo(cards('hearts-A'));

    expect(result).toMatchObject({ type: ECombo.HIGH_CARD, chips: 16, multiplier: 1, points: 16 });
  });

  it('Carta Alta: o Ás (11 chips) vence o Rei', () => {
    const result = bestCombo(cards('hearts-K', 'spades-A', 'clubs-3'));

    expect(ids(result.scoringCards)).toEqual(['spades-A-1']);
  });

  it('Par: só as duas cartas do par pontuam', () => {
    const result = bestCombo(cards('hearts-8', 'spades-8', 'clubs-K'));

    expect(result.type).toBe(ECombo.PAIR);
    expect(ids(result.scoringCards)).toEqual(['hearts-8-1', 'spades-8-1']);
    // (10 + 8 + 8) × 2
    expect(result).toMatchObject({ chips: 26, multiplier: 2, points: 52 });
  });

  it('Dois Pares', () => {
    const result = bestCombo(cards('hearts-8', 'spades-8', 'clubs-K', 'diamonds-K', 'hearts-2'));

    expect(result.type).toBe(ECombo.TWO_PAIR);
    expect(result.scoringCards).toHaveLength(4);
    // (20 + 8 + 8 + 10 + 10) × 2
    expect(result).toMatchObject({ chips: 56, multiplier: 2, points: 112 });
  });

  it('Dois Pares também com 4 cartas', () => {
    expect(bestCombo(cards('hearts-3', 'spades-3', 'clubs-4', 'diamonds-4')).type).toBe(ECombo.TWO_PAIR);
  });

  it('Trinca', () => {
    const result = bestCombo(cards('hearts-Q', 'spades-Q', 'clubs-Q', 'diamonds-2'));

    expect(result.type).toBe(ECombo.THREE_OF_A_KIND);
    expect(result.scoringCards).toHaveLength(3);
    // (30 + 30) × 3
    expect(result).toMatchObject({ chips: 60, multiplier: 3, points: 180 });
  });

  it('Quadra (com 4 cartas, sem precisar de 5)', () => {
    const result = bestCombo(cards('hearts-7', 'spades-7', 'clubs-7', 'diamonds-7'));

    expect(result.type).toBe(ECombo.FOUR_OF_A_KIND);
    // (60 + 28) × 7
    expect(result).toMatchObject({ chips: 88, multiplier: 7, points: 616 });
  });

  it('Quadra com uma carta a mais: a quinta não pontua', () => {
    const result = bestCombo(cards('hearts-7', 'spades-7', 'clubs-7', 'diamonds-7', 'hearts-A'));

    expect(result.type).toBe(ECombo.FOUR_OF_A_KIND);
    expect(ids(result.scoringCards)).not.toContain('hearts-A-1');
  });

  it('Sequência', () => {
    const result = bestCombo(cards('hearts-5', 'spades-6', 'clubs-7', 'diamonds-8', 'hearts-9'));

    expect(result.type).toBe(ECombo.STRAIGHT);
    // (30 + 35) × 4
    expect(result).toMatchObject({ chips: 65, multiplier: 4, points: 260 });
  });

  it('Sequência alta 10-J-Q-K-A', () => {
    expect(bestCombo(cards('hearts-10', 'spades-J', 'clubs-Q', 'diamonds-K', 'hearts-A')).type).toBe(ECombo.STRAIGHT);
  });

  it('Sequência baixa A-2-3-4-5 (Ás por baixo)', () => {
    expect(bestCombo(cards('hearts-A', 'spades-2', 'clubs-3', 'diamonds-4', 'hearts-5')).type).toBe(ECombo.STRAIGHT);
  });

  it('não existe sequência "dando a volta" (Q-K-A-2-3)', () => {
    expect(bestCombo(cards('hearts-Q', 'spades-K', 'clubs-A', 'diamonds-2', 'hearts-3')).type).toBe(ECombo.HIGH_CARD);
  });

  it('Sequência exige 5 cartas', () => {
    expect(bestCombo(cards('hearts-5', 'spades-6', 'clubs-7', 'diamonds-8')).type).toBe(ECombo.HIGH_CARD);
  });

  it('Flush', () => {
    const result = bestCombo(cards('hearts-2', 'hearts-5', 'hearts-9', 'hearts-J', 'hearts-K'));

    expect(result.type).toBe(ECombo.FLUSH);
    // (35 + 2 + 5 + 9 + 10 + 10) × 4
    expect(result).toMatchObject({ chips: 71, multiplier: 4, points: 284 });
  });

  it('Flush exige 5 cartas', () => {
    expect(bestCombo(cards('hearts-2', 'hearts-5', 'hearts-9', 'hearts-J')).type).toBe(ECombo.HIGH_CARD);
  });

  it('Full House', () => {
    const result = bestCombo(cards('hearts-3', 'spades-3', 'clubs-3', 'diamonds-K', 'hearts-K'));

    expect(result.type).toBe(ECombo.FULL_HOUSE);
    expect(result.scoringCards).toHaveLength(5);
    // (40 + 9 + 20) × 4
    expect(result).toMatchObject({ chips: 69, multiplier: 4, points: 276 });
  });

  it('Straight Flush', () => {
    const result = bestCombo(cards('spades-9', 'spades-10', 'spades-J', 'spades-Q', 'spades-K'));

    expect(result.type).toBe(ECombo.STRAIGHT_FLUSH);
    // (100 + 49) × 8
    expect(result).toMatchObject({ chips: 149, multiplier: 8, points: 1192 });
  });

  it('Straight Flush baixo (A-2-3-4-5 do mesmo naipe)', () => {
    expect(bestCombo(cards('clubs-A', 'clubs-2', 'clubs-3', 'clubs-4', 'clubs-5')).type).toBe(ECombo.STRAIGHT_FLUSH);
  });

  it('a ordem das cartas jogadas não muda o resultado', () => {
    const ordered = bestCombo(cards('hearts-5', 'spades-6', 'clubs-7', 'diamonds-8', 'hearts-9'));
    const shuffled = bestCombo(cards('clubs-7', 'hearts-9', 'hearts-5', 'diamonds-8', 'spades-6'));

    expect(shuffled.type).toBe(ordered.type);
    expect(shuffled.points).toBe(ordered.points);
  });

  it('pontos = chips × multiplicador em todas as combinações', () => {
    const hands = [
      cards('hearts-2'),
      cards('hearts-8', 'spades-8'),
      cards('hearts-Q', 'spades-Q', 'clubs-Q'),
      cards('hearts-2', 'hearts-5', 'hearts-9', 'hearts-J', 'hearts-K'),
    ];

    hands.forEach((hand) => {
      const result = bestCombo(hand);

      expect(result.points).toBe(result.chips * result.multiplier);
    });
  });
});
