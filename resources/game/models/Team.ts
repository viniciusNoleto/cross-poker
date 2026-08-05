import { ETeam } from '../enums/ETeam';

// Opposite seats (0-2 and 1-3) form the same team — see game-concept.md.
export function teamForSeat(seat: number): `${ETeam}` {
  return seat % 2 === 0 ? ETeam.A : ETeam.B;
}
