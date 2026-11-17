export enum EFinishReason {
  // No player has any Jogada (Meld) left.
  NO_MELDS = 'no_melds',
  // Only one team still had Jogadas and it was already ahead — the result could no longer change.
  DECIDED = 'decided',
  // Nobody played for more than 1 hour — closed by the inactivity sweeper.
  INACTIVITY = 'inactivity',
}
