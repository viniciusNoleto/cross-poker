import { cardById, type ICard } from '@/resources/game/models/Card';
import type { IGameState, IPublicGamePlayer } from '@/resources/game/models/GameState';
import { teamForSeat } from '@/resources/game/models/Team';

/** `cards('hearts-A', 'spades-10')` → ICard[] do baralho único (`-1`). */
export function cards(...shortIds: string[]): ICard[] {
  return shortIds.map((id) => cardById(`${id}-1`));
}

export function player(seat: number, overrides: Partial<IPublicGamePlayer> = {}): IPublicGamePlayer {
  return {
    seat,
    name: ['Ana', 'Bruno', 'Carla', 'Diego'][seat],
    team: teamForSeat(seat),
    is_host: seat === 0,
    hand_count: 8,
    melds_remaining: 5,
    discards_remaining: 5,
    score: 0,
    ...overrides,
  };
}

/** Snapshot de `GET /api/games/[id]` visto pelo assento `youSeat` (null = espectador). */
export function gameState(overrides: Partial<IGameState> = {}, youSeat: number | null = 0): IGameState {
  return {
    game_id: 1,
    status: 'playing',
    current_seat: 0,
    winning_team: null,
    finish_reason: null,
    finished_at: null,
    deck_count: 20,
    discard_count: 0,
    meld_pile: [],
    players: [0, 1, 2, 3].map((seat) => player(seat)),
    pending_swap: null,
    last_action: null,
    you: youSeat === null ? null : {
      seat: youSeat,
      hand: cards('hearts-A', 'hearts-K', 'spades-2', 'clubs-7', 'diamonds-9', 'spades-J', 'clubs-3', 'hearts-5'),
      melds_remaining: 5,
      discards_remaining: 5,
      is_your_turn: youSeat === 0,
      needs_to_choose_swap: false,
    },
    ...overrides,
  };
}
