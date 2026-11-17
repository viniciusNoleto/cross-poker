// Shared "end the Partida" write — used by the action routes (Compra, Troca) and by the
// inactivity sweeper. No `server-only` guard: the sweeper runs from `instrumentation.ts`.
import { eq } from 'drizzle-orm';
import { db } from './database';
import { games, rooms } from '../db/schema';
import { winningTeam } from '../resources/game/models/Turn';
import { EGameStatus } from '../resources/game/enums/EGameStatus';
import { ERoomStatus } from '../resources/room/enums/ERoomStatus';
import type { EFinishReason } from '../resources/game/enums/EFinishReason';

type Executor = Pick<typeof db, 'update'>;

export async function finishGame(executor: Executor, { gameId, roomId, players, reason }: {
  gameId: number;
  roomId: number;
  players: Array<{ seat: number; score: number }>;
  reason: `${EFinishReason}`;
}) {
  const now = new Date();

  await executor.update(games)
    .set({
      status: EGameStatus.FINISHED,
      winning_team: winningTeam(players),
      finish_reason: reason,
      pending_swap: null,
      finished_at: now,
      last_action_at: now,
    })
    .where(eq(games.id, gameId));

  await executor.update(rooms)
    .set({ status: ERoomStatus.FINISHED })
    .where(eq(rooms.id, roomId));
}
