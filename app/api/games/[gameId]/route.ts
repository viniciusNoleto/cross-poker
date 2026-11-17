import { db } from '@/libs/db';
import { roomPlayers, roomPlayerPublicColumns, gamePlayers, gameActions } from '@/db/schema';
import { getCurrentGamePlayer } from '@/libs/gameAuth';
import { cardById } from '@/resources/game/models/Card';
import { teamForSeat } from '@/resources/game/models/Team';
import { IGameState, IPublicPendingSwap, IPublicLastAction } from '@/resources/game/models/GameState';
import { EActionType } from '@/resources/game/enums/EActionType';
import { EGameStatus } from '@/resources/game/enums/EGameStatus';
import { desc, eq } from 'drizzle-orm';
import { NextResponse } from 'next/server';

export async function GET(_request: Request, { params }: { params: Promise<{ gameId: string }> }) {
  try {
    const { gameId: gameIdParam } = await params;
    const gameId = Number(gameIdParam);

    const { game, room, roomPlayer, gamePlayer } = await getCurrentGamePlayer(gameId);

    if (!game || !room) {
      return NextResponse.json({ success: false, message: { 'pt-br': 'Partida não encontrada.', 'es-mx': 'Partida no encontrada.', 'en-us': 'Game not found.' }, data: null }, { status: 404 });
    }

    const roomPlayersList = await db
      .select(roomPlayerPublicColumns)
      .from(roomPlayers)
      .where(eq(roomPlayers.room_id, room.id))
      .orderBy(roomPlayers.seat);

    const gamePlayersList = await db
      .select()
      .from(gamePlayers)
      .where(eq(gamePlayers.game_id, gameId))
      .orderBy(gamePlayers.seat);

    const players = gamePlayersList.map((gp) => {
      const rp = roomPlayersList.find((p) => p.seat === gp.seat);

      return {
        seat: gp.seat,
        name: rp?.name ?? '—',
        team: teamForSeat(gp.seat),
        is_host: rp?.is_host ?? false,
        hand_count: (gp.hand as string[]).length,
        melds_remaining: gp.melds_remaining,
        discards_remaining: gp.discards_remaining,
        score: gp.score,
      };
    });

    const pendingSwapRow = game.pending_swap as { initiator_seat: number; partner_seat: number; quantity: number; initiator_cards: string[] | null; partner_cards: string[] | null } | null;

    const pendingSwap: IPublicPendingSwap | null = pendingSwapRow ? {
      initiator_seat: pendingSwapRow.initiator_seat,
      partner_seat: pendingSwapRow.partner_seat,
      quantity: pendingSwapRow.quantity,
      initiator_ready: pendingSwapRow.initiator_cards !== null,
      partner_ready: pendingSwapRow.partner_cards !== null,
    } : null;

    const you: IGameState['you'] = gamePlayer && roomPlayer ? {
      seat: gamePlayer.seat,
      hand: (gamePlayer.hand as string[]).map(cardById),
      melds_remaining: gamePlayer.melds_remaining,
      discards_remaining: gamePlayer.discards_remaining,
      is_your_turn: game.status === EGameStatus.PLAYING && game.current_seat === gamePlayer.seat,
      needs_to_choose_swap: !!pendingSwapRow && (
        (pendingSwapRow.initiator_seat === gamePlayer.seat && pendingSwapRow.initiator_cards === null)
        || (pendingSwapRow.partner_seat === gamePlayer.seat && pendingSwapRow.partner_cards === null)
      ),
    } : null;

    const [lastActionRow] = await db
      .select()
      .from(gameActions)
      .where(eq(gameActions.game_id, gameId))
      .orderBy(desc(gameActions.id))
      .limit(1);

    let lastAction: IPublicLastAction | null = null;

    if (lastActionRow) {
      const payload = lastActionRow.payload as Record<string, any>;
      const isAuthor = !!gamePlayer && gamePlayer.seat === lastActionRow.seat;

      lastAction = {
        id: lastActionRow.id,
        seat: lastActionRow.seat,
        type: lastActionRow.type as `${EActionType}`,
        created_at: lastActionRow.created_at ? lastActionRow.created_at.toISOString() : null,
      };

      if (lastActionRow.type === EActionType.MELD) {
        const meldedCards: string[] = payload.melded_cards ?? [];
        const scoringCards: string[] = payload.scoring_cards ?? [];
        const drawnCards: string[] = payload.drawn_cards ?? [];

        lastAction.melded_cards = meldedCards.map(cardById);
        lastAction.combo = payload.combo;
        lastAction.scoring_cards = scoringCards.map(cardById);
        lastAction.chips = payload.chips;
        lastAction.multiplier = payload.multiplier;
        lastAction.points = payload.points;
        lastAction.draw_source = payload.draw_source;
        lastAction.drawn_count = drawnCards.length;

        if (isAuthor) lastAction.drawn_cards = drawnCards.map(cardById);
      } else if (lastActionRow.type === EActionType.DISCARD) {
        const discardedCards: string[] = payload.discarded_cards ?? [];
        const drawnCards: string[] = payload.drawn_cards ?? [];

        lastAction.discarded_count = discardedCards.length;
        lastAction.draw_source = payload.draw_source;
        lastAction.drawn_count = drawnCards.length;

        if (isAuthor) {
          lastAction.discarded_cards = discardedCards.map(cardById);
          lastAction.drawn_cards = drawnCards.map(cardById);
        }
      } else if (lastActionRow.type === EActionType.SWAP) {
        lastAction.partner_seat = payload.partner_seat;
        lastAction.swap_quantity = payload.quantity;
      }
    }

    const data: IGameState = {
      game_id: game.id,
      status: game.status as IGameState['status'],
      current_seat: game.current_seat,
      winning_team: game.winning_team as IGameState['winning_team'],
      finish_reason: game.finish_reason as IGameState['finish_reason'],
      finished_at: game.finished_at ? game.finished_at.toISOString() : null,
      deck_count: (game.deck as string[]).length,
      discard_count: (game.discard as string[]).length,
      meld_pile: (game.meld_pile as string[]).map(cardById),
      players,
      pending_swap: pendingSwap,
      last_action: lastAction,
      you,
    };

    return NextResponse.json({
      success: true,
      message: { 'pt-br': 'Operação realizada com sucesso.', 'es-mx': 'Operación realizada con éxito.', 'en-us': 'Operation completed successfully.' },
      data,
    });
  } catch (e) {
    console.error(e);

    return NextResponse.json({ success: false, message: { 'pt-br': 'Erro ao buscar a partida.', 'es-mx': 'Error al buscar la partida.', 'en-us': 'Error fetching game.' }, data: null }, { status: 500 });
  }
}
