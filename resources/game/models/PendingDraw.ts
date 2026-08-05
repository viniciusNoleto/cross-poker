import type { EActionType } from '../enums/EActionType';

// Internal (server-only) state of an already-played Meld/Discard, awaiting the draw-source
// choice (Deck/Discard), persisted in `games.pending_draw`. `details` carries enough
// to build the final `game_actions` payload once the draw is resolved — see
// `IPublicPendingDraw` in `GameState.ts` for the safe shape exposed via API, and
// game-concept.md, section "Compra após a ação".
export interface IPendingDraw {
  seat: number;
  quantity: number;
  action_type: EActionType.MELD | EActionType.DISCARD;
  details: Record<string, unknown>;
}
