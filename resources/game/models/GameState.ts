import type { ETeam } from '../enums/ETeam';
import type { EGameStatus } from '../enums/EGameStatus';
import type { EActionType } from '../enums/EActionType';
import type { ECombo } from '../enums/ECombo';
import type { EDrawSource } from '../enums/EDrawSource';
import type { EFinishReason } from '../enums/EFinishReason';
import type { ICard } from './Card';

export interface IPublicGamePlayer {
  seat: number;
  name: string;
  team: `${ETeam}`;
  is_host: boolean;
  hand_count: number;
  melds_remaining: number;
  discards_remaining: number;
  score: number;
}

// Public state of a Swap in progress — never exposes which cards were chosen
// (see game-concept.md, section "Troca"). `*_ready` only indicates whether that side already submitted.
export interface IPublicPendingSwap {
  initiator_seat: number;
  partner_seat: number;
  quantity: number;
  initiator_ready: boolean;
  partner_ready: boolean;
}

// Last completed action in the Game (Meld/Discard/Swap) — used by animations to know "what
// just happened" and react (see game-concept.md, "Feed de última ação"). Every snapshot from
// `GET /api/games/[gameId]` carries the SAME last action until a new one happens — the client
// uses `id` (the row id in `game_actions`) to know whether it already reacted to it or if it's new.
//
// Privacy redaction: the fields below already come filtered by the server according to who is
// requesting the snapshot. Cards that are still private (drawn cards — always; discarded cards,
// because they go face down) only appear when `seat` is your own seat; for other players, only
// the COUNT appears (`drawn_count`/`discarded_count`), never the identity. The cards from a Meld
// play (`melded_cards`/`scoring_cards`) are always public — they go to the Bolo face up,
// everyone already sees their value there.
export interface IPublicLastAction {
  id: number;
  seat: number;
  type: `${EActionType}`;
  created_at: string | null;

  // Meld — always public.
  melded_cards?: ICard[];
  combo?: `${ECombo}`;
  scoring_cards?: ICard[];
  chips?: number;
  multiplier?: number;
  points?: number;

  // Discard — only the count is public; the identity of discarded cards is private.
  discarded_count?: number;
  discarded_cards?: ICard[]; // present only when `seat` is you

  // Meld/Discard — draw: the source and the count are public, the identity of drawn cards is private.
  draw_source?: `${EDrawSource}`;
  drawn_count?: number;
  drawn_cards?: ICard[]; // present only when `seat` is you

  // Swap — always public (the `game_actions` payload never stores the swapped cards).
  partner_seat?: number;
  swap_quantity?: number;
}

export interface IGameState {
  game_id: number;
  status: `${EGameStatus}`;
  current_seat: number;
  // null while playing, or on a tie once finished.
  winning_team: `${ETeam}` | null;
  finish_reason: `${EFinishReason}` | null;
  finished_at: string | null;
  // Monte (face down, drawable).
  deck_count: number;
  // Descarte (face down, drawable) — only the count is public.
  discard_count: number;
  // Bolo (face up, public, NOT drawable), order = bottom→top.
  meld_pile: ICard[];
  players: IPublicGamePlayer[];
  pending_swap: IPublicPendingSwap | null;
  last_action: IPublicLastAction | null;
  you: {
    seat: number;
    hand: ICard[];
    melds_remaining: number;
    discards_remaining: number;
    is_your_turn: boolean;
    // true when `pending_swap` exists, you are one of the two participants, and haven't chosen your cards yet.
    needs_to_choose_swap: boolean;
  } | null;
}
