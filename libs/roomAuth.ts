import 'server-only';

import { and, eq } from 'drizzle-orm';
import { db } from './db';
import { roomPlayers, roomPlayerPublicColumns } from '@/db/schema';
import { getRoomSessionToken } from './session';

export async function getCurrentRoomPlayer(roomCode: string, roomId: number) {
  const token = await getRoomSessionToken(roomCode);

  if (!token) return null;

  const [player] = await db
    .select(roomPlayerPublicColumns)
    .from(roomPlayers)
    .where(and(eq(roomPlayers.room_id, roomId), eq(roomPlayers.session_token, token)));

  return player ?? null;
}
