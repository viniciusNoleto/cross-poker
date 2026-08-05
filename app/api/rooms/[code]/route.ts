import { db } from '@/libs/db';
import { rooms, roomPlayers, roomPlayerPublicColumns, games } from '@/db/schema';
import { getCurrentRoomPlayer } from '@/libs/roomAuth';
import { desc, eq } from 'drizzle-orm';
import { NextResponse } from 'next/server';

export async function GET(_request: Request, { params }: { params: Promise<{ code: string }> }) {
  try {
    const { code } = await params;
    const roomCode = code.toUpperCase();

    const [room] = await db.select().from(rooms).where(eq(rooms.code, roomCode));

    if (!room) {
      return NextResponse.json({ success: false, message: { 'pt-br': 'Sala não encontrada.', 'es-mx': 'Sala no encontrada.', 'en-us': 'Room not found.' }, data: null }, { status: 404 });
    }

    const players = await db
      .select(roomPlayerPublicColumns)
      .from(roomPlayers)
      .where(eq(roomPlayers.room_id, room.id))
      .orderBy(roomPlayers.seat);

    const you = await getCurrentRoomPlayer(roomCode, room.id);

    const [latestGame] = await db
      .select({ id: games.id })
      .from(games)
      .where(eq(games.room_id, room.id))
      .orderBy(desc(games.id))
      .limit(1);

    return NextResponse.json({
      success: true,
      message: { 'pt-br': 'Operação realizada com sucesso.', 'es-mx': 'Operación realizada con éxito.', 'en-us': 'Operation completed successfully.' },
      data: { room, players, you, game_id: latestGame?.id ?? null },
    });
  } catch (e) {
    console.error(e);

    return NextResponse.json({ success: false, message: { 'pt-br': 'Erro ao buscar sala.', 'es-mx': 'Error al buscar la sala.', 'en-us': 'Error fetching room.' }, data: null }, { status: 500 });
  }
}
