import { afterEach, describe, expect, it, vi } from 'vitest';
import { eq } from 'drizzle-orm';
import { db } from '@/libs/database';
import { rooms } from '@/db/schema';
import { closeStaleGames, startStaleGameSweeper } from '@/libs/staleGames';
import { publish, subscribe } from '@/libs/realtimeHub';
import { HANDS, gameRow, ids, layout, rig, routes, startedGame } from './support/api';

const HOUR = 60 * 60 * 1000;

describe('closeStaleGames — encerramento por inatividade', () => {
  it('encerra quem está há mais de 1h sem ação, vale o placar do momento', async () => {
    const { gameId } = await startedGame();
    let events = 0;
    const off = subscribe(`game:${gameId}`, () => events++);

    await rig(gameId, {
      lastActionAt: new Date(Date.now() - HOUR - 60_000),
      players: { 1: { score: 30 } },
    });

    expect(await closeStaleGames()).toBe(1);
    off();

    const game = await gameRow(gameId);

    expect(game).toMatchObject({ status: 'finished', finish_reason: 'inactivity', winning_team: 'B' });
    expect(events).toBe(1);

    const [room] = await db.select().from(rooms).where(eq(rooms.id, game.room_id));

    expect(room.status).toBe('finished');
  });

  it('sem last_action_at, usa created_at', async () => {
    const { gameId } = await startedGame();

    await rig(gameId, { lastActionAt: null, createdAt: new Date(Date.now() - 2 * HOUR) });

    expect(await closeStaleGames()).toBe(1);
    expect((await gameRow(gameId)).finish_reason).toBe('inactivity');
  });

  it('não mexe em partidas ativas recentemente nem nas já encerradas', async () => {
    const recent = await startedGame();
    const old = await startedGame();

    await rig(old.gameId, { lastActionAt: new Date(Date.now() - 3 * HOUR) });
    await closeStaleGames();
    await rig(old.gameId, { lastActionAt: new Date(Date.now() - 3 * HOUR) });

    expect(await closeStaleGames()).toBe(0);
    expect((await gameRow(recent.gameId)).status).toBe('playing');
  });

  // BUG conhecido (documentado aqui, não corrigido): `games.last_action_at` é `timestamp` SEM fuso e o
  // limite é passado ao `pg` como `Date` cru dentro de um `sql` — o driver o serializa no fuso LOCAL do
  // processo. Com o servidor em UTC−4, uma partida parada há 2h só é encerrada depois de ~5h. Em
  // produção o container roda em UTC e não acontece. Quando for corrigido, este teste passa e o
  // `it.fails` acusa: troque por `it`.
  it.fails('independe do fuso horário do servidor', async () => {
    const { gameId } = await startedGame();

    await rig(gameId, { lastActionAt: new Date(Date.now() - 2 * HOUR) });

    process.env.TZ = 'America/Manaus';

    try {
      expect(await closeStaleGames()).toBe(1);
    } finally {
      process.env.TZ = 'UTC';
    }
  });

  it('empate por inatividade → sem vencedora', async () => {
    const { gameId } = await startedGame();

    await rig(gameId, { lastActionAt: new Date(Date.now() - 2 * HOUR) });
    await closeStaleGames();

    expect((await gameRow(gameId)).winning_team).toBeNull();
  });

  describe('startStaleGameSweeper', () => {
    afterEach(() => {
      const global = globalThis as any;

      clearInterval(global.__crossPokerStaleSweeper);
      delete global.__crossPokerStaleSweeper;
    });

    it('roda uma varredura na hora e agenda as próximas uma única vez por processo', async () => {
      const { gameId } = await startedGame();

      await rig(gameId, { lastActionAt: new Date(Date.now() - 2 * HOUR) });

      const setIntervalSpy = vi.spyOn(globalThis, 'setInterval');
      const log = vi.spyOn(console, 'log').mockImplementation(() => {});

      startStaleGameSweeper();
      startStaleGameSweeper();

      expect(setIntervalSpy).toHaveBeenCalledTimes(1);
      expect(setIntervalSpy).toHaveBeenCalledWith(expect.any(Function), 5 * 60 * 1000);

      await vi.waitFor(async () => expect((await gameRow(gameId)).status).toBe('finished'));
      expect(log).toHaveBeenCalledWith(expect.stringMatching(/1 partida\(s\) encerrada\(s\) por inatividade/));
    });
  });
});

/** Lê o próximo pedaço do stream SSE como texto. */
async function nextChunk(reader: ReadableStreamDefaultReader<Uint8Array>) {
  const { value } = await reader.read();

  return new TextDecoder().decode(value);
}

describe('SSE — /api/rooms/[code]/stream e /api/games/[id]/stream', () => {
  it('stream da Partida: conecta, recebe state-changed a cada ação e se desinscreve ao fechar', async () => {
    const { gameId, players } = await startedGame();

    await layout(gameId, { hands: HANDS });

    const abort = new AbortController();
    const response = await routes.gameStreamRoute.GET(
      new Request('http://cross-poker.test/stream', { signal: abort.signal }),
      { params: Promise.resolve({ gameId: String(gameId) }) },
    );

    expect(response.headers.get('content-type')).toBe('text/event-stream');
    expect(response.headers.get('cache-control')).toMatch(/no-cache/);

    const reader = response.body!.getReader();

    expect(await nextChunk(reader)).toBe(': connected\n\n');

    await players[0].meld(gameId, ids('hearts-8'));
    expect(await nextChunk(reader)).toBe('event: state-changed\ndata: {}\n\n');

    abort.abort();
    await vi.waitFor(() => expect((globalThis as any).__crossPokerChannels.has(`game:${gameId}`)).toBe(false));
  });

  it('stream do lobby usa o código em maiúsculas', async () => {
    const abort = new AbortController();
    const response = await routes.roomStreamRoute.GET(
      new Request('http://cross-poker.test/stream', { signal: abort.signal }),
      { params: Promise.resolve({ code: 'abc234' }) },
    );
    const reader = response.body!.getReader();

    await nextChunk(reader);
    publish('room:ABC234');

    expect(await nextChunk(reader)).toContain('state-changed');
    abort.abort();
  });

  it('manda heartbeat a cada 25s', async () => {
    vi.useFakeTimers();

    const abort = new AbortController();
    const response = await routes.roomStreamRoute.GET(
      new Request('http://cross-poker.test/stream', { signal: abort.signal }),
      { params: Promise.resolve({ code: 'HBEAT1' }) },
    );
    const reader = response.body!.getReader();

    await nextChunk(reader);
    vi.advanceTimersByTime(25_000);

    expect(await nextChunk(reader)).toBe(': heartbeat\n\n');
    abort.abort();
    vi.useRealTimers();
  });
});
