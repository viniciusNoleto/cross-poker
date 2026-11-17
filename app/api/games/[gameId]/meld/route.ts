import { getCurrentGamePlayer } from '@/libs/gameAuth';
import { publish } from '@/libs/realtime';
import { drawSourceError, resolveActionWithDraw } from '@/libs/actionDraw';
import { cardById } from '@/resources/game/models/Card';
import { bestCombo } from '@/resources/game/models/Combo';
import { EGameStatus } from '@/resources/game/enums/EGameStatus';
import { EActionType } from '@/resources/game/enums/EActionType';
import { EDrawSource } from '@/resources/game/enums/EDrawSource';
import { NextResponse } from 'next/server';

export async function POST(request: Request, { params }: { params: Promise<{ gameId: string }> }) {
  try {
    const { gameId: gameIdParam } = await params;
    const gameId = Number(gameIdParam);

    const body = await request.json();
    const cards: string[] = Array.isArray(body?.cards) ? body.cards : [];
    const source: unknown = body?.source;

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
      return NextResponse.json({ success: false, message: { 'pt-br': 'Existe uma Troca pendente nesta partida.', 'es-mx': 'Hay un Intercambio pendiente en esta partida.', 'en-us': 'There is a pending Swap in this game.' }, data: null }, { status: 409 });
    }

    if (gamePlayer.melds_remaining <= 0) {
      return NextResponse.json({ success: false, message: { 'pt-br': 'Você não possui Jogadas restantes.', 'es-mx': 'No te quedan Jugadas disponibles.', 'en-us': 'You have no Plays left.' }, data: null }, { status: 422 });
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

    const sourceError = drawSourceError(game, source, cards.length);

    if (sourceError) {
      return NextResponse.json({ success: false, message: sourceError, data: null }, { status: 422 });
    }

    const meldedCards = cards.map(cardById);
    const { type, scoringCards, chips, multiplier, points } = bestCombo(meldedCards);

    // Play + draw in a single step: the score only becomes visible (snapshot + `last_action`)
    // once the draw source is chosen, so every player sees the score animation at the same time.
    // See game-concept.md, "Compra junto com a ação".
    await resolveActionWithDraw({
      game,
      gamePlayer,
      actionType: EActionType.MELD,
      cards,
      source: source as `${EDrawSource}`,
      playerChanges: {
        melds_remaining: gamePlayer.melds_remaining - 1,
        score: gamePlayer.score + points,
      },
      details: {
        melded_cards: cards,
        combo: type,
        scoring_cards: scoringCards.map((card) => card.id),
        chips,
        multiplier,
        points,
      },
    });

    publish(`game:${gameId}`);

    return NextResponse.json({
      success: true,
      message: { 'pt-br': 'Jogada realizada com sucesso.', 'es-mx': 'Jugada realizada con éxito.', 'en-us': 'Play completed successfully.' },
      data: null,
    });
  } catch (e) {
    console.error(e);

    return NextResponse.json({ success: false, message: { 'pt-br': 'Erro ao realizar a Jogada.', 'es-mx': 'Error al realizar la Jugada.', 'en-us': 'Error making the Play.' }, data: null }, { status: 500 });
  }
}
