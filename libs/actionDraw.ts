import 'server-only';
import { eq } from 'drizzle-orm';
import { db } from '@/libs/db';
import { gameActions, gamePlayers, games } from '@/db/schema';
import { finishGame } from '@/libs/gameFinish';
import { EDrawSource } from '@/resources/game/enums/EDrawSource';
import { EActionType } from '@/resources/game/enums/EActionType';
import { drawCards, drawSourceAvailability } from '@/resources/game/models/Draw';
import { gameEndReason, nextSeatWithAction } from '@/resources/game/models/Turn';

type Game = typeof games.$inferSelect;
type GamePlayer = typeof gamePlayers.$inferSelect;
type I18nMessage = { 'pt-br': string; 'es-mx': string; 'en-us': string };

// Validates the draw source sent together with a Jogada/Descarte (body `source`). Returns the
// error message (422) or null. Same rule as the client (`drawSourceAvailability` in Draw.ts).
// The cards of the action itself are not in any pile yet, so they never count here.
export function drawSourceError(game: Game, source: unknown, quantity: number): I18nMessage | null {
  if (source !== EDrawSource.DECK && source !== EDrawSource.DISCARD) {
    return { 'pt-br': 'Escolha se a compra será do Monte ou do Descarte.', 'es-mx': 'Elige si la compra será del Monte o del Descarte.', 'en-us': 'Choose whether to draw from the Deck or the Discard pile.' };
  }

  const availability = drawSourceAvailability({
    deckCount: (game.deck as string[]).length,
    discardCount: (game.discard as string[]).length,
    meldPileCount: (game.meld_pile as string[]).length,
    quantity,
  });

  if (source === EDrawSource.DISCARD && !availability.discard) {
    return { 'pt-br': 'O Descarte não tem cartas suficientes para esta compra.', 'es-mx': 'El Descarte no tiene cartas suficientes para esta compra.', 'en-us': 'The Discard pile does not have enough cards for this draw.' };
  }

  if (source === EDrawSource.DECK && !availability.deck) {
    return { 'pt-br': 'Não há cartas suficientes no Monte para completar esta compra.', 'es-mx': 'No hay cartas suficientes en el Monte para completar esta compra.', 'en-us': 'There are not enough cards in the Deck to complete this draw.' };
  }

  return null;
}

// Resolves a Jogada/Descarte in ONE step (see game-concept.md, "Compra junto com a ação"):
// draws from the chosen source, only then stacks the action's cards on their pile (Bolo for a
// Jogada, Descarte for a Descarte — so the player never draws back what they just played),
// updates the player, writes the `game_actions` row (the feed every client animates from, all
// at the same time) and closes the turn (finish or next seat). Runs inside a transaction.
export async function resolveActionWithDraw({ game, gamePlayer, actionType, cards, source, playerChanges, details }: {
  game: Game;
  gamePlayer: GamePlayer;
  actionType: EActionType.MELD | EActionType.DISCARD;
  // Ids of the cards played/discarded (already validated as being in the hand).
  cards: string[];
  source: `${EDrawSource}`;
  // Extra player fields decided by the action (counter decrement, score).
  playerChanges: Partial<Pick<GamePlayer, 'melds_remaining' | 'discards_remaining' | 'score'>>;
  // Action-specific `game_actions` payload (e.g. combo/points for a Jogada).
  details: Record<string, unknown>;
}) {
  const { drawnCards, newDeck, newDiscard, newMeldPile } = drawCards({
    deck: game.deck as string[],
    discard: game.discard as string[],
    meldPile: game.meld_pile as string[],
    quantity: cards.length,
    source,
  });

  const finalMeldPile = actionType === EActionType.MELD ? [...newMeldPile, ...cards] : newMeldPile;
  const finalDiscard = actionType === EActionType.DISCARD ? [...newDiscard, ...cards] : newDiscard;

  const played = new Set(cards);
  const newHand = [...(gamePlayer.hand as string[]).filter((cardId) => !played.has(cardId)), ...drawnCards];
  const now = new Date();

  await db.transaction(async (tx) => {
    await tx.update(gamePlayers)
      .set({ ...playerChanges, hand: newHand })
      .where(eq(gamePlayers.id, gamePlayer.id));

    await tx.update(games)
      .set({ deck: newDeck, discard: finalDiscard, meld_pile: finalMeldPile, last_action_at: now })
      .where(eq(games.id, game.id));

    // The action row goes in BEFORE a possible finish, so the last action still shows up in
    // `last_action` (its animation plays before the result screen).
    await tx.insert(gameActions).values({
      game_id: game.id,
      seat: gamePlayer.seat,
      type: actionType,
      payload: { ...details, draw_source: source, drawn_cards: drawnCards },
      created_at: now,
    });

    const allPlayers = await tx.select().from(gamePlayers).where(eq(gamePlayers.game_id, game.id));
    const endReason = gameEndReason(allPlayers);

    if (endReason) {
      await finishGame(tx, { gameId: game.id, roomId: game.room_id, players: allPlayers, reason: endReason });
    } else {
      const nextSeat = nextSeatWithAction(game.current_seat, allPlayers);

      await tx.update(games)
        .set({ current_seat: nextSeat ?? game.current_seat })
        .where(eq(games.id, game.id));
    }
  });
}
