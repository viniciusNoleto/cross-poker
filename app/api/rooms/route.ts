import { db } from '@/libs/db';
import { rooms, roomPlayers, roomPlayerPublicColumns } from '@/db/schema';
import { ERoomStatus } from '@/resources/room/enums/ERoomStatus';
import { setRoomSessionCookie } from '@/libs/session';
import { eq } from 'drizzle-orm';
import { NextResponse } from 'next/server';

const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

function generateRoomCode(): string {
  let code = '';

  for (let i = 0; i < 6; i++) code += CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)];

  return code;
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const name = String(body.name ?? '').trim();

    if (!name) {
      return NextResponse.json({ success: false, message: { 'pt-br': 'Informe seu nome.', 'es-mx': 'Ingresa tu nombre.', 'en-us': 'Enter your name.' }, data: null }, { status: 422 });
    }

    let code = generateRoomCode();

    for (let attempts = 0; attempts < 5; attempts++) {
      const existing = await db.select({ id: rooms.id }).from(rooms).where(eq(rooms.code, code));
      if (existing.length === 0) break;
      code = generateRoomCode();
    }

    const now = new Date();

    const [room] = await db.insert(rooms).values({
      code,
      status: ERoomStatus.WAITING,
      created_at: now,
    }).returning();

    const sessionToken = crypto.randomUUID();

    const [player] = await db.insert(roomPlayers).values({
      room_id: room.id,
      name,
      seat: 0,
      session_token: sessionToken,
      is_host: true,
      connected_at: now,
      created_at: now,
    }).returning(roomPlayerPublicColumns);

    await setRoomSessionCookie(room.code, sessionToken);

    return NextResponse.json({
      success: true,
      message: { 'pt-br': 'Sala criada com sucesso.', 'es-mx': 'Sala creada con éxito.', 'en-us': 'Room created successfully.' },
      data: { room, players: [player], you: player, game_id: null },
    }, { status: 201 });
  } catch (e) {
    console.error(e);

    return NextResponse.json({ success: false, message: { 'pt-br': 'Erro ao criar sala.', 'es-mx': 'Error al crear la sala.', 'en-us': 'Error creating room.' }, data: null }, { status: 500 });
  }
}
