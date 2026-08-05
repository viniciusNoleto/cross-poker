import { UtilsFor } from '@/components/utils/For';
import { ETeam } from '../enums/ETeam';
import type { IPublicGamePlayer } from '../models/GameState';

function teamTotal(players: IPublicGamePlayer[], team: `${ETeam}`): number {
  return players
    .filter((player) => player.team === team)
    .reduce((sum, player) => sum + player.score, 0);
}

function TeamScore({
  name, total, ahead, players, textColor, underlineColor,
}: {
  name: string;
  total: number;
  ahead: boolean;
  players: IPublicGamePlayer[];
  textColor: string;
  underlineColor: string;
}) {
  return (
    <div className="flex flex-col items-center gap-0.5 px-3 py-1 rounded-md">
      <span className={`text-[11px] font-semibold uppercase tracking-wide ${textColor}`}>
        {name}
      </span>

      <span
        className={`text-white font-bold text-lg leading-none ${ahead ? `underline decoration-2 ${underlineColor}` : ''}`}
      >
        {`${total} pts`}
      </span>

      <div className="flex gap-2 mt-2">
        <UtilsFor
          each={players}
          eachKey={({ item }) => item.seat}
        >
          {({ item }) => (
            <span className="text-[10px] text-white/50 whitespace-nowrap">
              {`${item.name}: ${item.score}`}
            </span>
          )}
        </UtilsFor>
      </div>
    </div>
  );
}

/**
 * Aggregate per-team scoreboard — see game-concept.md: "Team score = sum of both members'
 * scores. Highest score wins." Stays visible at all times (not just at the end of the
 * Game), next to the turn indicator in `app/games/[gameId]/page.tsx`. Individual scoring
 * (`PlayerSeat`, small "Team X · N pts" text) still exists separately —
 * this component is the highlighted, per-team aggregate view.
 */
export function Scoreboard({ players }: { players: IPublicGamePlayer[] }) {
  const totalA = teamTotal(players, ETeam.A);
  const totalB = teamTotal(players, ETeam.B);

  const playersA = players.filter((player) => player.team === ETeam.A);
  const playersB = players.filter((player) => player.team === ETeam.B);

  return (
    <div className="flex items-stretch gap-3 bg-black/30 backdrop-blur-sm rounded-lg px-4 py-1.5 border border-white/10">
      <TeamScore
        name="Equipe A"
        total={totalA}
        ahead={totalA > totalB}
        players={playersA}
        textColor="text-orange-400"
        underlineColor="decoration-orange-400"
      />

      <div className="w-px bg-white/10" />

      <TeamScore
        name="Equipe B"
        total={totalB}
        ahead={totalB > totalA}
        players={playersB}
        textColor="text-blue-400"
        underlineColor="decoration-blue-400"
      />
    </div>
  );
}
