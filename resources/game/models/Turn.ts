import { ETeam } from '../enums/ETeam';
import { teamForSeat } from './Team';

type TurnPlayer = {
  seat: number;
  melds_remaining: number;
  discards_remaining: number;
};

// The Game ends when NO player has any Melds remaining — even if Discards remain
// (see game-concept.md, section "Regras do jogo"). Call this after every action that
// consumes a Meld or a Discard, before deciding whether to advance the turn.
export function gameShouldEnd(players: TurnPlayer[]): boolean {
  return players.every((player) => player.melds_remaining === 0);
}

// Next seat clockwise that still has some action available (Meld or Discard).
// Seats with no action are skipped (see game-concept.md). Returns null only if no
// player has an action — in that case the game should have already ended (see `gameShouldEnd`).
export function nextSeatWithAction(currentSeat: number, players: TurnPlayer[]): number | null {
  for (let step = 1; step <= players.length; step++) {
    const seat = (currentSeat + step) % players.length;
    const player = players.find((p) => p.seat === seat);

    if (player && (player.melds_remaining > 0 || player.discards_remaining > 0)) return seat;
  }

  return null;
}

export function winningTeam(players: Array<{ seat: number; score: number }>): `${ETeam}` {
  const scoreByTeam: Record<`${ETeam}`, number> = { [ETeam.A]: 0, [ETeam.B]: 0 };

  players.forEach((player) => {
    scoreByTeam[teamForSeat(player.seat)] += player.score;
  });

  return scoreByTeam[ETeam.A] >= scoreByTeam[ETeam.B] ? ETeam.A : ETeam.B;
}
