import { getCurrentGamePlayer } from '@/libs/gameAuth';
import { publish } from '@/libs/realtime';
import { drawSourceError, resolveActionWithDraw } from '@/libs/actionDraw';
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
      return NextResponse.json({ success: false, message: { 'pt-br': 'Esta partida não está em andamento.', 'es-mx': 'Esta partida no está en curso.', 'en-us': 'This game is not in progress.' }, data: null }, { status: 409 });
    }

    if (game.current_seat !== gamePlayer.seat) {
      return NextResponse.json({ success: false, message: { 'pt-br': 'Não é a sua vez de jogar.', 'es-mx': 'No es tu turno.', 'en-us': 'It is not your turn.' }, data: null }, { status: 403 });
    }

    if (game.pending_swap !== null) {
      return NextResponse.json({ success: false, message: { 'pt-br': 'Há uma Troca pendente nesta partida. Aguarde a resolução antes de jogar.', 'es-mx': 'Hay un Intercambio pendiente en esta partida. Espera a que se resuelva antes de jugar.', 'en-us': 'There is a pending Swap in this game. Wait for it to be resolved before playing.' }, data: null }, { status: 409 });
    }

    if (gamePlayer.discards_remaining <= 0) {
      return NextResponse.json({ success: false, message: { 'pt-br': 'Você não possui mais Descartes disponíveis.', 'es-mx': 'Ya no tienes Descartes disponibles.', 'en-us': 'You have no Discards left.' }, data: null }, { status: 422 });
    }

    const currentHand = gamePlayer.hand as string[];
    const uniqueIds = new Set(cards);

    if (cards.length < 1 || cards.length > 5 || uniqueIds.size !== cards.length) {
      return NextResponse.json({ success: false, message: { 'pt-br': 'Selecione de 1 a 5 cartas da sua mão, sem repetição, para descartar.', 'es-mx': 'Selecciona de 1 a 5 cartas de tu mano, sin repetir, para descartar.', 'en-us': 'Select 1 to 5 cards from your hand, without repeats, to discard.' }, data: null }, { status: 422 });
    }

    if (!cards.every((cardId) => currentHand.includes(cardId))) {
      return NextResponse.json({ success: false, message: { 'pt-br': 'Uma ou mais cartas selecionadas não estão na sua mão.', 'es-mx': 'Una o más cartas seleccionadas no están en tu mano.', 'en-us': 'One or more selected cards are not in your hand.' }, data: null }, { status: 422 });
    }

    const sourceError = drawSourceError(game, source, cards.length);

    if (sourceError) {
      return NextResponse.json({ success: false, message: sourceError, data: null }, { status: 422 });
    }

    // Discard + draw in a single step — see game-concept.md, "Compra junto com a ação".
    await resolveActionWithDraw({
      game,
      gamePlayer,
      actionType: EActionType.DISCARD,
      cards,
      source: source as `${EDrawSource}`,
      playerChanges: { discards_remaining: gamePlayer.discards_remaining - 1 },
      details: { discarded_cards: cards },
    });

    publish(`game:${gameId}`);

    return NextResponse.json({
      success: true,
      message: { 'pt-br': 'Descarte realizado com sucesso.', 'es-mx': 'Descarte realizado con éxito.', 'en-us': 'Discard completed successfully.' },
      data: null,
    });
  } catch (e) {
    console.error(e);

    return NextResponse.json({ success: false, message: { 'pt-br': 'Erro ao realizar o Descarte.', 'es-mx': 'Error al realizar el Descarte.', 'en-us': 'Error making the Discard.' }, data: null }, { status: 500 });
  }
}
