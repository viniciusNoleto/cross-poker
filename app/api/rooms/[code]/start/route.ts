import { db } from '@/libs/db';
import { rooms, roomPlayers, roomPlayerPublicColumns, games, gamePlayers } from '@/db/schema';
import { getCurrentRoomPlayer } from '@/libs/roomAuth';
import { publish } from '@/libs/realtime';
import { ERoomStatus } from '@/resources/room/enums/ERoomStatus';
import { EGameStatus } from '@/resources/game/enums/EGameStatus';
import { buildDeck, shuffle } from '@/resources/game/models/Deck';
import { eq } from 'drizzle-orm';
import { NextResponse } from 'next/server';

const TOTAL_PLAYERS = 4;
const INITIAL_HAND_SIZE = 8;
const INITIAL_MELDS = 5;
const INITIAL_DISCARDS = 5;

export async function POST(_request: Request, { params }: { params: Promise<{ code: string }> }) {
  try {
    const { code } = await params;
    const roomCode = code.toUpperCase();

    const [room] = await db.select().from(rooms).where(eq(rooms.code, roomCode));

    if (!room) {
      return NextResponse.json({ success: false, message: { 'pt-br': 'Sala não encontrada.', 'es-mx': 'Sala no encontrada.', 'en-us': 'Room not found.' }, data: null }, { status: 404 });
    }

    const you = await getCurrentRoomPlayer(roomCode, room.id);

    if (!you || !you.is_host) {
      return NextResponse.json({ success: false, message: { 'pt-br': 'Apenas o dono da sala pode iniciar a partida.', 'es-mx': 'Solo el anfitrión puede iniciar la partida.', 'en-us': 'Only the host can start the game.' }, data: null }, { status: 403 });
    }

    if (room.status !== ERoomStatus.WAITING) {
      return NextResponse.json({ success: false, message: { 'pt-br': 'Esta sala já iniciou a partida.', 'es-mx': 'Esta sala ya inició la partida.', 'en-us': 'This room already started the game.' }, data: null }, { status: 409 });
    }

    const players = await db
      .select(roomPlayerPublicColumns)
      .from(roomPlayers)
      .where(eq(roomPlayers.room_id, room.id))
      .orderBy(roomPlayers.seat);

    if (players.length !== TOTAL_PLAYERS) {
      return NextResponse.json({ success: false, message: { 'pt-br': 'A partida só pode começar com 4 jogadores.', 'es-mx': 'La partida solo puede comenzar con 4 jugadores.', 'en-us': 'The game can only start with 4 players.' }, data: null }, { status: 422 });
    }

    const deck = shuffle(buildDeck());
    const hands: string[][] = [[], [], [], []];

    for (let i = 0; i < INITIAL_HAND_SIZE * TOTAL_PLAYERS; i++) {
      hands[i % TOTAL_PLAYERS].push(deck.pop()!.id);
    }

    const remainingDeck = deck.map((card) => card.id);
    const currentSeat = Math.floor(Math.random() * TOTAL_PLAYERS);
    const now = new Date();

    const [game] = await db.insert(games).values({
      room_id: room.id,
      status: EGameStatus.PLAYING,
      current_seat: currentSeat,
      deck: remainingDeck,
      discard: [],
      meld_pile: [],
      last_action_at: now,
      created_at: now,
    }).returning();

    await db.insert(gamePlayers).values(
      players.map((player) => ({
        game_id: game.id,
        seat: player.seat,
        hand: hands[player.seat],
        melds_remaining: INITIAL_MELDS,
        discards_remaining: INITIAL_DISCARDS,
        score: 0,
      })),
    );

    await db.update(rooms).set({ status: ERoomStatus.PLAYING }).where(eq(rooms.id, room.id));

    publish(`room:${roomCode}`);

    return NextResponse.json({
      success: true,
      message: { 'pt-br': 'Partida iniciada com sucesso.', 'es-mx': 'Partida iniciada con éxito.', 'en-us': 'Game started successfully.' },
      data: { game_id: game.id },
    });
  } catch (e) {
    console.error(e);

    return NextResponse.json({ success: false, message: { 'pt-br': 'Erro ao iniciar a partida.', 'es-mx': 'Error al iniciar la partida.', 'en-us': 'Error starting the game.' }, data: null }, { status: 500 });
  }
}
