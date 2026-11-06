'use client';

import { motion } from 'motion/react';
import { UtilsFor } from '@/components/utils/For';
import { ETeam } from '../enums/ETeam';
import { CHIP_COLORS, StackedChip } from './PokerChip';
import type { IPublicGamePlayer } from '../models/GameState';

function teamTotal(players: IPublicGamePlayer[], team: `${ETeam}`): number {
  return players
    .filter((player) => player.team === team)
    .reduce((sum, player) => sum + player.score, 0);
}

// One chip on the team's tower for every POINTS_PER_CHIP points (the first one shows up with the
// first point scored), capped so the scoreboard keeps its height.
const POINTS_PER_CHIP = 150;
const MAX_CHIPS = 8;
const CHIP_WIDTH = 22;
const CHIP_STEP = 4;

const TOWER_COLORS: Record<`${ETeam}`, string[]> = {
  [ETeam.A]: [CHIP_COLORS.gold, CHIP_COLORS.gold, CHIP_COLORS.ink],
  [ETeam.B]: [CHIP_COLORS.pink, CHIP_COLORS.pink, CHIP_COLORS.red],
};

function chipsForTotal(total: number): number {
  if (total <= 0) return 0;

  return Math.min(MAX_CHIPS, 1 + Math.floor(total / POINTS_PER_CHIP));
}

// The team's chip tower: grows as the team scores, each new chip dropping onto the pile with
// the same spring used on the home page.
function ChipTower({ total, team }: { total: number; team: `${ETeam}` }) {
  const chips = Array.from({ length: chipsForTotal(total) }, (_, index) => index);
  const faceHeight = Math.round(CHIP_WIDTH * 0.43) + Math.max(3, Math.round(CHIP_WIDTH * 0.09));

  return (
    <div
      className="relative shrink-0"
      style={{ width: CHIP_WIDTH, height: faceHeight + (MAX_CHIPS - 1) * CHIP_STEP }}
      aria-hidden="true"
    >
      <UtilsFor
        each={chips}
        eachKey={({ item }) => item}
      >
        {({ item: index }) => (
          <motion.div
            className="absolute left-0"
            style={{ bottom: index * CHIP_STEP, zIndex: index }}
            initial={{ y: -40, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ type: 'spring', stiffness: 520, damping: 24 }}
          >
            <StackedChip
              color={TOWER_COLORS[team][index % 3]}
              width={CHIP_WIDTH}
            />
          </motion.div>
        )}
      </UtilsFor>
    </div>
  );
}

function TeamScore({
  name, team, total, ahead, players, swatch, align,
}: {
  name: string;
  team: `${ETeam}`;
  total: number;
  ahead: boolean;
  players: IPublicGamePlayer[];
  swatch: string;
  align: 'left' | 'right';
}) {
  return (
    <div className={`flex flex-col gap-1 min-w-0 ${align === 'right' ? 'items-end text-right' : 'items-start'}`}>
      <span className={`flex items-center gap-2 text-[12px] md:text-[13px] text-paper/85 whitespace-nowrap ${align === 'right' ? 'flex-row-reverse' : ''}`}>
        <span
          className={`w-2.5 h-2.5 rotate-45 ${swatch}`}
          aria-hidden="true"
        />

        {name}
      </span>

      <span className={`flex items-end gap-2.5 ${align === 'right' ? 'flex-row-reverse' : ''}`}>
        <ChipTower
          total={total}
          team={team}
        />

        <motion.span
          key={total}
          initial={{ scale: total > 0 ? 1.25 : 1 }}
          animate={{ scale: 1 }}
          transition={{ type: 'spring', stiffness: 380, damping: 14 }}
          className={`font-display tabular leading-none text-[28px] md:text-[34px] ${align === 'right' ? 'origin-right' : 'origin-left'} ${ahead ? 'text-gold' : 'text-paper'}`}
        >
          {total}
        </motion.span>
      </span>

      <span className="hidden sm:block [@media(max-height:760px)]:hidden! text-[12px] text-paper/70 whitespace-nowrap truncate max-w-[180px]">
        {players.map((player) => `${player.name} ${player.score}`).join(' · ')}
      </span>
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
    <div className="flex items-center gap-4 md:gap-6 bg-felt-night px-4 md:px-6 py-2.5">
      <TeamScore
        name="Equipe A"
        team={ETeam.A}
        total={totalA}
        ahead={totalA > totalB}
        players={playersA}
        swatch="bg-team-a"
        align="left"
      />

      <span className="font-display italic text-paper/60 text-lg">
        vs
      </span>

      <TeamScore
        name="Equipe B"
        team={ETeam.B}
        total={totalB}
        ahead={totalB > totalA}
        players={playersB}
        swatch="bg-team-b"
        align="right"
      />
    </div>
  );
}
