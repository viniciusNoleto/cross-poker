// Internal (server-only) state of a Swap in progress, persisted in `games.pending_swap`.
// Never expose `initiator_cards`/`partner_cards` to the client — see `IPublicPendingSwap` in
// `GameState.ts` for the safe shape exposed via API (game-concept.md, section "Troca").
export interface IPendingSwap {
  initiator_seat: number;
  partner_seat: number;
  quantity: number;
  initiator_cards: string[] | null;
  partner_cards: string[] | null;
}
