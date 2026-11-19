import { beforeEach, describe, expect, it } from 'vitest';
import { Client, HANDS, ids, invoke, layout, rig, routes, startedGame } from './support/api';

let gameId: number;
let players: Client[];

beforeEach(async () => {
  ({ gameId, players } = await startedGame());
  await layout(gameId, { hands: HANDS, discard: ids('hearts-J', 'hearts-Q'), meldPile: ids('hearts-K') });
});

describe('GET /api/games/[id] — snapshot personalizado', () => {
  it('cada jogador vê só a própria mão; dos outros, só a contagem', async () => {
    const asAna = await players[0].state(gameId);
    const asBruno = await players[1].state(gameId);

    expect(asAna.you?.hand.map((card) => card.id)).toEqual(HANDS[0]);
    expect(asBruno.you?.hand.map((card) => card.id)).toEqual(HANDS[1]);
    expect(asAna.players.map((p) => p.hand_count)).toEqual([8, 8, 8, 8]);

    // A resposta de Ana não contém nenhuma carta da mão de Bruno.
    const raw = JSON.stringify(asAna);

    HANDS[1].forEach((card) => expect(raw).not.toContain(card));
  });

  it('informações públicas da mesa', async () => {
    const state = await players[2].state(gameId);

    expect(state).toMatchObject({
      game_id: gameId,
      status: 'playing',
      current_seat: 0,
      winning_team: null,
      finish_reason: null,
      finished_at: null,
      // 52 − 32 nas mãos − 2 no Descarte − 1 no Bolo
      deck_count: 17,
      discard_count: 2,
      pending_swap: null,
      last_action: null,
    });
    // Bolo é público (virado para cima); Descarte, só a contagem.
    expect(state.meld_pile).toEqual([{ id: 'hearts-K-1', suit: 'hearts', rank: 'K' }]);
    expect(JSON.stringify(state)).not.toContain('hearts-J-1');
    expect(state.players.map((p) => [p.seat, p.name, p.team, p.is_host])).toEqual([
      [0, 'Ana', 'A', true],
      [1, 'Bruno', 'B', false],
      [2, 'Carla', 'A', false],
      [3, 'Diego', 'B', false],
    ]);
  });

  it('is_your_turn só para quem está na vez', async () => {
    expect((await players[0].state(gameId)).you?.is_your_turn).toBe(true);
    expect((await players[1].state(gameId)).you?.is_your_turn).toBe(false);
  });

  it('quem não é da sala vê a mesa sem mão (you = null)', async () => {
    const state = await new Client('espectador').state(gameId);

    expect(state.you).toBeNull();
    expect(state.players).toHaveLength(4);
  });

  it('partida inexistente → 404', async () => {
    expect((await players[0].game(777)).status).toBe(404);
  });

  it('erro inesperado → 500', async () => {
    const result = await invoke(players[0].jar, routes.gameRoute.GET, { params: { gameId: 'abc' } });

    expect(result.status).toBe(500);
    expect(result.body.message['pt-br']).toBe('Erro ao buscar a partida.');
  });
});

describe('last_action — redação de privacidade', () => {
  it('Jogada: cartas jogadas/pontuação públicas; as compradas só para o autor', async () => {
    await players[0].meld(gameId, ids('hearts-8', 'spades-8'), 'deck');

    const author = (await players[0].state(gameId)).last_action!;
    const other = (await players[1].state(gameId)).last_action!;

    for (const view of [author, other]) {
      expect(view).toMatchObject({ seat: 0, type: 'meld', combo: 'pair', chips: 26, multiplier: 2, points: 52, draw_source: 'deck', drawn_count: 2 });
      expect(view.melded_cards?.map((card) => card.id)).toEqual(ids('hearts-8', 'spades-8'));
      expect(view.scoring_cards).toHaveLength(2);
    }

    expect(author.drawn_cards).toHaveLength(2);
    expect(other.drawn_cards).toBeUndefined();
    expect(JSON.stringify(other)).not.toContain(author.drawn_cards![0].id);
  });

  it('Descarte: só a contagem para os outros', async () => {
    await players[0].discard(gameId, ids('hearts-2', 'hearts-3'), 'discard');

    const author = (await players[0].state(gameId)).last_action!;
    const other = (await players[3].state(gameId)).last_action!;

    expect(author).toMatchObject({ type: 'discard', discarded_count: 2, drawn_count: 2, draw_source: 'discard' });
    expect(author.discarded_cards?.map((card) => card.id)).toEqual(ids('hearts-2', 'hearts-3'));
    expect(author.drawn_cards?.map((card) => card.id)).toEqual(ids('hearts-Q', 'hearts-J'));

    expect(other).toMatchObject({ type: 'discard', discarded_count: 2, drawn_count: 2 });
    expect(other.discarded_cards).toBeUndefined();
    expect(other.drawn_cards).toBeUndefined();
  });

  it('Troca: quem trocou com quem e quantas cartas, nunca quais', async () => {
    await players[0].startSwap(gameId, 1);
    await players[0].chooseSwap(gameId, ids('hearts-2'));
    await players[2].chooseSwap(gameId, ids('diamonds-A'));

    for (const viewer of players) {
      const action = (await viewer.state(gameId)).last_action!;

      expect(action).toMatchObject({ type: 'swap', seat: 0, partner_seat: 2, swap_quantity: 1 });
      expect(action.melded_cards).toBeUndefined();
    }
  });

  it('o mesmo last_action (mesmo id) até a próxima ação', async () => {
    await players[0].meld(gameId, ids('hearts-8'));

    const first = (await players[2].state(gameId)).last_action!.id;
    const again = (await players[2].state(gameId)).last_action!.id;

    await players[1].meld(gameId, ids('clubs-A'));

    const next = (await players[2].state(gameId)).last_action!.id;

    expect(again).toBe(first);
    expect(next).toBeGreaterThan(first);
  });
});

describe('pending_swap público', () => {
  it('mostra quem está trocando e quem já escolheu, nunca as cartas', async () => {
    await players[0].startSwap(gameId, 2);
    await players[0].chooseSwap(gameId, ids('hearts-2', 'hearts-3'));

    const asCarla = await players[2].state(gameId);
    const asAna = await players[0].state(gameId);
    const asBruno = await players[1].state(gameId);

    expect(asBruno.pending_swap).toEqual({ initiator_seat: 0, partner_seat: 2, quantity: 2, initiator_ready: true, partner_ready: false });
    expect(asCarla.you?.needs_to_choose_swap).toBe(true);
    expect(asAna.you?.needs_to_choose_swap).toBe(false);
    expect(asBruno.you?.needs_to_choose_swap).toBe(false);
    expect(JSON.stringify(asBruno)).not.toContain('hearts-2-1');
  });

  it('partida encerrada: ninguém está na vez', async () => {
    await rig(gameId, { players: { 0: { melds_remaining: 1 }, 1: { melds_remaining: 0 }, 2: { melds_remaining: 0 }, 3: { melds_remaining: 0 } } });
    await players[0].meld(gameId, ids('hearts-8'));

    const state = await players[0].state(gameId);

    expect(state.status).toBe('finished');
    expect(state.finished_at).not.toBeNull();
    expect(state.you?.is_your_turn).toBe(false);
  });
});
