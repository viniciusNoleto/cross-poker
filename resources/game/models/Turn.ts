import { ETeam } from '../enums/ETeam';
import { EFinishReason } from '../enums/EFinishReason';
import { teamForSeat } from './Team';

type TurnPlayer = {
  seat: number;
  melds_remaining: number;
  discards_remaining: number;
  score: number;
};

export function scoreByTeam(players: Array<{ seat: number; score: number }>): Record<`${ETeam}`, number> {
  const totals: Record<`${ETeam}`, number> = { [ETeam.A]: 0, [ETeam.B]: 0 };

  players.forEach((player) => {
    totals[teamForSeat(player.seat)] += player.score;
  });

  return totals;
}

// Teams that still have at least one Jogada (Meld) left among their two players.
export function teamsWithMelds(players: Array<{ seat: number; melds_remaining: number }>): Array<`${ETeam}`> {
  return [ETeam.A, ETeam.B].filter((team) => players.some((player) => teamForSeat(player.seat) === team && player.melds_remaining > 0));
}

// Checklist run after every action that concludes a turn (Compra after Jogada/Descarte, Troca).
// Returns why the game must end now, or null to keep playing (see game-concept.md, "Fim da Partida"):
// - nobody has Jogadas left → NO_MELDS;
// - only one team still has Jogadas and it's already strictly ahead → DECIDED (the other team can
//   no longer score, so the result can't change anymore).
export function gameEndReason(players: TurnPlayer[]): `${EFinishReason}` | null {
  const remaining = teamsWithMelds(players);

  if (remaining.length === 0) return EFinishReason.NO_MELDS;

  if (remaining.length === 1) {
    const totals = scoreByTeam(players);
    const team = remaining[0];
    const other = team === ETeam.A ? ETeam.B : ETeam.A;

    if (totals[team] > totals[other]) return EFinishReason.DECIDED;
  }

  return null;
}

// Next seat clockwise that still has some action available (Jogada or Descarte).
// Seats with no action are skipped (see game-concept.md). Returns null only if no
// player has an action — in that case the game should have already ended (see `gameEndReason`).
export function nextSeatWithAction(currentSeat: number, players: TurnPlayer[]): number | null {
  for (let step = 1; step <= players.length; step++) {
    const seat = (currentSeat + step) % players.length;
    const player = players.find((p) => p.seat === seat);

    if (player && (player.melds_remaining > 0 || player.discards_remaining > 0)) return seat;
  }

  return null;
}

// Team with the highest total, or null on a tie.
export function winningTeam(players: Array<{ seat: number; score: number }>): `${ETeam}` | null {
  const totals = scoreByTeam(players);

  if (totals[ETeam.A] === totals[ETeam.B]) return null;

  return totals[ETeam.A] > totals[ETeam.B] ? ETeam.A : ETeam.B;
}
