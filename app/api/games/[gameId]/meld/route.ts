import { db } from '@/libs/db';
import { games, gamePlayers } from '@/db/schema';
import { getCurrentGamePlayer } from '@/libs/gameAuth';
import { publish } from '@/libs/realtime';
import { cardById } from '@/resources/game/models/Card';
import { bestCombo } from '@/resources/game/models/Combo';
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
    const cards: string[] = Array.isArray(body.cards) ? body.cards : [];

    const { game, gamePlayer } = await getCurrentGamePlayer(gameId);

    if (!game) {
      return NextResponse.json({ success: false, message: { 'pt-br': 'Partida não encontrada.', 'es-mx': 'Partida no encontrada.', 'en-us': 'Game not found.' }, data: null }, { status: 404 });
    }

    if (!gamePlayer) {
      return NextResponse.json({ success: false, message: { 'pt-br': 'Você não faz parte desta partida.', 'es-mx': 'No formas parte de esta partida.', 'en-us': 'You are not part of this game.' }, data: null }, { status: 403 });
    }

    if (game.status !== EGameStatus.PLAYING) {
      return NextResponse.json({ success: false, message: { 'pt-br': 'Esta partida já terminou.', 'es-mx': 'Esta partida ya terminó.', 'en-us': 'This game has already finished.' }, data: null }, { status: 409 });
    }

    if (game.current_seat !== gamePlayer.seat) {
      return NextResponse.json({ success: false, message: { 'pt-br': 'Não é a sua vez de jogar.', 'es-mx': 'No es tu turno.', 'en-us': 'It is not your turn.' }, data: null }, { status: 403 });
    }

    if (game.pending_swap !== null) {
      return NextResponse.json({ success: false, message: { 'pt-br': 'Existe uma Troca pendente nesta partida.', 'es-mx': 'Hay un Cambio pendiente en esta partida.', 'en-us': 'There is a pending Swap in this game.' }, data: null }, { status: 409 });
    }

    if (game.pending_draw !== null) {
      return NextResponse.json({ success: false, message: { 'pt-br': 'Há uma compra pendente nesta partida. Aguarde a resolução antes de jogar.', 'es-mx': 'Hay una compra pendiente en esta partida. Espera a que se resuelva antes de jugar.', 'en-us': 'There is a pending draw in this game. Wait for it to be resolved before playing.' }, data: null }, { status: 409 });
    }

    if (gamePlayer.melds_remaining <= 0) {
      return NextResponse.json({ success: false, message: { 'pt-br': 'Você não possui Mesas restantes.', 'es-mx': 'No te quedan Mesas disponibles.', 'en-us': 'You have no Table plays left.' }, data: null }, { status: 422 });
    }

    const hand = gamePlayer.hand as string[];
    const uniqueCards = new Set(cards);
    const validCards = cards.length >= 1
      && cards.length <= 5
      && uniqueCards.size === cards.length
      && cards.every((cardId) => hand.includes(cardId));

    if (!validCards) {
      return NextResponse.json({ success: false, message: { 'pt-br': 'Seleção de cartas inválida.', 'es-mx': 'Selección de cartas inválida.', 'en-us': 'Invalid card selection.' }, data: null }, { status: 422 });
    }

    const meldedCards = cards.map(cardById);
    const { type, scoringCards, chips, multiplier, points } = bestCombo(meldedCards);

    const remainingHand = hand.filter((cardId) => !uniqueCards.has(cardId));
    const newMeldsRemaining = gamePlayer.melds_remaining - 1;
    const newScore = gamePlayer.score + points;

    const pendingDraw: IPendingDraw = {
      seat: gamePlayer.seat,
      quantity: cards.length,
      action_type: EActionType.MELD,
      details: {
        melded_cards: cards,
        combo: type,
        scoring_cards: scoringCards.map((card) => card.id),
        chips,
        multiplier,
        points,
      },
    };

    // The draw (Deck/Discard) only happens in the second step (`POST .../draw`) — see
    // game-concept.md, "Compra após a ação". The played cards only enter the Discard pile once
    // that step resolves, so the player can't draw from the Discard pile the very cards they
    // just played in this same action. Here we only apply what the play itself already decided:
    // remove from the hand, decrement Melds, add up the score.
    await db.update(games).set({
      pending_draw: pendingDraw,
    }).where(eq(games.id, gameId));

    await db.update(gamePlayers).set({
      hand: remainingHand,
      melds_remaining: newMeldsRemaining,
      score: newScore,
    }).where(eq(gamePlayers.id, gamePlayer.id));

    publish(`game:${gameId}`);

    return NextResponse.json({
      success: true,
      message: { 'pt-br': 'Mesa jogada com sucesso.', 'es-mx': 'Mesa jugada con éxito.', 'en-us': 'Table played successfully.' },
      data: {
        points_scored: points, combo: type, melded_cards: meldedCards, scoring_cards: scoringCards, chips, multiplier,
      },
    });
  } catch (e) {
    console.error(e);

    return NextResponse.json({ success: false, message: { 'pt-br': 'Erro ao jogar a Mesa.', 'es-mx': 'Error al jugar la Mesa.', 'en-us': 'Error playing the Table.' }, data: null }, { status: 500 });
  }
}
