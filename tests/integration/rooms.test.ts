import { describe, expect, it, vi } from 'vitest';
import { eq } from 'drizzle-orm';
import { db } from '@/libs/database';
import { gamePlayers, games, roomPlayers, rooms } from '@/db/schema';
import { subscribe } from '@/libs/realtimeHub';
import { Client, invoke, routes, startedGame } from './support/api';

const SESSION_COOKIE = /^cp_session_[A-Z0-9]{6}$/;

describe('POST /api/rooms — criar sala', () => {
  it('cria a sala com o anfitrião no assento 0 e grava o cookie de sessão', async () => {
    const ana = new Client('Ana');
    const result = await ana.createRoom('  Ana  ');

    expect(result.status).toBe(201);

    const { room, players, you, game_id: gameId } = result.body.data;

    expect(room.code).toMatch(/^[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{6}$/);
    expect(room.status).toBe('waiting');
    expect(you).toMatchObject({ name: 'Ana', seat: 0, is_host: true });
    expect(players).toHaveLength(1);
    expect(gameId).toBeNull();

    const [cookieName] = [...ana.jar.values.keys()];

    expect(cookieName).toMatch(SESSION_COOKIE);
    expect(cookieName).toBe(`cp_session_${room.code}`);
    expect(ana.jar.options.get(cookieName)).toMatchObject({ httpOnly: true, sameSite: 'lax', path: '/', secure: false });
  });

  it('nunca devolve o session_token', async () => {
    const result = await new Client('Ana').createRoom();

    expect(JSON.stringify(result.body)).not.toMatch(/session_token/);
  });

  it('atrás de HTTPS (X-Forwarded-Proto), o cookie é secure', async () => {
    const ana = new Client('Ana');

    await ana.createRoom('Ana', { 'x-forwarded-proto': 'https' });

    expect([...ana.jar.options.values()][0].secure).toBe(true);
  });

  it('nome vazio → 422', async () => {
    const result = await new Client('').createRoom('   ');

    expect(result.status).toBe(422);
    expect(result.body).toMatchObject({ success: false, message: { 'pt-br': 'Informe seu nome.' } });
  });

  it('código já usado: sorteia outro', async () => {
    // Math.random = 0 → "AAAAAA" sempre; depois libera o sorteio normal.
    const random = vi.spyOn(Math, 'random').mockReturnValue(0);
    const first = await new Client('Ana').createRoom();

    random.mockReturnValueOnce(0).mockReturnValueOnce(0).mockReturnValueOnce(0)
      .mockReturnValueOnce(0).mockReturnValueOnce(0).mockReturnValueOnce(0)
      .mockReturnValue(0.5);

    const second = await new Client('Bruno').createRoom();

    random.mockRestore();
    expect(first.body.data.room.code).toBe('AAAAAA');
    expect(second.status).toBe(201);
    expect(second.body.data.room.code).not.toBe('AAAAAA');
  });

  it('corpo inválido → 500', async () => {
    const result = await invoke(new Client('x').jar, routes.roomsRoute.POST, { rawBody: '<html>' });

    expect(result.status).toBe(500);
    expect(result.body.message['pt-br']).toBe('Erro ao criar sala.');
  });

  it('o envelope de mensagem vem nas três línguas', async () => {
    const result = await new Client('Ana').createRoom();

    expect(Object.keys(result.body.message).sort()).toEqual(['en-us', 'es-mx', 'pt-br']);
  });
});

describe('GET /api/rooms/[code]', () => {
  it('sala inexistente → 404', async () => {
    expect((await new Client('x').getRoom('NOPE00')).status).toBe(404);
  });

  it('identifica "você" pelo cookie e aceita o código em minúsculas', async () => {
    const ana = new Client('Ana');
    const { room } = (await ana.createRoom()).body.data;

    const asAna = await ana.getRoom(room.code.toLowerCase());
    const asStranger = await new Client('?').getRoom(room.code);

    expect(asAna.body.data.you?.name).toBe('Ana');
    expect(asStranger.body.data.you).toBeNull();
    expect(asStranger.body.data.players).toHaveLength(1);
  });

  it('depois de iniciada, aponta para a Partida', async () => {
    const { code, gameId, players } = await startedGame();
    const result = await players[1].getRoom(code);

    expect(result.body.data.room.status).toBe('playing');
    expect(result.body.data.game_id).toBe(gameId);
  });
});

describe('POST /api/rooms/[code]/join', () => {
  it('ocupa os assentos livres em ordem e avisa o lobby (SSE)', async () => {
    const ana = new Client('Ana');
    const { room } = (await ana.createRoom()).body.data;
    let events = 0;
    const off = subscribe(`room:${room.code}`, () => events++);

    const bruno = await new Client('Bruno').join(room.code.toLowerCase());
    const carla = await new Client('Carla').join(room.code);

    off();

    expect(bruno.status).toBe(201);
    expect(bruno.body.data.you).toMatchObject({ name: 'Bruno', seat: 1, is_host: false });
    expect(carla.body.data.you?.seat).toBe(2);
    expect(carla.body.data.players.map((p) => p.name)).toEqual(['Ana', 'Bruno', 'Carla']);
    expect(events).toBe(2);
  });

  it('quem já está na sala (mesmo cookie) não ganha outro assento', async () => {
    const ana = new Client('Ana');
    const { room } = (await ana.createRoom()).body.data;
    const again = await ana.join(room.code, 'Outro nome');

    expect(again.status).toBe(200);
    expect(again.body.message['pt-br']).toBe('Você já está nesta sala.');
    expect(again.body.data.you?.seat).toBe(0);
    expect(await db.select().from(roomPlayers)).toHaveLength(1);
  });

  it('sala inexistente → 404', async () => {
    expect((await new Client('Bruno').join('ZZZZZZ')).status).toBe(404);
  });

  it('nome vazio → 422', async () => {
    const { room } = (await new Client('Ana').createRoom()).body.data;

    expect((await new Client('').join(room.code, '')).status).toBe(422);
  });

  it('quinto jogador → 409 (sala cheia)', async () => {
    const { room } = (await new Client('Ana').createRoom()).body.data;

    for (const name of ['B', 'C', 'D']) await new Client(name).join(room.code);

    const fifth = await new Client('E').join(room.code);

    expect(fifth.status).toBe(409);
    expect(fifth.body.message['pt-br']).toBe('Esta sala já está cheia.');
  });

  it('sala que já começou → 409', async () => {
    const { code } = await startedGame();
    const late = await new Client('Atrasado').join(code);

    expect(late.status).toBe(409);
    expect(late.body.message['pt-br']).toBe('Esta sala já iniciou a partida.');
  });

  it('corpo inválido → 500 com mensagem', async () => {
    const { room } = (await new Client('Ana').createRoom()).body.data;
    const result = await invoke(new Client('x').jar, routes.joinRoute.POST, { params: { code: room.code }, rawBody: '{oops' });

    expect(result.status).toBe(500);
    expect(result.body.message['pt-br']).toBe('Erro ao entrar na sala.');
  });
});

describe('POST /api/rooms/[code]/start', () => {
  async function fullRoom() {
    const host = new Client('Ana');
    const { room } = (await host.createRoom()).body.data;
    const guests = ['Bruno', 'Carla', 'Diego'].map((name) => new Client(name));

    for (const guest of guests) await guest.join(room.code);

    return { host, guests, code: room.code };
  }

  it('só o anfitrião inicia', async () => {
    const { guests, code } = await fullRoom();

    expect((await guests[0].start(code)).status).toBe(403);
    expect((await new Client('estranho').start(code)).status).toBe(403);
  });

  it('precisa de exatamente 4 jogadores', async () => {
    const host = new Client('Ana');
    const { room } = (await host.createRoom()).body.data;

    await new Client('Bruno').join(room.code);

    const result = await host.start(room.code);

    expect(result.status).toBe(422);
    expect(result.body.message['pt-br']).toBe('A partida só pode começar com 4 jogadores.');
  });

  it('sala inexistente → 404', async () => {
    expect((await new Client('Ana').start('ZZZZZZ')).status).toBe(404);
  });

  it('distribui 8 cartas para cada, monta o Monte com o resto e sorteia quem começa', async () => {
    const { host, code } = await fullRoom();
    let events = 0;
    const off = subscribe(`room:${code}`, () => events++);
    const result = await host.start(code);

    off();
    expect(result.status).toBe(200);
    expect(events).toBe(1);

    const [game] = await db.select().from(games).where(eq(games.id, result.body.data.game_id));
    const hands = await db.select().from(gamePlayers).where(eq(gamePlayers.game_id, game.id));
    const allCards = [...(game.deck as string[]), ...hands.flatMap((hand) => hand.hand as string[])];

    expect(game.status).toBe('playing');
    expect(game.current_seat).toBeGreaterThanOrEqual(0);
    expect(game.current_seat).toBeLessThanOrEqual(3);
    expect(game.discard).toEqual([]);
    expect(game.meld_pile).toEqual([]);
    expect(game.last_action_at).toBeInstanceOf(Date);
    expect((game.deck as string[])).toHaveLength(20);
    expect(hands).toHaveLength(4);
    hands.forEach((hand) => {
      expect(hand.hand as string[]).toHaveLength(8);
      expect(hand).toMatchObject({ melds_remaining: 5, discards_remaining: 5, score: 0 });
    });
    // Um baralho só: 52 cartas físicas, nenhuma repetida.
    expect(new Set(allCards).size).toBe(52);

    const [room] = await db.select().from(rooms).where(eq(rooms.code, code));

    expect(room.status).toBe('playing');
  });

  it('não inicia duas vezes', async () => {
    const { host, code } = await fullRoom();

    await host.start(code);

    expect((await host.start(code)).status).toBe(409);
  });
});
