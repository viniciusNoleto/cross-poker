import 'server-only';

import { and, eq } from 'drizzle-orm';
import { db } from './db';
import { games, rooms, gamePlayers } from '@/db/schema';
import { getCurrentRoomPlayer } from './roomAuth';

// Resolves, from the Sala session cookie, which `game_players` row (if any) corresponds
// to the player making the request for this Partida. Use this in every action route
// (Meld, Discard, Swap, Draw) to figure out "who am I" and "is it my turn" — never trust
// a `seat`/`player_id` coming from the request body.
export async function getCurrentGamePlayer(gameId: number) {
  const [game] = await db.select().from(games).where(eq(games.id, gameId));

  if (!game) return { game: null, room: null, roomPlayer: null, gamePlayer: null };

  const [room] = await db.select().from(rooms).where(eq(rooms.id, game.room_id));

  if (!room) return { game, room: null, roomPlayer: null, gamePlayer: null };

  const roomPlayer = await getCurrentRoomPlayer(room.code, room.id);

  if (!roomPlayer) return { game, room, roomPlayer: null, gamePlayer: null };

  const [gamePlayer] = await db
    .select()
    .from(gamePlayers)
    .where(and(eq(gamePlayers.game_id, gameId), eq(gamePlayers.seat, roomPlayer.seat)));

  return { game, room, roomPlayer, gamePlayer: gamePlayer ?? null };
}
