// Inactivity sweeper: closes every Partida still being played whose last action (Jogada,
// Descarte, Troca or Compra — `games.last_action_at`, falling back to `created_at`) is older than
// 1 hour. The winner is decided by the score at that moment (tie → no winner), with
// `finish_reason = 'inactivity'`. Started once per server process from `instrumentation.ts`.
import { and, eq, lt, sql } from 'drizzle-orm';
import { db } from './database';
import { games, gamePlayers } from '../db/schema';
import { finishGame } from './gameFinish';
import { publish } from './realtimeHub';
import { EGameStatus } from '../resources/game/enums/EGameStatus';
import { EFinishReason } from '../resources/game/enums/EFinishReason';

const INACTIVITY_LIMIT_MS = 60 * 60 * 1000;
const SWEEP_INTERVAL_MS = 5 * 60 * 1000;

export async function closeStaleGames(): Promise<number> {
  const threshold = new Date(Date.now() - INACTIVITY_LIMIT_MS);

  const staleGames = await db
    .select({ id: games.id, room_id: games.room_id })
    .from(games)
    .where(and(
      eq(games.status, EGameStatus.PLAYING),
      lt(sql`COALESCE(${games.last_action_at}, ${games.created_at})`, threshold),
    ));

  for (const game of staleGames) {
    await db.transaction(async (tx) => {
      // Re-check under lock: someone may have played between the select and now.
      const [fresh] = await tx.select().from(games).where(eq(games.id, game.id)).for('update');
      const lastActivity = fresh?.last_action_at ?? fresh?.created_at;

      if (!fresh || fresh.status !== EGameStatus.PLAYING || (lastActivity && lastActivity >= threshold)) return;

      const players = await tx.select().from(gamePlayers).where(eq(gamePlayers.game_id, game.id));

      await finishGame(tx, { gameId: game.id, roomId: game.room_id, players, reason: EFinishReason.INACTIVITY });
    });

    publish(`game:${game.id}`);
  }

  return staleGames.length;
}

const globalForSweeper = globalThis as typeof globalThis & { __crossPokerStaleSweeper?: ReturnType<typeof setInterval> };

export function startStaleGameSweeper() {
  if (globalForSweeper.__crossPokerStaleSweeper) return;

  async function sweep() {
    try {
      const closed = await closeStaleGames();

      if (closed > 0) console.log(`[stale-games] ${closed} partida(s) encerrada(s) por inatividade.`);
    } catch (error) {
      console.error('[stale-games] Falha ao encerrar partidas inativas:', error);
    }
  }

  globalForSweeper.__crossPokerStaleSweeper = setInterval(sweep, SWEEP_INTERVAL_MS);
  sweep();
}
