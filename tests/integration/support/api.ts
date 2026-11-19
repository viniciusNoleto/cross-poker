import { and, eq } from 'drizzle-orm';
import { expect } from 'vitest';
import { db } from '@/libs/database';
import { gamePlayers, games } from '@/db/schema';
import * as roomsRoute from '@/app/api/rooms/route';
import * as roomRoute from '@/app/api/rooms/[code]/route';
import * as joinRoute from '@/app/api/rooms/[code]/join/route';
import * as startRoute from '@/app/api/rooms/[code]/start/route';
import * as roomStreamRoute from '@/app/api/rooms/[code]/stream/route';
import * as gameRoute from '@/app/api/games/[gameId]/route';
import * as meldRoute from '@/app/api/games/[gameId]/meld/route';
import * as discardRoute from '@/app/api/games/[gameId]/discard/route';
import * as swapStartRoute from '@/app/api/games/[gameId]/swap/start/route';
import * as swapChooseRoute from '@/app/api/games/[gameId]/swap/choose/route';
import * as gameStreamRoute from '@/app/api/games/[gameId]/stream/route';
import { buildDeck } from '@/resources/game/models/Deck';
import type { IGameState } from '@/resources/game/models/GameState';
import type { IRoomState } from '@/resources/room/models/RoomPlayer';
import { CookieJar, requestContext } from './request-context';

export type ApiResult<T = any> = {
  status: number;
  body: { success: boolean; message: Record<'pt-br' | 'es-mx' | 'en-us', string>; data: T };
};

type Handler = (request: Request, context: { params: Promise<any> }) => Promise<Response>;

/** Chama um Route Handler como o Next chamaria, com os cookies de `jar`. */
export async function invoke<T = any>(jar: CookieJar, handler: Handler, options: {
  params?: Record<string, string>;
  body?: unknown;
  rawBody?: string;
  headers?: Record<string, string>;
} = {}): Promise<ApiResult<T>> {
  const hasBody = options.body !== undefined || options.rawBody !== undefined;
  const request = new Request('http://cross-poker.test/api', {
    method: hasBody ? 'POST' : 'GET',
    headers: { 'content-type': 'application/json', ...options.headers },
    body: options.rawBody ?? (hasBody ? JSON.stringify(options.body) : undefined),
  });

  const response = await requestContext.run(
    { jar, headers: new Headers(options.headers) },
    () => handler(request, { params: Promise.resolve(options.params ?? {}) }),
  );

  return { status: response.status, body: await response.json() };
}

/** Um jogador com seu próprio "navegador" (cookie jar). */
export class Client {
  jar = new CookieJar();

  constructor(public name: string) {}

  createRoom(name: string | undefined = this.name, headers?: Record<string, string>) {
    return invoke<IRoomState>(this.jar, roomsRoute.POST, { body: { name }, headers });
  }

  getRoom(code: string) {
    return invoke<IRoomState>(this.jar, roomRoute.GET, { params: { code } });
  }

  join(code: string, name: string | undefined = this.name) {
    return invoke<IRoomState>(this.jar, joinRoute.POST, { params: { code }, body: { name } });
  }

  start(code: string) {
    return invoke<{ game_id: number }>(this.jar, startRoute.POST, { params: { code }, body: {} });
  }

  game(gameId: number) {
    return invoke<IGameState>(this.jar, gameRoute.GET, { params: { gameId: String(gameId) } });
  }

  async state(gameId: number): Promise<IGameState> {
    const result = await this.game(gameId);

    expect(result.status, JSON.stringify(result.body)).toBe(200);

    return result.body.data;
  }

  meld(gameId: number, cards: string[], source: unknown = 'deck') {
    return invoke<null>(this.jar, meldRoute.POST, { params: { gameId: String(gameId) }, body: { cards, source } });
  }

  discard(gameId: number, cards: string[], source: unknown = 'deck') {
    return invoke<null>(this.jar, discardRoute.POST, { params: { gameId: String(gameId) }, body: { cards, source } });
  }

  startSwap(gameId: number, quantity: unknown) {
    return invoke<null>(this.jar, swapStartRoute.POST, { params: { gameId: String(gameId) }, body: { quantity } });
  }

  chooseSwap(gameId: number, cards: string[]) {
    return invoke<{ waiting_for_partner: boolean }>(this.jar, swapChooseRoute.POST, { params: { gameId: String(gameId) }, body: { cards } });
  }
}

export const routes = { roomStreamRoute, gameStreamRoute, roomsRoute, joinRoute, startRoute, meldRoute, discardRoute, swapStartRoute, swapChooseRoute, gameRoute, roomRoute };

/** Sala com os 4 jogadores (assentos 0..3, na ordem) e a Partida iniciada. */
export async function startedGame() {
  const players = ['Ana', 'Bruno', 'Carla', 'Diego'].map((name) => new Client(name));
  const created = await players[0].createRoom();
  const code = created.body.data.room.code;

  for (const player of players.slice(1)) {
    expect((await player.join(code)).status).toBe(201);
  }

  const started = await players[0].start(code);

  expect(started.status).toBe(200);

  return { code, gameId: started.body.data.game_id, players };
}

type PlayerRig = Partial<{ hand: string[]; melds_remaining: number; discards_remaining: number; score: number }>;

/**
 * Deixa a Partida num estado conhecido (mãos, pilhas, vez), escrevendo direto no banco — para os
 * testes não dependerem do embaralhamento.
 */
export async function rig(gameId: number, setup: {
  currentSeat?: number;
  deck?: string[];
  discard?: string[];
  meldPile?: string[];
  pendingSwap?: unknown;
  lastActionAt?: Date | null;
  createdAt?: Date;
  players?: Record<number, PlayerRig>;
}) {
  const gameChanges: Partial<typeof games.$inferInsert> = {};

  if (setup.currentSeat !== undefined) gameChanges.current_seat = setup.currentSeat;
  if (setup.deck) gameChanges.deck = setup.deck;
  if (setup.discard) gameChanges.discard = setup.discard;
  if (setup.meldPile) gameChanges.meld_pile = setup.meldPile;
  if (setup.pendingSwap !== undefined) gameChanges.pending_swap = setup.pendingSwap;
  if (setup.lastActionAt !== undefined) gameChanges.last_action_at = setup.lastActionAt;
  if (setup.createdAt) gameChanges.created_at = setup.createdAt;

  if (Object.keys(gameChanges).length) await db.update(games).set(gameChanges).where(eq(games.id, gameId));

  for (const [seat, changes] of Object.entries(setup.players ?? {})) {
    await db.update(gamePlayers).set(changes).where(and(eq(gamePlayers.game_id, gameId), eq(gamePlayers.seat, Number(seat))));
  }
}

export async function gameRow(gameId: number) {
  const [row] = await db.select().from(games).where(eq(games.id, gameId));

  return row;
}

export async function playerRow(gameId: number, seat: number) {
  const [row] = await db.select().from(gamePlayers).where(and(eq(gamePlayers.game_id, gameId), eq(gamePlayers.seat, seat)));

  return row;
}

/** `ids('hearts-A', 'spades-10')` → ids do baralho único. */
export const ids = (...shortIds: string[]) => shortIds.map((id) => `${id}-1`);

/**
 * Mesa conhecida: as mãos indicadas, Descarte/Bolo indicados, e o Monte com as cartas que sobram
 * (na ordem de `buildDeck`; o topo é o último). `deckSize` corta o Monte (as demais ficam fora do jogo).
 */
export async function layout(gameId: number, setup: {
  hands: Record<number, string[]>;
  discard?: string[];
  meldPile?: string[];
  deckSize?: number;
  currentSeat?: number;
  players?: Record<number, Omit<PlayerRig, 'hand'>>;
}) {
  const used = new Set([...Object.values(setup.hands).flat(), ...(setup.discard ?? []), ...(setup.meldPile ?? [])]);
  const rest = buildDeck().map((card) => card.id).filter((id) => !used.has(id));
  const deck = setup.deckSize === undefined ? rest : rest.slice(rest.length - setup.deckSize);
  const players: Record<number, PlayerRig> = {};

  for (const seat of [0, 1, 2, 3]) players[seat] = { ...setup.players?.[seat], ...(setup.hands[seat] ? { hand: setup.hands[seat] } : {}) };

  await rig(gameId, {
    currentSeat: setup.currentSeat ?? 0,
    deck,
    discard: setup.discard ?? [],
    meldPile: setup.meldPile ?? [],
    players,
  });

  return { deck };
}

/** Mãos fixas usadas na maioria dos testes (8 cartas cada, sem repetição). */
export const HANDS: Record<number, string[]> = {
  0: ids('hearts-8', 'spades-8', 'hearts-2', 'hearts-3', 'hearts-4', 'clubs-K', 'diamonds-3', 'spades-5'),
  1: ids('clubs-A', 'clubs-2', 'clubs-3', 'clubs-4', 'clubs-5', 'clubs-6', 'clubs-7', 'clubs-8'),
  2: ids('diamonds-A', 'diamonds-2', 'diamonds-4', 'diamonds-5', 'diamonds-6', 'diamonds-7', 'diamonds-8', 'diamonds-9'),
  3: ids('spades-A', 'spades-2', 'spades-3', 'spades-4', 'spades-6', 'spades-7', 'spades-9', 'spades-10'),
};
