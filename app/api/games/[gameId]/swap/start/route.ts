import { db } from '@/libs/db';
import { gamePlayers, games } from '@/db/schema';
import { getCurrentGamePlayer } from '@/libs/gameAuth';
import { publish } from '@/libs/realtime';
import { EGameStatus } from '@/resources/game/enums/EGameStatus';
import { IPendingSwap } from '@/resources/game/models/Swap';
import { and, eq } from 'drizzle-orm';
import { NextResponse } from 'next/server';

const TOTAL_SEATS = 4;
const MIN_QUANTITY = 1;
const MAX_QUANTITY = 5;

export async function POST(request: Request, { params }: { params: Promise<{ gameId: string }> }) {
  try {
    const { gameId: gameIdParam } = await params;
    const gameId = Number(gameIdParam);
    const body = await request.json();
    const quantity = Number(body.quantity);

    const { game, room, roomPlayer, gamePlayer } = await getCurrentGamePlayer(gameId);

    if (!game || !room) {
      return NextResponse.json({ success: false, message: { 'pt-br': 'Partida não encontrada.', 'es-mx': 'Partida no encontrada.', 'en-us': 'Game not found.' }, data: null }, { status: 404 });
    }

    if (!roomPlayer || !gamePlayer) {
      return NextResponse.json({ success: false, message: { 'pt-br': 'Você não é um jogador desta partida.', 'es-mx': 'No eres un jugador de esta partida.', 'en-us': 'You are not a player in this game.' }, data: null }, { status: 403 });
    }

    if (game.status !== EGameStatus.PLAYING) {
      return NextResponse.json({ success: false, message: { 'pt-br': 'Esta partida não está em andamento.', 'es-mx': 'Esta partida no está en curso.', 'en-us': 'This game is not in progress.' }, data: null }, { status: 409 });
    }

    if (game.current_seat !== gamePlayer.seat) {
      return NextResponse.json({ success: false, message: { 'pt-br': 'Não é a sua vez de jogar.', 'es-mx': 'No es tu turno.', 'en-us': "It's not your turn." }, data: null }, { status: 403 });
    }

    if (game.pending_swap !== null) {
      return NextResponse.json({ success: false, message: { 'pt-br': 'Já há uma troca em andamento.', 'es-mx': 'Ya hay un intercambio en curso.', 'en-us': 'A swap is already in progress.' }, data: null }, { status: 409 });
    }

    if (game.pending_draw !== null) {
      return NextResponse.json({ success: false, message: { 'pt-br': 'Há uma compra pendente nesta partida. Aguarde a resolução antes de iniciar uma Troca.', 'es-mx': 'Hay una compra pendiente en esta partida. Espera a que se resuelva antes de iniciar un Cambio.', 'en-us': 'There is a pending draw in this game. Wait for it to be resolved before starting a Swap.' }, data: null }, { status: 409 });
    }

    if (!Number.isInteger(quantity) || quantity < MIN_QUANTITY || quantity > MAX_QUANTITY) {
      return NextResponse.json({ success: false, message: { 'pt-br': 'Escolha entre 1 e 5 cartas para trocar.', 'es-mx': 'Elige entre 1 y 5 cartas para intercambiar.', 'en-us': 'Choose between 1 and 5 cards to swap.' }, data: null }, { status: 422 });
    }

    const partnerSeat = (gamePlayer.seat + 2) % TOTAL_SEATS;

    const [partnerPlayer] = await db
      .select()
      .from(gamePlayers)
      .where(and(eq(gamePlayers.game_id, gameId), eq(gamePlayers.seat, partnerSeat)));

    if (!partnerPlayer || gamePlayer.discards_remaining < 1 || partnerPlayer.discards_remaining < 1) {
      return NextResponse.json({ success: false, message: { 'pt-br': 'Ambos os parceiros precisam ter ao menos 1 Bolo disponível.', 'es-mx': 'Ambos compañeros deben tener al menos 1 Bolo disponible.', 'en-us': 'Both partners need at least 1 Bolo available.' }, data: null }, { status: 422 });
    }

    const pendingSwap: IPendingSwap = {
      initiator_seat: gamePlayer.seat,
      partner_seat: partnerSeat,
      quantity,
      initiator_cards: null,
      partner_cards: null,
    };

    await db.update(games).set({ pending_swap: pendingSwap }).where(eq(games.id, gameId));

    publish(`game:${gameId}`);

    return NextResponse.json({
      success: true,
      message: { 'pt-br': 'Troca iniciada. Aguardando as cartas dos dois parceiros.', 'es-mx': 'Intercambio iniciado. Esperando las cartas de ambos compañeros.', 'en-us': 'Swap started. Waiting for both partners’ cards.' },
      data: null,
    });
  } catch (e) {
    console.error(e);

    return NextResponse.json({ success: false, message: { 'pt-br': 'Erro ao iniciar a troca.', 'es-mx': 'Error al iniciar el intercambio.', 'en-us': 'Error starting the swap.' }, data: null }, { status: 500 });
  }
}
