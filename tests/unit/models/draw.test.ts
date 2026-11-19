import { describe, expect, it } from 'vitest';
import { drawCards, drawSourceAvailability } from '@/resources/game/models/Draw';

describe('drawCards — Compra', () => {
  it('do Monte: compra do topo (último elemento) para baixo', () => {
    const result = drawCards({ deck: ['d1', 'd2', 'd3'], discard: ['x'], meldPile: ['m'], quantity: 2, source: 'deck' });

    expect(result.drawnCards).toEqual(['d3', 'd2']);
    expect(result.newDeck).toEqual(['d1']);
    expect(result.newDiscard).toEqual(['x']);
    expect(result.newMeldPile).toEqual(['m']);
  });

  it('do Descarte: LIFO, as N cartas do topo', () => {
    const result = drawCards({ deck: ['d1'], discard: ['x1', 'x2', 'x3'], meldPile: [], quantity: 2, source: 'discard' });

    expect(result.drawnCards).toEqual(['x3', 'x2']);
    expect(result.newDiscard).toEqual(['x1']);
    expect(result.newDeck).toEqual(['d1']);
  });

  it('nunca muta os arrays recebidos', () => {
    const deck = ['d1', 'd2'];
    const discard = ['x1'];
    const meldPile = ['m1'];

    drawCards({ deck, discard, meldPile, quantity: 5, source: 'deck' });
    drawCards({ deck, discard, meldPile, quantity: 1, source: 'discard' });

    expect(deck).toEqual(['d1', 'd2']);
    expect(discard).toEqual(['x1']);
    expect(meldPile).toEqual(['m1']);
  });

  it('Monte esgotado no meio da compra: embaralha o Bolo inteiro num novo Monte e continua', () => {
    const result = drawCards({ deck: ['d1'], discard: ['x1'], meldPile: ['m1', 'm2', 'm3'], quantity: 3, source: 'deck' });

    expect(result.drawnCards).toHaveLength(3);
    expect(result.drawnCards[0]).toBe('d1');
    expect(result.drawnCards.slice(1).every((card) => ['m1', 'm2', 'm3'].includes(card))).toBe(true);
    // O Bolo vira Monte e fica vazio; o Descarte não é mexido.
    expect(result.newMeldPile).toEqual([]);
    expect(result.newDeck).toHaveLength(1);
    expect(result.newDiscard).toEqual(['x1']);
  });

  it('compra insuficiente do Monte (mesmo com o Bolo): entrega o que houver, sem erro', () => {
    const result = drawCards({ deck: ['d1'], discard: [], meldPile: ['m1'], quantity: 5, source: 'deck' });

    expect(result.drawnCards).toHaveLength(2);
    expect(result.newDeck).toEqual([]);
    expect(result.newMeldPile).toEqual([]);
  });

  it('compra insuficiente do Descarte: entrega o que houver e não usa o Monte nem o Bolo', () => {
    const result = drawCards({ deck: ['d1'], discard: ['x1'], meldPile: ['m1'], quantity: 3, source: 'discard' });

    expect(result.drawnCards).toEqual(['x1']);
    expect(result.newDeck).toEqual(['d1']);
    expect(result.newMeldPile).toEqual(['m1']);
  });

  it('tudo vazio: 0 cartas', () => {
    expect(drawCards({ deck: [], discard: [], meldPile: [], quantity: 3, source: 'deck' }).drawnCards).toEqual([]);
  });

  it('quantidade 0 não compra nada', () => {
    expect(drawCards({ deck: ['d1'], discard: [], meldPile: [], quantity: 0, source: 'deck' }).drawnCards).toEqual([]);
  });

  it('a compra conserva as cartas: nada some e nada duplica', () => {
    const deck = ['d1', 'd2'];
    const discard = ['x1'];
    const meldPile = ['m1', 'm2', 'm3', 'm4'];
    const result = drawCards({ deck, discard, meldPile, quantity: 4, source: 'deck' });
    const after = [...result.drawnCards, ...result.newDeck, ...result.newDiscard, ...result.newMeldPile].sort();

    expect(after).toEqual([...deck, ...discard, ...meldPile].sort());
  });
});

describe('drawSourceAvailability — quais origens podem ser escolhidas', () => {
  it('Descarte só vale se ele sozinho tiver cartas suficientes', () => {
    expect(drawSourceAvailability({ deckCount: 10, discardCount: 2, meldPileCount: 0, quantity: 3 }).discard).toBe(false);
    expect(drawSourceAvailability({ deckCount: 10, discardCount: 3, meldPileCount: 0, quantity: 3 }).discard).toBe(true);
  });

  it('Monte conta com o Bolo por trás (reembaralho)', () => {
    expect(drawSourceAvailability({ deckCount: 1, discardCount: 5, meldPileCount: 2, quantity: 3 }).deck).toBe(true);
    expect(drawSourceAvailability({ deckCount: 1, discardCount: 5, meldPileCount: 1, quantity: 3 }).deck).toBe(false);
  });

  it('se nenhuma origem dá conta, o Monte continua permitido (entrega o que houver)', () => {
    expect(drawSourceAvailability({ deckCount: 0, discardCount: 1, meldPileCount: 1, quantity: 5 })).toEqual({ deck: true, discard: false });
  });

  it('as duas origens disponíveis', () => {
    expect(drawSourceAvailability({ deckCount: 20, discardCount: 5, meldPileCount: 0, quantity: 5 })).toEqual({ deck: true, discard: true });
  });
});
