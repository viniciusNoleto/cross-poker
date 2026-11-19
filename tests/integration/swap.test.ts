import { beforeEach, describe, expect, it } from 'vitest';
import { eq } from 'drizzle-orm';
import { db } from '@/libs/database';
import { gameActions, games } from '@/db/schema';
import { subscribe } from '@/libs/realtimeHub';
import { Client, HANDS, gameRow, ids, invoke, layout, playerRow, rig, routes, startedGame } from './support/api';

let gameId: number;
let players: Client[];

beforeEach(async () => {
  ({ gameId, players } = await startedGame());
  await layout(gameId, { hands: HANDS });
});

const ANA_GIVES = ids('hearts-2', 'hearts-3');
const CARLA_GIVES = ids('diamonds-A', 'diamonds-2');

describe('POST /api/games/[id]/swap/start — Troca, fase 1', () => {
  it('abre a Troca com o parceiro (assento oposto) e bloqueia as outras ações', async () => {
    const result = await players[0].startSwap(gameId, 2);

    expect(result.status).toBe(200);
    expect((await gameRow(gameId)).pending_swap).toEqual({ initiator_seat: 0, partner_seat: 2, quantity: 2, initiator_cards: null, partner_cards: null });
    expect((await players[0].meld(gameId, ids('hearts-8'))).status).toBe(409);
    expect((await players[0].discard(gameId, ids('hearts-8'))).status).toBe(409);
    expect((await players[0].startSwap(gameId, 1)).status).toBe(409);
  });

  it('o parceiro do assento 3 é o assento 1', async () => {
    await rig(gameId, { currentSeat: 3 });
    await players[3].startSwap(gameId, 1);

    expect((await gameRow(gameId)).pending_swap).toMatchObject({ initiator_seat: 3, partner_seat: 1 });
  });

  it.each([0, 6, 1.5, 'dois', null])('quantidade inválida (%s) → 422', async (quantity) => {
    const result = await players[0].startSwap(gameId, quantity);

    expect(result.status).toBe(422);
    expect(result.body.message['pt-br']).toBe('Escolha entre 1 e 5 cartas para trocar.');
  });

  it('o parceiro sem Descartes → 422', async () => {
    await rig(gameId, { players: { 2: { discards_remaining: 0 } } });

    const result = await players[0].startSwap(gameId, 1);

    expect(result.status).toBe(422);
    expect(result.body.message['pt-br']).toBe('Ambos os parceiros precisam ter ao menos 1 Descarte disponível.');
  });

  it('você sem Descartes → 422', async () => {
    await rig(gameId, { players: { 0: { discards_remaining: 0 } } });

    expect((await players[0].startSwap(gameId, 1)).status).toBe(422);
  });

  it('fora da vez → 403; estranho → 403; partida inexistente → 404; encerrada → 409', async () => {
    expect((await players[1].startSwap(gameId, 1)).status).toBe(403);
    expect((await new Client('x').startSwap(gameId, 1)).status).toBe(403);
    expect((await players[0].startSwap(999, 1)).status).toBe(404);

    await db.update(games).set({ status: 'finished' }).where(eq(games.id, gameId));
    expect((await players[0].startSwap(gameId, 1)).status).toBe(409);
  });

  it('corpo inválido → 500', async () => {
    const result = await invoke(players[0].jar, routes.swapStartRoute.POST, { params: { gameId: String(gameId) }, rawBody: '' });

    expect(result.status).toBe(500);
  });
});

describe('POST /api/games/[id]/swap/choose — Troca, fase 2', () => {
  beforeEach(async () => {
    await players[0].startSwap(gameId, 2);
  });

  it('o primeiro a escolher espera; o segundo conclui a troca simultânea', async () => {
    const first = await players[2].chooseSwap(gameId, CARLA_GIVES);

    expect(first.status).toBe(200);
    expect(first.body.data).toEqual({ waiting_for_partner: true });
    expect((await gameRow(gameId)).pending_swap).toMatchObject({ partner_cards: CARLA_GIVES, initiator_cards: null });

    let events = 0;
    const off = subscribe(`game:${gameId}`, () => events++);
    const second = await players[0].chooseSwap(gameId, ANA_GIVES);

    off();
    expect(second.body.data).toEqual({ waiting_for_partner: false });
    expect(events).toBe(1);

    const ana = await playerRow(gameId, 0);
    const carla = await playerRow(gameId, 2);
    const game = await gameRow(gameId);

    expect(ana.hand as string[]).toEqual(expect.arrayContaining(CARLA_GIVES));
    expect(ana.hand as string[]).not.toEqual(expect.arrayContaining([ANA_GIVES[0]]));
    expect(carla.hand as string[]).toEqual(expect.arrayContaining(ANA_GIVES));
    expect(ana.hand as string[]).toHaveLength(8);
    expect(carla.hand as string[]).toHaveLength(8);
    // Cada um consome 1 Descarte; não há compra.
    expect(ana.discards_remaining).toBe(4);
    expect(carla.discards_remaining).toBe(4);
    expect(game.deck as string[]).toHaveLength(20);
    expect(game.pending_swap).toBeNull();
    expect(game.current_seat).toBe(1);
  });

  it('o histórico nunca guarda quais cartas foram trocadas', async () => {
    await players[0].chooseSwap(gameId, ANA_GIVES);
    await players[2].chooseSwap(gameId, CARLA_GIVES);

    const [action] = await db.select().from(gameActions).where(eq(gameActions.game_id, gameId));

    expect(action).toMatchObject({ type: 'swap', seat: 0, payload: { partner_seat: 2, quantity: 2 } });
    expect(JSON.stringify(action.payload)).not.toMatch(/hearts|diamonds/);
  });

  it('escolhas simultâneas: a troca acontece exatamente uma vez', async () => {
    const [a, b] = await Promise.all([
      players[0].chooseSwap(gameId, ANA_GIVES),
      players[2].chooseSwap(gameId, CARLA_GIVES),
    ]);

    expect([a.status, b.status]).toEqual([200, 200]);
    expect([a.body.data.waiting_for_partner, b.body.data.waiting_for_partner].sort()).toEqual([false, true]);
    expect((await playerRow(gameId, 0)).discards_remaining).toBe(4);
    expect((await playerRow(gameId, 2)).discards_remaining).toBe(4);
    expect(await db.select().from(gameActions)).toHaveLength(1);
  });

  it('escolher duas vezes → 409', async () => {
    await players[0].chooseSwap(gameId, ANA_GIVES);

    const again = await players[0].chooseSwap(gameId, ANA_GIVES);

    expect(again.status).toBe(409);
    expect(again.body.message['pt-br']).toBe('Você já escolheu suas cartas para esta troca.');
  });

  it('quem não participa → 403', async () => {
    expect((await players[1].chooseSwap(gameId, ids('clubs-A', 'clubs-2'))).status).toBe(403);
    expect((await new Client('x').chooseSwap(gameId, ANA_GIVES)).status).toBe(403);
  });

  it.each([
    ['quantidade diferente da combinada', ids('hearts-2')],
    ['carta fora da mão', ids('hearts-2', 'clubs-A')],
    ['repetida', ids('hearts-2', 'hearts-2')],
  ])('%s → 422', async (_, cards) => {
    expect((await players[0].chooseSwap(gameId, cards)).status).toBe(422);
  });

  it('sem Troca em andamento → 409', async () => {
    await rig(gameId, { pendingSwap: null });

    expect((await players[0].chooseSwap(gameId, ANA_GIVES)).status).toBe(409);
  });

  it('partida inexistente → 404', async () => {
    expect((await players[0].chooseSwap(4242, ANA_GIVES)).status).toBe(404);
  });

  it('corpo inválido → 500', async () => {
    const result = await invoke(players[0].jar, routes.swapChooseRoute.POST, { params: { gameId: String(gameId) }, rawBody: 'x' });

    expect(result.status).toBe(500);
    expect(result.body.message['pt-br']).toBe('Erro ao confirmar a troca.');
  });
});
