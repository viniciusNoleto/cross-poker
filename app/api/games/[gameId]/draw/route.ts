import { db } from '@/libs/db';
import { gameActions, gamePlayers, games } from '@/db/schema';
import { getCurrentGamePlayer } from '@/libs/gameAuth';
import { publish } from '@/libs/realtime';
import { EGameStatus } from '@/resources/game/enums/EGameStatus';
import { EDrawSource } from '@/resources/game/enums/EDrawSource';
import { EActionType } from '@/resources/game/enums/EActionType';
import { drawCards } from '@/resources/game/models/Draw';
import { IPendingDraw } from '@/resources/game/models/PendingDraw';
import { winningTeam, gameShouldEnd, nextSeatWithAction } from '@/resources/game/models/Turn';
import { eq } from 'drizzle-orm';
import { NextResponse } from 'next/server';

type IDiscardPileEntry = { card_id: string; face_up: boolean };

export async function POST(request: Request, { params }: { params: Promise<{ gameId: string }> }) {
  try {
    const { gameId: gameIdParam } = await params;
    const gameId = Number(gameIdParam);
    const body = await request.json();
    const source: string = body?.source;

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

    const pendingDraw = game.pending_draw as IPendingDraw | null;

    if (!pendingDraw) {
      return NextResponse.json({ success: false, message: { 'pt-br': 'Não há compra pendente nesta partida.', 'es-mx': 'No hay ninguna compra pendiente en esta partida.', 'en-us': 'There is no pending draw in this game.' }, data: null }, { status: 409 });
    }

    if (pendingDraw.seat !== gamePlayer.seat) {
      return NextResponse.json({ success: false, message: { 'pt-br': 'Não é você quem precisa escolher a origem da compra.', 'es-mx': 'No eres tú quien debe elegir el origen de la compra.', 'en-us': "It is not you who needs to choose the draw's source." }, data: null }, { status: 403 });
    }

    if (source !== EDrawSource.DECK && source !== EDrawSource.DISCARD) {
      return NextResponse.json({ success: false, message: { 'pt-br': 'Escolha se a compra será do Monte ou do Bolo.', 'es-mx': 'Elige si la compra será del Monte o del Bolo.', 'en-us': 'Choose whether to draw from the Monte or the Bolo.' }, data: null }, { status: 422 });
    }

    const quantity = pendingDraw.quantity;
    const deckCount = (game.deck as string[]).length;
    const discardCount = (game.discard as IDiscardPileEntry[]).length;

    if (source === EDrawSource.DISCARD && discardCount < quantity) {
      return NextResponse.json({ success: false, message: { 'pt-br': 'O Bolo não tem cartas suficientes para esta compra.', 'es-mx': 'El Bolo no tiene cartas suficientes para esta compra.', 'en-us': 'The Bolo does not have enough cards for this draw.' }, data: null }, { status: 422 });
    }

    if (source === EDrawSource.DECK && (deckCount + discardCount) < quantity) {
      return NextResponse.json({ success: false, message: { 'pt-br': 'Não há cartas suficientes para completar esta compra.', 'es-mx': 'No hay cartas suficientes para completar esta compra.', 'en-us': 'There are not enough cards to complete this draw.' }, data: null }, { status: 422 });
    }

    const { drawnCards, newDeck, newDiscard } = drawCards({
      deck: game.deck as string[],
      discard: game.discard as IDiscardPileEntry[],
      quantity,
      source: source as `${EDrawSource}`,
    });

    // Only now, with the draw already resolved, do the cards played/discarded in this action
    // enter the Discard pile (on top) — before this they didn't count toward `discardCount` nor
    // could they be drawn back by the very player who just played/discarded them. See
    // game-concept.md, "Compra após a ação".
    const cardsForDiscard: IDiscardPileEntry[] = pendingDraw.action_type === EActionType.MELD
      ? (pendingDraw.details.melded_cards as string[]).map((cardId) => ({ card_id: cardId, face_up: true }))
      : (pendingDraw.details.discarded_cards as string[]).map((cardId) => ({ card_id: cardId, face_up: false }));

    const finalDiscard: IDiscardPileEntry[] = [...newDiscard, ...cardsForDiscard];

    const newHand = [...(gamePlayer.hand as string[]), ...drawnCards];

    await db.update(gamePlayers)
      .set({ hand: newHand })
      .where(eq(gamePlayers.id, gamePlayer.id));

    await db.update(games)
      .set({ deck: newDeck, discard: finalDiscard, pending_draw: null })
      .where(eq(games.id, gameId));

    const allPlayers = await db.select().from(gamePlayers).where(eq(gamePlayers.game_id, gameId));

    if (gameShouldEnd(allPlayers)) {
      await db.update(games)
        .set({ status: EGameStatus.FINISHED, winning_team: winningTeam(allPlayers), finished_at: new Date() })
        .where(eq(games.id, gameId));
    } else {
      const nextSeat = nextSeatWithAction(game.current_seat, allPlayers);

      await db.update(games)
        .set({ current_seat: nextSeat ?? game.current_seat })
        .where(eq(games.id, gameId));
    }

    await db.insert(gameActions).values({
      game_id: gameId,
      seat: pendingDraw.seat,
      type: pendingDraw.action_type,
      payload: { ...pendingDraw.details, draw_source: source, drawn_cards: drawnCards },
      created_at: new Date(),
    });

    publish(`game:${gameId}`);

    return NextResponse.json({
      success: true,
      message: { 'pt-br': 'Compra realizada com sucesso.', 'es-mx': 'Compra realizada con éxito.', 'en-us': 'Draw completed successfully.' },
      data: null,
    });
  } catch (e) {
    console.error(e);

    return NextResponse.json({ success: false, message: { 'pt-br': 'Erro ao realizar a compra.', 'es-mx': 'Error al realizar la compra.', 'en-us': 'Error completing the draw.' }, data: null }, { status: 500 });
  }
}
