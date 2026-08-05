import { db } from '@/libs/db';
import { rooms, roomPlayers, roomPlayerPublicColumns } from '@/db/schema';
import { getCurrentRoomPlayer } from '@/libs/roomAuth';
import { setRoomSessionCookie } from '@/libs/session';
import { publish } from '@/libs/realtime';
import { ERoomStatus } from '@/resources/room/enums/ERoomStatus';
import { eq } from 'drizzle-orm';
import { NextResponse } from 'next/server';

const TOTAL_SEATS = 4;

export async function POST(request: Request, { params }: { params: Promise<{ code: string }> }) {
  try {
    const { code } = await params;
    const roomCode = code.toUpperCase();
    const body = await request.json();
    const name = String(body.name ?? '').trim();

    const [room] = await db.select().from(rooms).where(eq(rooms.code, roomCode));

    if (!room) {
      return NextResponse.json({ success: false, message: { 'pt-br': 'Sala não encontrada.', 'es-mx': 'Sala no encontrada.', 'en-us': 'Room not found.' }, data: null }, { status: 404 });
    }

    const existingYou = await getCurrentRoomPlayer(roomCode, room.id);

    if (existingYou) {
      const players = await db
        .select(roomPlayerPublicColumns)
        .from(roomPlayers)
        .where(eq(roomPlayers.room_id, room.id))
        .orderBy(roomPlayers.seat);

      return NextResponse.json({
        success: true,
        message: { 'pt-br': 'Você já está nesta sala.', 'es-mx': 'Ya estás en esta sala.', 'en-us': 'You are already in this room.' },
        data: { room, players, you: existingYou, game_id: null },
      });
    }

    if (!name) {
      return NextResponse.json({ success: false, message: { 'pt-br': 'Informe seu nome.', 'es-mx': 'Ingresa tu nombre.', 'en-us': 'Enter your name.' }, data: null }, { status: 422 });
    }

    if (room.status !== ERoomStatus.WAITING) {
      return NextResponse.json({ success: false, message: { 'pt-br': 'Esta sala já iniciou a partida.', 'es-mx': 'Esta sala ya inició la partida.', 'en-us': 'This room already started the game.' }, data: null }, { status: 409 });
    }

    const currentPlayers = await db
      .select(roomPlayerPublicColumns)
      .from(roomPlayers)
      .where(eq(roomPlayers.room_id, room.id))
      .orderBy(roomPlayers.seat);

    if (currentPlayers.length >= TOTAL_SEATS) {
      return NextResponse.json({ success: false, message: { 'pt-br': 'Esta sala já está cheia.', 'es-mx': 'Esta sala ya está llena.', 'en-us': 'This room is already full.' }, data: null }, { status: 409 });
    }

    const takenSeats = new Set(currentPlayers.map((player) => player.seat));
    let seat = 0;
    while (takenSeats.has(seat)) seat++;

    const now = new Date();
    const sessionToken = crypto.randomUUID();

    const [player] = await db.insert(roomPlayers).values({
      room_id: room.id,
      name,
      seat,
      session_token: sessionToken,
      is_host: false,
      connected_at: now,
      created_at: now,
    }).returning(roomPlayerPublicColumns);

    await setRoomSessionCookie(roomCode, sessionToken);

    publish(`room:${roomCode}`);

    return NextResponse.json({
      success: true,
      message: { 'pt-br': 'Você entrou na sala.', 'es-mx': 'Entraste a la sala.', 'en-us': 'You joined the room.' },
      data: { room, players: [...currentPlayers, player], you: player, game_id: null },
    }, { status: 201 });
  } catch (e) {
    console.error(e);

    return NextResponse.json({ success: false, message: { 'pt-br': 'Erro ao entrar na sala.', 'es-mx': 'Error al entrar a la sala.', 'en-us': 'Error joining room.' }, data: null }, { status: 500 });
  }
}
