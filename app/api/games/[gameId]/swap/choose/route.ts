import { db } from '@/libs/db';
import { gameActions, gamePlayers, games } from '@/db/schema';
import { getCurrentGamePlayer } from '@/libs/gameAuth';
import { publish } from '@/libs/realtime';
import { EActionType } from '@/resources/game/enums/EActionType';
import { gameEndReason, nextSeatWithAction } from '@/resources/game/models/Turn';
import { finishGame } from '@/libs/gameFinish';
import { IPendingSwap } from '@/resources/game/models/Swap';
import { and, eq } from 'drizzle-orm';
import { NextResponse } from 'next/server';

type ResolutionOutcome =
  | { kind: 'no-swap' }
  | { kind: 'not-participant' }
  | { kind: 'already-chosen' }
  | { kind: 'waiting-for-partner' }
  | { kind: 'completed' };

export async function POST(request: Request, { params }: { params: Promise<{ gameId: string }> }) {
  try {
    const { gameId: gameIdParam } = await params;
    const gameId = Number(gameIdParam);
    const body = await request.json();
    const cards: string[] = Array.isArray(body.cards) ? body.cards : [];

    const { game, room, roomPlayer, gamePlayer } = await getCurrentGamePlayer(gameId);

    if (!game || !room) {
      return NextResponse.json({ success: false, message: { 'pt-br': 'Partida não encontrada.', 'es-mx': 'Partida no encontrada.', 'en-us': 'Game not found.' }, data: null }, { status: 404 });
    }

    if (!roomPlayer || !gamePlayer) {
      return NextResponse.json({ success: false, message: { 'pt-br': 'Você não é um jogador desta partida.', 'es-mx': 'No eres un jugador de esta partida.', 'en-us': 'You are not a player in this game.' }, data: null }, { status: 403 });
    }

    const pendingSwap = game.pending_swap as IPendingSwap | null;

    if (!pendingSwap) {
      return NextResponse.json({ success: false, message: { 'pt-br': 'Não há troca em andamento.', 'es-mx': 'No hay ningún intercambio en curso.', 'en-us': 'There is no swap in progress.' }, data: null }, { status: 409 });
    }

    const isInitiator = pendingSwap.initiator_seat === gamePlayer.seat;
    const isPartner = pendingSwap.partner_seat === gamePlayer.seat;

    if (!isInitiator && !isPartner) {
      return NextResponse.json({ success: false, message: { 'pt-br': 'Você não é participante desta troca.', 'es-mx': 'No eres participante de este intercambio.', 'en-us': 'You are not a participant in this swap.' }, data: null }, { status: 403 });
    }

    const hand = gamePlayer.hand as string[];
    const uniqueCards = new Set(cards);

    const validCards = cards.length === pendingSwap.quantity
      && uniqueCards.size === cards.length
      && cards.every((cardId) => hand.includes(cardId));

    if (!validCards) {
      return NextResponse.json({ success: false, message: { 'pt-br': 'Seleção de cartas inválida.', 'es-mx': 'Selección de cartas inválida.', 'en-us': 'Invalid card selection.' }, data: null }, { status: 422 });
    }

    const alreadyChosenPreCheck = isInitiator ? pendingSwap.initiator_cards !== null : pendingSwap.partner_cards !== null;

    if (alreadyChosenPreCheck) {
      return NextResponse.json({ success: false, message: { 'pt-br': 'Você já escolheu suas cartas para esta troca.', 'es-mx': 'Ya elegiste tus cartas para este intercambio.', 'en-us': 'You already chose your cards for this swap.' }, data: null }, { status: 409 });
    }

    // From here on the write needs to be atomic: both partners may submit almost at the same
    // time. `SELECT ... FOR UPDATE` on the `games` row serializes the two requests — the second
    // one only reads `pending_swap` with the first one's choice already applied, after it
    // commits, which avoids losing one side's choice (lost update) and guarantees the swap's
    // resolution (once both have chosen) runs exactly once.
    const outcome: ResolutionOutcome = await db.transaction(async (tx) => {
      const [freshGame] = await tx.select().from(games).where(eq(games.id, gameId)).for('update');
      const freshPending = freshGame.pending_swap as IPendingSwap | null;

      if (!freshPending) return { kind: 'no-swap' };

      const freshIsInitiator = freshPending.initiator_seat === gamePlayer.seat;
      const freshIsPartner = freshPending.partner_seat === gamePlayer.seat;

      if (!freshIsInitiator && !freshIsPartner) return { kind: 'not-participant' };

      const alreadyChosen = freshIsInitiator ? freshPending.initiator_cards !== null : freshPending.partner_cards !== null;

      if (alreadyChosen) return { kind: 'already-chosen' };

      const updated: IPendingSwap = {
        ...freshPending,
        initiator_cards: freshIsInitiator ? cards : freshPending.initiator_cards,
        partner_cards: freshIsPartner ? cards : freshPending.partner_cards,
      };

      const bothChose = updated.initiator_cards !== null && updated.partner_cards !== null;

      if (!bothChose) {
        await tx.update(games).set({ pending_swap: updated, last_action_at: new Date() }).where(eq(games.id, gameId));

        return { kind: 'waiting-for-partner' };
      }

      const [initiatorPlayer] = await tx
        .select()
        .from(gamePlayers)
        .where(and(eq(gamePlayers.game_id, gameId), eq(gamePlayers.seat, updated.initiator_seat)));

      const [partnerPlayer] = await tx
        .select()
        .from(gamePlayers)
        .where(and(eq(gamePlayers.game_id, gameId), eq(gamePlayers.seat, updated.partner_seat)));

      const initiatorCards = updated.initiator_cards as string[];
      const partnerCards = updated.partner_cards as string[];

      const initiatorCurrentHand = initiatorPlayer.hand as string[];
      const partnerCurrentHand = partnerPlayer.hand as string[];

      const newInitiatorHand = [...initiatorCurrentHand.filter((cardId) => !initiatorCards.includes(cardId)), ...partnerCards];
      const newPartnerHand = [...partnerCurrentHand.filter((cardId) => !partnerCards.includes(cardId)), ...initiatorCards];

      const newInitiatorDiscards = initiatorPlayer.discards_remaining - 1;
      const newPartnerDiscards = partnerPlayer.discards_remaining - 1;

      await tx.update(gamePlayers).set({ hand: newInitiatorHand, discards_remaining: newInitiatorDiscards }).where(eq(gamePlayers.id, initiatorPlayer.id));
      await tx.update(gamePlayers).set({ hand: newPartnerHand, discards_remaining: newPartnerDiscards }).where(eq(gamePlayers.id, partnerPlayer.id));

      const allPlayers = await tx.select().from(gamePlayers).where(eq(gamePlayers.game_id, gameId));

      const updatedPlayers = allPlayers.map((player) => {
        if (player.id === initiatorPlayer.id) return { ...player, discards_remaining: newInitiatorDiscards };
        if (player.id === partnerPlayer.id) return { ...player, discards_remaining: newPartnerDiscards };

        return player;
      });

      const now = new Date();

      // Never store the swapped cards' ids — the `game_actions` history is read by all players
      // (animations), including opponents (game-concept.md).
      await tx.insert(gameActions).values({
        game_id: gameId,
        seat: updated.initiator_seat,
        type: EActionType.SWAP,
        payload: { partner_seat: updated.partner_seat, quantity: updated.quantity },
        created_at: now,
      });

      const endReason = gameEndReason(updatedPlayers);

      if (endReason) {
        await finishGame(tx, { gameId, roomId: freshGame.room_id, players: updatedPlayers, reason: endReason });
      } else {
        await tx.update(games).set({
          pending_swap: null,
          last_action_at: now,
          current_seat: nextSeatWithAction(freshGame.current_seat, updatedPlayers) ?? freshGame.current_seat,
        }).where(eq(games.id, gameId));
      }

      return { kind: 'completed' };
    });

    if (outcome.kind === 'no-swap') {
      return NextResponse.json({ success: false, message: { 'pt-br': 'Não há troca em andamento.', 'es-mx': 'No hay ningún intercambio en curso.', 'en-us': 'There is no swap in progress.' }, data: null }, { status: 409 });
    }

    if (outcome.kind === 'not-participant') {
      return NextResponse.json({ success: false, message: { 'pt-br': 'Você não é participante desta troca.', 'es-mx': 'No eres participante de este intercambio.', 'en-us': 'You are not a participant in this swap.' }, data: null }, { status: 403 });
    }

    if (outcome.kind === 'already-chosen') {
      return NextResponse.json({ success: false, message: { 'pt-br': 'Você já escolheu suas cartas para esta troca.', 'es-mx': 'Ya elegiste tus cartas para este intercambio.', 'en-us': 'You already chose your cards for this swap.' }, data: null }, { status: 409 });
    }

    publish(`game:${gameId}`);

    return NextResponse.json({
      success: true,
      message: { 'pt-br': 'Cartas escolhidas com sucesso.', 'es-mx': 'Cartas elegidas con éxito.', 'en-us': 'Cards chosen successfully.' },
      data: { waiting_for_partner: outcome.kind === 'waiting-for-partner' },
    });
  } catch (e) {
    console.error(e);

    return NextResponse.json({ success: false, message: { 'pt-br': 'Erro ao confirmar a troca.', 'es-mx': 'Error al confirmar el intercambio.', 'en-us': 'Error confirming the swap.' }, data: null }, { status: 500 });
  }
}
