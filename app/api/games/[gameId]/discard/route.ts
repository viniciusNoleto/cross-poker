import { db } from '@/libs/db';
import { games, gamePlayers } from '@/db/schema';
import { getCurrentGamePlayer } from '@/libs/gameAuth';
import { publish } from '@/libs/realtime';
import { IPendingDraw } from '@/resources/game/models/PendingDraw';
import { EGameStatus } from '@/resources/game/enums/EGameStatus';
import { EActionType } from '@/resources/game/enums/EActionType';
import { eq } from 'drizzle-orm';
import { NextResponse } from 'next/server';

export async function POST(request: Request, { params }: { params: Promise<{ gameId: string }> }) {
  try {
    const { gameId: gameIdParam } = await params;
    const gameId = Number(gameIdParam);
    const body = await request.json();
    const cards: string[] = Array.isArray(body?.cards) ? body.cards : [];

    const { game, gamePlayer } = await getCurrentGamePlayer(gameId);

    if (!game) {
      return NextResponse.json({ success: false, message: { 'pt-br': 'Partida não encontrada.', 'es-mx': 'Partida no encontrada.', 'en-us': 'Game not found.' }, data: null }, { status: 404 });
    }

    if (!gamePlayer) {
      return NextResponse.json({ success: false, message: { 'pt-br': 'Você não faz parte desta partida.', 'es-mx': 'No formas parte de esta partida.', 'en-us': 'You are not part of this game.' }, data: null }, { status: 403 });
    }

    if (game.status !== EGameStatus.PLAYING) {
      return NextResponse.json({ success: false, message: { 'pt-br': 'Esta partida não está em andamento.', 'es-mx': 'Esta partida no está en curso.', 'en-us': 'This game is not in progress.' }, data: null }, { status: 409 });
    }

    if (game.current_seat !== gamePlayer.seat) {
      return NextResponse.json({ success: false, message: { 'pt-br': 'Não é a sua vez de jogar.', 'es-mx': 'No es tu turno.', 'en-us': 'It is not your turn.' }, data: null }, { status: 403 });
    }

    if (game.pending_swap !== null) {
      return NextResponse.json({ success: false, message: { 'pt-br': 'Há uma Troca pendente nesta partida. Aguarde a resolução antes de jogar.', 'es-mx': 'Hay un Troca pendiente en esta partida. Espera a que se resuelva antes de jugar.', 'en-us': 'There is a pending Troca in this game. Wait for it to be resolved before playing.' }, data: null }, { status: 409 });
    }

    if (game.pending_draw !== null) {
      return NextResponse.json({ success: false, message: { 'pt-br': 'Há uma compra pendente nesta partida. Aguarde a resolução antes de jogar.', 'es-mx': 'Hay una compra pendiente en esta partida. Espera a que se resuelva antes de jugar.', 'en-us': 'There is a pending draw in this game. Wait for it to be resolved before playing.' }, data: null }, { status: 409 });
    }

    if (gamePlayer.discards_remaining <= 0) {
      return NextResponse.json({ success: false, message: { 'pt-br': 'Você não possui mais Bolos disponíveis.', 'es-mx': 'Ya no tienes Bolos disponibles.', 'en-us': 'You have no Bolos left.' }, data: null }, { status: 422 });
    }

    const currentHand = gamePlayer.hand as string[];
    const uniqueIds = new Set(cards);

    if (cards.length < 1 || cards.length > 5 || uniqueIds.size !== cards.length) {
      return NextResponse.json({ success: false, message: { 'pt-br': 'Selecione de 1 a 5 cartas da sua mão, sem repetição, para descartar.', 'es-mx': 'Selecciona de 1 a 5 cartas de tu mano, sin repetir, para descartar.', 'en-us': 'Select 1 to 5 cards from your hand, without repeats, to discard.' }, data: null }, { status: 422 });
    }

    if (!cards.every((cardId) => currentHand.includes(cardId))) {
      return NextResponse.json({ success: false, message: { 'pt-br': 'Uma ou mais cartas selecionadas não estão na sua mão.', 'es-mx': 'Una o más cartas seleccionadas no están en tu mano.', 'en-us': 'One or more selected cards are not in your hand.' }, data: null }, { status: 422 });
    }

    const handWithoutDiscard = currentHand.filter((cardId) => !cards.includes(cardId));
    const newDiscardsRemaining = gamePlayer.discards_remaining - 1;

    const pendingDraw: IPendingDraw = {
      seat: gamePlayer.seat,
      quantity: cards.length,
      action_type: EActionType.DISCARD,
      details: { discarded_cards: cards },
    };

    // The draw (Deck/Discard) only happens in the second step (`POST .../draw`) — see
    // game-concept.md, "Compra após a ação". The discarded cards only enter the Discard pile
    // once that step resolves, so the player can't draw from the Discard pile the very cards
    // they just discarded in this same action. Here we only apply what the play itself already
    // decided: remove from the hand, decrement Discards.
    await db.update(gamePlayers)
      .set({ hand: handWithoutDiscard, discards_remaining: newDiscardsRemaining })
      .where(eq(gamePlayers.id, gamePlayer.id));

    await db.update(games)
      .set({ pending_draw: pendingDraw })
      .where(eq(games.id, gameId));

    publish(`game:${gameId}`);

    return NextResponse.json({
      success: true,
      message: { 'pt-br': 'Bolo jogado com sucesso.', 'es-mx': 'Bolo jugado con éxito.', 'en-us': 'Bolo played successfully.' },
      data: null,
    });
  } catch (e) {
    console.error(e);

    return NextResponse.json({ success: false, message: { 'pt-br': 'Erro ao jogar o Bolo.', 'es-mx': 'Error al jugar el Bolo.', 'en-us': 'Error playing the Bolo.' }, data: null }, { status: 500 });
  }
}
