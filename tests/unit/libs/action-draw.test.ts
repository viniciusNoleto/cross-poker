import { describe, expect, it, vi } from 'vitest';

// `drawSourceError` é pura; o módulo importa o banco só para `resolveActionWithDraw` (coberto
// pelos testes de integração), então aqui o banco é substituído.
vi.mock('@/libs/db', () => ({ db: {} }));

const { drawSourceError } = await import('@/libs/actionDraw');

function game(deck: number, discard: number, meldPile: number) {
  const ids = (prefix: string, n: number) => Array.from({ length: n }, (_, i) => `${prefix}${i}`);

  return { deck: ids('d', deck), discard: ids('x', discard), meld_pile: ids('m', meldPile) } as any;
}

describe('drawSourceError — validação da origem enviada com a Jogada/Descarte', () => {
  it('origem ausente ou inválida', () => {
    expect(drawSourceError(game(10, 10, 0), undefined, 1)?.['pt-br']).toMatch(/Monte ou do Descarte/);
    expect(drawSourceError(game(10, 10, 0), 'meld_pile', 1)?.['en-us']).toMatch(/Deck or the Discard/);
  });

  it('Descarte sem cartas suficientes', () => {
    expect(drawSourceError(game(10, 1, 0), 'discard', 2)?.['pt-br']).toMatch(/Descarte não tem cartas suficientes/);
  });

  it('Monte (com o Bolo) sem cartas suficientes, mas o Descarte daria conta', () => {
    expect(drawSourceError(game(1, 5, 1), 'deck', 3)?.['pt-br']).toMatch(/Monte/);
  });

  it('origens válidas → null', () => {
    expect(drawSourceError(game(10, 5, 0), 'deck', 5)).toBeNull();
    expect(drawSourceError(game(10, 5, 0), 'discard', 5)).toBeNull();
    expect(drawSourceError(game(1, 0, 4), 'deck', 5)).toBeNull();
  });

  it('nenhuma origem dá conta: o Monte é aceito (entrega o que houver)', () => {
    expect(drawSourceError(game(0, 1, 1), 'deck', 5)).toBeNull();
  });

  it('a mensagem vem nas três línguas', () => {
    expect(Object.keys(drawSourceError(game(0, 0, 0), 'x', 1)!)).toEqual(['pt-br', 'es-mx', 'en-us']);
  });
});
