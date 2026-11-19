import { beforeEach, describe, expect, it } from 'vitest';
import { desc, eq } from 'drizzle-orm';
import { db } from '@/libs/database';
import { gameActions, games, rooms } from '@/db/schema';
import { subscribe } from '@/libs/realtimeHub';
import { Client, HANDS, gameRow, ids, invoke, layout, playerRow, rig, routes, startedGame } from './support/api';

let gameId: number;
let players: Client[];
let deck: string[];

beforeEach(async () => {
  ({ gameId, players } = await startedGame());
  ({ deck } = await layout(gameId, { hands: HANDS }));
});

const PAIR = ids('hearts-8', 'spades-8');

describe('POST /api/games/[id]/meld — Jogada', () => {
  it('pontua a melhor combinação, compra do Monte, empilha no Bolo e passa a vez', async () => {
    let events = 0;
    const off = subscribe(`game:${gameId}`, () => events++);
    const result = await players[0].meld(gameId, [...PAIR, ...ids('clubs-K')], 'deck');

    off();
    expect(result.status).toBe(200);
    expect(result.body.data).toBeNull();
    expect(events).toBe(1);

    const me = await playerRow(gameId, 0);
    const game = await gameRow(gameId);

    // Par de 8: (10 + 8 + 8) × 2 — o Rei jogado junto não pontua, mas vai para o Bolo.
    expect(me.score).toBe(52);
    expect(me.melds_remaining).toBe(4);
    expect(me.discards_remaining).toBe(5);
    expect(me.hand as string[]).toHaveLength(8);
    expect(me.hand as string[]).not.toEqual(expect.arrayContaining(PAIR));
    // Comprou as 3 do topo do Monte.
    expect(me.hand as string[]).toEqual(expect.arrayContaining(deck.slice(-3)));
    expect(game.deck).toEqual(deck.slice(0, -3));
    expect(game.meld_pile).toEqual([...PAIR, ...ids('clubs-K')]);
    expect(game.current_seat).toBe(1);

    const [action] = await db.select().from(gameActions).where(eq(gameActions.game_id, gameId));

    expect(action).toMatchObject({ seat: 0, type: 'meld' });
    expect(action.payload).toMatchObject({
      melded_cards: [...PAIR, ...ids('clubs-K')],
      combo: 'pair',
      scoring_cards: PAIR,
      chips: 26,
      multiplier: 2,
      points: 52,
      draw_source: 'deck',
    });
  });

  it('compra do Descarte: as N cartas do topo', async () => {
    const discard = ids('hearts-J', 'hearts-Q', 'hearts-K');

    await layout(gameId, { hands: HANDS, discard });
    await players[0].meld(gameId, PAIR, 'discard');

    const me = await playerRow(gameId, 0);
    const game = await gameRow(gameId);

    expect(me.hand as string[]).toEqual(expect.arrayContaining(ids('hearts-Q', 'hearts-K')));
    expect(game.discard).toEqual(ids('hearts-J'));
  });

  it('Monte vazio: reembaralha o Bolo antigo, e as cartas recém-jogadas nunca voltam para a mão', async () => {
    const oldPile = ids('hearts-J', 'hearts-Q', 'hearts-K');

    await layout(gameId, { hands: HANDS, meldPile: oldPile, deckSize: 0 });
    await players[0].meld(gameId, PAIR, 'deck');

    const me = await playerRow(gameId, 0);
    const game = await gameRow(gameId);
    const drawn = (me.hand as string[]).slice(-2);

    expect(drawn.every((card) => oldPile.includes(card))).toBe(true);
    // O Bolo reembaralhado virou Monte (sobrou 1 carta) e o novo Bolo só tem a Jogada.
    expect(game.deck as string[]).toHaveLength(1);
    expect(game.meld_pile).toEqual(PAIR);
  });

  it('sem cartas em lugar nenhum: a mão fica com menos de 8, sem erro', async () => {
    await layout(gameId, { hands: HANDS, deckSize: 1 });

    const result = await players[0].meld(gameId, PAIR, 'deck');

    expect(result.status).toBe(200);
    expect((await playerRow(gameId, 0)).hand as string[]).toHaveLength(7);
  });

  it('pula quem não tem nenhuma ação', async () => {
    await rig(gameId, { players: { 1: { melds_remaining: 0, discards_remaining: 0 } } });
    await players[0].meld(gameId, PAIR);

    expect((await gameRow(gameId)).current_seat).toBe(2);
  });

  it('atualiza last_action_at', async () => {
    const old = new Date(Date.now() - 30 * 60 * 1000);

    await rig(gameId, { lastActionAt: old });
    await players[0].meld(gameId, PAIR);

    expect((await gameRow(gameId)).last_action_at!.getTime()).toBeGreaterThan(old.getTime());
  });

  describe('validações', () => {
    it('não é a sua vez → 403', async () => {
      const result = await players[1].meld(gameId, ids('clubs-A'));

      expect(result.status).toBe(403);
      expect(result.body.message['pt-br']).toBe('Não é a sua vez de jogar.');
    });

    it('quem não está na partida → 403', async () => {
      expect((await new Client('estranho').meld(gameId, PAIR)).status).toBe(403);
    });

    it('partida inexistente → 404', async () => {
      expect((await players[0].meld(999, PAIR)).status).toBe(404);
    });

    it.each([
      ['nenhuma carta', []],
      ['mais de 5 cartas', HANDS[0].slice(0, 6)],
      ['carta repetida', [PAIR[0], PAIR[0]]],
      ['carta que não está na mão', ids('clubs-A')],
    ])('seleção inválida (%s) → 422', async (_, cards) => {
      const result = await players[0].meld(gameId, cards);

      expect(result.status).toBe(422);
      expect(result.body.message['pt-br']).toBe('Seleção de cartas inválida.');
    });

    it('cards que não é array → 422', async () => {
      const result = await invoke(players[0].jar, routes.meldRoute.POST, { params: { gameId: String(gameId) }, body: { cards: 'hearts-8-1', source: 'deck' } });

      expect(result.status).toBe(422);
    });

    it('sem origem da compra → 422', async () => {
      const result = await players[0].meld(gameId, PAIR, null);

      expect(result.status).toBe(422);
      expect(result.body.message['pt-br']).toBe('Escolha se a compra será do Monte ou do Descarte.');
    });

    it('Descarte sem cartas suficientes → 422', async () => {
      const result = await players[0].meld(gameId, PAIR, 'discard');

      expect(result.status).toBe(422);
      expect(result.body.message['pt-br']).toBe('O Descarte não tem cartas suficientes para esta compra.');
    });

    it('sem Jogadas restantes → 422', async () => {
      await rig(gameId, { players: { 0: { melds_remaining: 0 } } });

      expect((await players[0].meld(gameId, PAIR)).status).toBe(422);
    });

    it('Troca pendente → 409', async () => {
      await rig(gameId, { pendingSwap: { initiator_seat: 0, partner_seat: 2, quantity: 1, initiator_cards: null, partner_cards: null } });

      expect((await players[0].meld(gameId, PAIR)).status).toBe(409);
    });

    it('partida encerrada → 409', async () => {
      await players[0].meld(gameId, PAIR);
      await db.update(games).set({ status: 'finished' }).where(eq(games.id, gameId));
      await rig(gameId, { currentSeat: 1 });

      const result = await players[1].meld(gameId, ids('clubs-A'));

      expect(result.status).toBe(409);
      expect(result.body.message['pt-br']).toBe('Esta partida já terminou.');
    });

    it('nada muda quando a validação falha', async () => {
      const before = await gameRow(gameId);

      await players[0].meld(gameId, ids('clubs-A'));

      expect(await gameRow(gameId)).toEqual(before);
      expect(await db.select().from(gameActions)).toHaveLength(0);
    });

    it('corpo inválido → 500', async () => {
      const result = await invoke(players[0].jar, routes.meldRoute.POST, { params: { gameId: String(gameId) }, rawBody: 'nope' });

      expect(result.status).toBe(500);
      expect(result.body.message['pt-br']).toBe('Erro ao realizar a Jogada.');
    });
  });
});

describe('fim da Partida pela Jogada', () => {
  it('última Jogada de todos → no_melds, vencedora gravada e sala encerrada', async () => {
    await rig(gameId, {
      players: {
        0: { melds_remaining: 1, score: 10 },
        1: { melds_remaining: 0, score: 100 },
        2: { melds_remaining: 0, score: 10 },
        3: { melds_remaining: 0, score: 0 },
      },
    });

    await players[0].meld(gameId, PAIR);

    const game = await gameRow(gameId);

    // A: 10 + 52 + 10 = 72; B: 100
    expect(game).toMatchObject({ status: 'finished', finish_reason: 'no_melds', winning_team: 'B', pending_swap: null });
    expect(game.finished_at).toBeInstanceOf(Date);

    const [room] = await db.select().from(rooms).where(eq(rooms.id, game.room_id));

    expect(room.status).toBe('finished');

    // A Jogada que encerrou ainda é a última ação (a animação toca antes do resultado).
    const [last] = await db.select().from(gameActions).orderBy(desc(gameActions.id)).limit(1);

    expect(last.type).toBe('meld');
  });

  it('empate → winning_team null', async () => {
    await rig(gameId, {
      players: {
        0: { melds_remaining: 1, score: 0 },
        1: { melds_remaining: 0, score: 52 },
        2: { melds_remaining: 0 },
        3: { melds_remaining: 0 },
      },
    });

    await players[0].meld(gameId, PAIR);

    expect(await gameRow(gameId)).toMatchObject({ status: 'finished', winning_team: null });
  });

  it('fim antecipado: só a Equipe A tem Jogadas e passou à frente → decided', async () => {
    await rig(gameId, {
      players: {
        0: { melds_remaining: 3, score: 0 },
        1: { melds_remaining: 0, score: 40 },
        2: { melds_remaining: 2, score: 0 },
        3: { melds_remaining: 0, score: 0 },
      },
    });

    await players[0].meld(gameId, PAIR);

    expect(await gameRow(gameId)).toMatchObject({ status: 'finished', finish_reason: 'decided', winning_team: 'A' });
  });

  it('só a Equipe A tem Jogadas mas ainda está atrás → continua', async () => {
    await rig(gameId, {
      players: {
        0: { melds_remaining: 3 },
        1: { melds_remaining: 0, score: 500 },
        3: { melds_remaining: 0 },
      },
    });

    await players[0].meld(gameId, PAIR);

    expect(await gameRow(gameId)).toMatchObject({ status: 'playing', current_seat: 1 });
  });
});
