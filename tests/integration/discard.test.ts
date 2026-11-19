import { beforeEach, describe, expect, it } from 'vitest';
import { eq } from 'drizzle-orm';
import { db } from '@/libs/database';
import { gameActions, games } from '@/db/schema';
import { Client, HANDS, gameRow, ids, invoke, layout, playerRow, rig, routes, startedGame } from './support/api';

let gameId: number;
let players: Client[];
let deck: string[];

beforeEach(async () => {
  ({ gameId, players } = await startedGame());
  ({ deck } = await layout(gameId, { hands: HANDS }));
});

const TRASH = ids('hearts-2', 'hearts-3', 'diamonds-3');

describe('POST /api/games/[id]/discard — Descarte', () => {
  it('descarta, compra a mesma quantidade do Monte e passa a vez, sem pontuar', async () => {
    const result = await players[0].discard(gameId, TRASH, 'deck');

    expect(result.status).toBe(200);

    const me = await playerRow(gameId, 0);
    const game = await gameRow(gameId);

    expect(me).toMatchObject({ discards_remaining: 4, melds_remaining: 5, score: 0 });
    expect(me.hand as string[]).toHaveLength(8);
    expect(me.hand as string[]).toEqual(expect.arrayContaining(deck.slice(-3)));
    // As descartadas vão para o topo do Descarte, viradas para baixo.
    expect(game.discard).toEqual(TRASH);
    expect(game.meld_pile).toEqual([]);
    expect(game.current_seat).toBe(1);

    const [action] = await db.select().from(gameActions).where(eq(gameActions.game_id, gameId));

    expect(action).toMatchObject({ seat: 0, type: 'discard', payload: { discarded_cards: TRASH, draw_source: 'deck' } });
  });

  it('comprando do próprio Descarte: pega as do topo ANTES de empilhar as suas (nunca compra de volta o que descartou)', async () => {
    const pile = ids('hearts-J', 'hearts-Q', 'hearts-K', 'hearts-A');

    await layout(gameId, { hands: HANDS, discard: pile });
    await players[0].discard(gameId, TRASH, 'discard');

    const me = await playerRow(gameId, 0);
    const game = await gameRow(gameId);

    expect(me.hand as string[]).toEqual(expect.arrayContaining(ids('hearts-Q', 'hearts-K', 'hearts-A')));
    expect(me.hand as string[]).not.toEqual(expect.arrayContaining([TRASH[0]]));
    expect(game.discard).toEqual([...ids('hearts-J'), ...TRASH]);
  });

  it('quem só tem Descartes continua jogando', async () => {
    await rig(gameId, { players: { 0: { melds_remaining: 0 } } });

    expect((await players[0].discard(gameId, TRASH)).status).toBe(200);
  });

  it('o último Descarte de um jogador sem Jogadas o tira da rotação', async () => {
    await rig(gameId, { players: { 0: { melds_remaining: 0, discards_remaining: 1 } } });
    await players[0].discard(gameId, TRASH);

    expect(await playerRow(gameId, 0)).toMatchObject({ melds_remaining: 0, discards_remaining: 0 });

    await rig(gameId, { currentSeat: 3 });

    // Do assento 3 a vez pula o 0 (sem ações) e vai para o 1.
    await players[3].discard(gameId, ids('spades-A'));

    expect((await gameRow(gameId)).current_seat).toBe(1);
  });

  describe('validações', () => {
    it('sem Descartes → 422', async () => {
      await rig(gameId, { players: { 0: { discards_remaining: 0 } } });

      const result = await players[0].discard(gameId, TRASH);

      expect(result.status).toBe(422);
      expect(result.body.message['pt-br']).toBe('Você não possui mais Descartes disponíveis.');
    });

    it.each([
      ['nenhuma carta', [], 'Selecione de 1 a 5 cartas da sua mão, sem repetição, para descartar.'],
      ['6 cartas', HANDS[0].slice(0, 6), 'Selecione de 1 a 5 cartas da sua mão, sem repetição, para descartar.'],
      ['repetida', [TRASH[0], TRASH[0]], 'Selecione de 1 a 5 cartas da sua mão, sem repetição, para descartar.'],
      ['fora da mão', ids('clubs-A'), 'Uma ou mais cartas selecionadas não estão na sua mão.'],
    ])('%s → 422', async (_, cards, message) => {
      const result = await players[0].discard(gameId, cards);

      expect(result.status).toBe(422);
      expect(result.body.message['pt-br']).toBe(message);
    });

    it('origem inválida → 422', async () => {
      expect((await players[0].discard(gameId, TRASH, 'meld_pile')).status).toBe(422);
    });

    it('não é a sua vez → 403', async () => {
      expect((await players[2].discard(gameId, ids('diamonds-A'))).status).toBe(403);
    });

    it('estranho → 403; partida inexistente → 404', async () => {
      expect((await new Client('x').discard(gameId, TRASH)).status).toBe(403);
      expect((await players[0].discard(12345, TRASH)).status).toBe(404);
    });

    it('Troca pendente → 409', async () => {
      await rig(gameId, { pendingSwap: { initiator_seat: 0, partner_seat: 2, quantity: 1, initiator_cards: null, partner_cards: null } });

      expect((await players[0].discard(gameId, TRASH)).status).toBe(409);
    });

    it('partida encerrada → 409', async () => {
      await db.update(games).set({ status: 'finished' }).where(eq(games.id, gameId));

      expect((await players[0].discard(gameId, TRASH)).status).toBe(409);
    });

    it('corpo inválido → 500', async () => {
      const result = await invoke(players[0].jar, routes.discardRoute.POST, { params: { gameId: String(gameId) }, rawBody: '{' });

      expect(result.status).toBe(500);
      expect(result.body.message['pt-br']).toBe('Erro ao realizar o Descarte.');
    });
  });
});
