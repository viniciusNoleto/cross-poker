import { beforeEach, describe, expect, it, vi } from 'vitest';

const ofetch = vi.hoisted(() => vi.fn(async () => ({ success: true, message: {}, data: null })));

vi.mock('ofetch', () => ({ ofetch }));

const { appClient } = await import('@/utils/app-client');
const { getGameService, GET_GAME_KEY } = await import('@/resources/game/services/getGame');
const { playMeldService } = await import('@/resources/game/services/playMeld');
const { playDiscardService } = await import('@/resources/game/services/playDiscard');
const { startSwapService } = await import('@/resources/game/services/startSwap');
const { chooseSwapService } = await import('@/resources/game/services/chooseSwap');
const { createRoomService } = await import('@/resources/room/services/createRoom');
const { getRoomService, GET_ROOM_KEY } = await import('@/resources/room/services/getRoom');
const { joinRoomService } = await import('@/resources/room/services/joinRoom');
const { startRoomService } = await import('@/resources/room/services/startRoom');

const signal = new AbortController().signal;

beforeEach(() => {
  ofetch.mockClear();
});

describe('appClient', () => {
  it('cada verbo repassa o método HTTP ao ofetch', async () => {
    await appClient.get('/a');
    await appClient.post('/b', { body: { x: 1 } });
    await appClient.put('/c', { body: {} });
    await appClient.patch('/d', { body: {} });
    await appClient.delete('/e');

    expect(ofetch.mock.calls.map(([url, options]: any) => [url, options.method])).toEqual([
      ['/a', 'GET'],
      ['/b', 'POST'],
      ['/c', 'PUT'],
      ['/d', 'PATCH'],
      ['/e', 'DELETE'],
    ]);
  });

  it('devolve o envelope da API', async () => {
    ofetch.mockResolvedValueOnce({ success: true, message: { 'pt-br': 'ok' }, data: 42 } as any);

    await expect(appClient.get('/x')).resolves.toMatchObject({ data: 42 });
  });
});

describe('services do jogo', () => {
  it('getGameService: GET /api/games/:id com signal', async () => {
    await getGameService({ signal, gameId: 7 } as any);

    expect(ofetch).toHaveBeenCalledWith('/api/games/7', expect.objectContaining({ method: 'GET', signal }));
    expect(GET_GAME_KEY(7)).toEqual(['get-game', 7]);
  });

  it('playMeldService: POST .../meld com cartas + origem', async () => {
    await playMeldService({ gameId: 3, body: { cards: ['hearts-A-1'], source: 'deck' } });

    expect(ofetch).toHaveBeenCalledWith('/api/games/3/meld', expect.objectContaining({ method: 'POST', body: { cards: ['hearts-A-1'], source: 'deck' } }));
  });

  it('playDiscardService: POST .../discard', async () => {
    await playDiscardService({ gameId: 3, body: { cards: ['x'], source: 'discard' } });

    expect(ofetch).toHaveBeenCalledWith('/api/games/3/discard', expect.objectContaining({ method: 'POST', body: { cards: ['x'], source: 'discard' } }));
  });

  it('startSwapService / chooseSwapService', async () => {
    await startSwapService({ gameId: 9, body: { quantity: 2 } });
    await chooseSwapService({ gameId: 9, body: { cards: ['a', 'b'] } });

    expect(ofetch).toHaveBeenNthCalledWith(1, '/api/games/9/swap/start', expect.objectContaining({ method: 'POST', body: { quantity: 2 } }));
    expect(ofetch).toHaveBeenNthCalledWith(2, '/api/games/9/swap/choose', expect.objectContaining({ method: 'POST', body: { cards: ['a', 'b'] } }));
  });
});

describe('services da sala', () => {
  it('createRoomService: POST /api/rooms', async () => {
    await createRoomService({ body: { name: 'Ana' } });

    expect(ofetch).toHaveBeenCalledWith('/api/rooms', expect.objectContaining({ method: 'POST', body: { name: 'Ana' } }));
  });

  it('getRoomService: GET /api/rooms/:code', async () => {
    await getRoomService({ signal, code: 'ABC123' } as any);

    expect(ofetch).toHaveBeenCalledWith('/api/rooms/ABC123', expect.objectContaining({ method: 'GET', signal }));
    expect(GET_ROOM_KEY('ABC123')).toEqual(['get-room', 'ABC123']);
  });

  it('joinRoomService: POST /api/rooms/:code/join', async () => {
    await joinRoomService({ code: 'ABC123', body: { name: 'Bruno' } });

    expect(ofetch).toHaveBeenCalledWith('/api/rooms/ABC123/join', expect.objectContaining({ method: 'POST', body: { name: 'Bruno' } }));
  });

  it('startRoomService: POST /api/rooms/:code/start com corpo vazio', async () => {
    await startRoomService({ code: 'ABC123' });

    expect(ofetch).toHaveBeenCalledWith('/api/rooms/ABC123/start', expect.objectContaining({ method: 'POST', body: {} }));
  });
});
