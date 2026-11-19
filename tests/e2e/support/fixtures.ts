import { type APIResponse, type Browser, type BrowserContext, expect, type Page, test as base } from '@playwright/test';
import pg from 'pg';
import { testDatabaseEnv } from '../../support/database-env.mjs';
import type { IGameState } from '@/resources/game/models/GameState';

/** Como a carta se apresenta na tela (`aria-label` do `Card`). */
const SUIT_NAME: Record<string, string> = { hearts: 'copas', diamonds: 'ouros', clubs: 'paus', spades: 'espadas' };

/** `'hearts-8'` → nome acessível da carta na tela (`'8 de copas'`). */
export function cardName(shortId: string) {
  const [suit, rank] = shortId.split('-');

  return `${rank} de ${SUIT_NAME[suit]}`;
}

/** `ids('hearts-A', 'spades-10')` → ids do baralho único. */
export const ids = (...shortIds: string[]) => shortIds.map((id) => `${id}-1`);

export async function ok(response: APIResponse): Promise<any> {
  expect(response.ok(), await response.text()).toBeTruthy();

  return response.json();
}

/** Um jogador: o seu próprio contexto de navegador (cookies próprios) e a sua aba. */
export type Seat = { seat: number; name: string; context: BrowserContext; page: Page };

export type Table = {
  code: string;
  gameId: number;
  seats: Seat[];
  /** Snapshot da Partida visto por um assento (pela API, com os cookies dele). */
  state: (seat: number) => Promise<IGameState>;
};

const NAMES = ['Ana', 'Bruno', 'Carla', 'Diego'];

async function newPlayer(browser: Browser, seat: number, baseURL: string): Promise<Seat> {
  const context = await browser.newContext({ baseURL });
  const page = await context.newPage();

  return { seat, name: NAMES[seat], context, page };
}

/** Sala cheia (Ana anfitriã no assento 0, depois Bruno, Carla, Diego) e Partida iniciada, tudo pela API. */
async function startTable(browser: Browser, baseURL: string): Promise<Table> {
  const seats = await Promise.all([0, 1, 2, 3].map((seat) => newPlayer(browser, seat, baseURL)));
  const created = await ok(await seats[0].context.request.post('/api/rooms', { data: { name: NAMES[0] } }));
  const code: string = created.data.room.code;

  for (const seat of seats.slice(1)) await ok(await seat.context.request.post(`/api/rooms/${code}/join`, { data: { name: seat.name } }));

  const started = await ok(await seats[0].context.request.post(`/api/rooms/${code}/start`, { data: {} }));
  const gameId: number = started.data.game_id;

  return {
    code,
    gameId,
    seats,
    state: async (seat) => (await ok(await seats[seat].context.request.get(`/api/games/${gameId}`))).data,
  };
}

let pool: pg.Pool | null = null;

/** Escreve direto no banco `_e2e` — para deixar a mesa num estado conhecido (mãos, vez, contadores). */
export async function sql(query: string, params: unknown[] = []) {
  pool ??= (() => {
    const env = testDatabaseEnv('e2e');

    return new pg.Pool({ host: env.POSTGRES_HOST, port: Number(env.POSTGRES_PORT), user: env.POSTGRES_USER, password: env.POSTGRES_PASSWORD, database: env.POSTGRES_DB, max: 2 });
  })();

  return pool.query(query, params);
}

/** Mãos fixas (8 cartas cada, sem repetição) e a vez no assento indicado. */
export const HANDS: Record<number, string[]> = {
  0: ids('hearts-8', 'spades-8', 'hearts-2', 'hearts-3', 'hearts-4', 'clubs-K', 'diamonds-3', 'spades-5'),
  1: ids('clubs-A', 'clubs-2', 'clubs-3', 'clubs-4', 'clubs-5', 'clubs-6', 'clubs-7', 'clubs-8'),
  2: ids('diamonds-A', 'diamonds-2', 'diamonds-4', 'diamonds-5', 'diamonds-6', 'diamonds-7', 'diamonds-8', 'diamonds-9'),
  3: ids('spades-A', 'spades-2', 'spades-3', 'spades-4', 'spades-6', 'spades-7', 'spades-9', 'spades-10'),
};

export async function rigTable(gameId: number, { currentSeat = 0, discard = [] as string[], players = {} as Record<number, { melds_remaining?: number; discards_remaining?: number; score?: number }> } = {}) {
  const used = new Set([...Object.values(HANDS).flat(), ...discard]);
  const suits = ['hearts', 'diamonds', 'clubs', 'spades'];
  const ranks = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];
  const deck = suits.flatMap((suit) => ranks.map((rank) => `${suit}-${rank}-1`)).filter((id) => !used.has(id));

  await sql('UPDATE games SET current_seat = $2, deck = $3, discard = $4, meld_pile = $5 WHERE id = $1', [gameId, currentSeat, JSON.stringify(deck), JSON.stringify(discard), '[]']);

  for (const seat of [0, 1, 2, 3]) {
    const changes = { melds_remaining: 5, discards_remaining: 5, score: 0, ...players[seat] };

    await sql(
      'UPDATE game_players SET hand = $3, melds_remaining = $4, discards_remaining = $5, score = $6 WHERE game_id = $1 AND seat = $2',
      [gameId, seat, JSON.stringify(HANDS[seat]), changes.melds_remaining, changes.discards_remaining, changes.score],
    );
  }

  return { deck };
}

/** A mão na tela de um jogador. */
export const handOf = (page: Page) => page.getByRole('region', { name: 'Sua mão' });

/** Abre a mesa na aba do jogador e espera a mão aparecer. */
export async function openTable(seat: Seat, gameId: number) {
  await seat.page.goto(`/games/${gameId}`);
  await expect(handOf(seat.page).getByRole('button', { name: / de (copas|ouros|paus|espadas)$/ }).first()).toBeVisible();
}

export async function pickCards(page: Page, shortIds: string[]) {
  for (const id of shortIds) await handOf(page).getByRole('button', { name: cardName(id), exact: true }).click();
}

export const test = base.extend<{ table: Table }>({
  // `provide` é o `use` das fixtures do Playwright (renomeado para o lint não confundir com o hook do React).
  table: async ({ browser, baseURL }, provide) => {
    const table = await startTable(browser, baseURL!);

    await provide(table);

    await Promise.all(table.seats.map((seat) => seat.context.close()));
  },
});

export { expect };
