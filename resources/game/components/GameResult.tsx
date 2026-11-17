'use client';

import Link from 'next/link';
import { motion } from 'motion/react';
import { UtilsFor } from '@/components/utils/For';
import { UtilsIf } from '@/components/utils/If';
import { ETeam } from '../enums/ETeam';
import { EFinishReason } from '../enums/EFinishReason';
import { scoreByTeam } from '../models/Turn';
import { teamForSeat } from '../models/Team';
import { CHIP_COLORS, StackedChip } from './PokerChip';
import type { IGameState } from '../models/GameState';

const TEAM_SWATCH: Record<`${ETeam}`, string> = {
  [ETeam.A]: 'bg-team-a',
  [ETeam.B]: 'bg-team-b',
};

const TEAM_CHIPS: Record<`${ETeam}`, string[]> = {
  [ETeam.A]: [CHIP_COLORS.gold, CHIP_COLORS.gold, CHIP_COLORS.ink],
  [ETeam.B]: [CHIP_COLORS.pink, CHIP_COLORS.pink, CHIP_COLORS.red],
};

export type GameOutcome = 'win' | 'lose' | 'tie';

// From the viewer's point of view (spectators without a seat count as a "win" fanfare).
export function gameOutcomeFor(state: IGameState): GameOutcome {
  if (!state.winning_team) return 'tie';
  if (!state.you) return 'win';

  return teamForSeat(state.you.seat) === state.winning_team ? 'win' : 'lose';
}

export function gameResultTitle(state: IGameState): string {
  if (!state.winning_team) return 'Empate!';

  return `Equipe ${state.winning_team} venceu!`;
}

// Explains WHY the game ended — specially the early finish, so nobody is surprised that the
// game stopped while there were still Jogadas left.
export function finishReasonText(state: IGameState): string {
  const totals = scoreByTeam(state.players);

  if (state.finish_reason === EFinishReason.DECIDED) {
    const leader = totals[ETeam.A] > totals[ETeam.B] ? ETeam.A : ETeam.B;
    const other = leader === ETeam.A ? ETeam.B : ETeam.A;

    return `Fim antecipado: a Equipe ${other} já tinha usado todas as suas jogadas e só a Equipe ${leader} ainda tinha jogadas, já estando na frente. O placar não podia mais virar.`;
  }

  if (state.finish_reason === EFinishReason.INACTIVITY) {
    return 'Partida encerrada por inatividade: mais de 1 hora sem nenhuma jogada. Vale o placar daquele momento.';
  }

  return 'Todas as jogadas foram usadas.';
}

function TeamPanel({ state, team, total, winner, index }: {
  state: IGameState;
  team: `${ETeam}`;
  total: number;
  winner: boolean;
  index: number;
}) {
  const players = state.players.filter((player) => player.team === team);
  const isYourTeam = !!state.you && teamForSeat(state.you.seat) === team;
  const chips = Math.min(10, 1 + Math.floor(total / 120));

  return (
    <motion.div
      className={`relative flex flex-col gap-4 bg-felt-night px-5 py-5 md:px-7 md:py-6 outline-[3px] ${winner ? 'outline-gold' : 'outline-transparent'}`}
      initial={{ opacity: 0, y: 30 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.15 + index * 0.12, type: 'spring', stiffness: 260, damping: 22 }}
    >
      <span
        className={`absolute left-0 top-0 bottom-0 w-1.5 ${TEAM_SWATCH[team]}`}
        aria-hidden="true"
      />

      <div className="flex items-center justify-between gap-3">
        <span className="font-display text-paper text-[22px] md:text-[26px] leading-none">
          {`Equipe ${team}${isYourTeam ? ' · sua dupla' : ''}`}
        </span>

        <UtilsIf condition={winner}>
          {() => (
            <span className="bg-gold text-gold-ink text-[12px] font-bold uppercase tracking-wider px-2 py-1">
              Vencedora
            </span>
          )}
        </UtilsIf>
      </div>

      <div className="flex items-end gap-4">
        <div
          className="relative w-[30px]"
          style={{ height: 17 + (chips - 1) * 5 }}
          aria-hidden="true"
        >
          <UtilsFor
            each={Array.from({ length: chips }, (_, chipIndex) => chipIndex)}
            eachKey={({ item }) => item}
          >
            {({ item: chipIndex }) => (
              <motion.div
                className="absolute left-0"
                style={{ bottom: chipIndex * 5, zIndex: chipIndex }}
                initial={{ y: -60, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: 0.4 + index * 0.12 + chipIndex * 0.06, type: 'spring', stiffness: 520, damping: 24 }}
              >
                <StackedChip
                  color={TEAM_CHIPS[team][chipIndex % 3]}
                  width={30}
                />
              </motion.div>
            )}
          </UtilsFor>
        </div>

        <span className={`font-display tabular leading-none text-[52px] md:text-[64px] ${winner ? 'text-gold' : 'text-paper'}`}>
          {total}
        </span>

        <span className="text-paper/70 text-[14px] pb-2">
          pontos
        </span>
      </div>

      <div className="flex flex-col gap-1.5 border-t border-paper/10 pt-3">
        <UtilsFor
          each={players}
          eachKey={({ item }) => item.seat}
        >
          {({ item: player }) => (
            <div className="flex items-baseline justify-between gap-3 text-paper">
              <span className="truncate text-[15px]">
                {`${player.name}${state.you?.seat === player.seat ? ' (você)' : ''}`}
              </span>

              <span className="font-display tabular text-[20px] text-paper/90">
                {player.score}
              </span>
            </div>
          )}
        </UtilsFor>
      </div>
    </motion.div>
  );
}

/**
 * Final screen of a finished Partida: who won (or tie), each team's total with its players'
 * individual scores, and why the game ended (see `finishReasonText`).
 */
export function GameResult({ state }: { state: IGameState }) {
  const totals = scoreByTeam(state.players);
  const outcome = gameOutcomeFor(state);

  const subtitle: Record<GameOutcome, string> = {
    win: state.you ? 'Sua dupla venceu a partida.' : 'Partida encerrada.',
    lose: 'Sua dupla perdeu desta vez.',
    tie: 'As duas duplas terminaram com a mesma pontuação.',
  };

  return (
    <section
      className="flex-1 min-h-0 overflow-y-auto w-full"
      aria-labelledby="resultado-titulo"
    >
      <div className="w-full max-w-3xl mx-auto flex flex-col items-center gap-6 md:gap-8 px-4 py-8 md:py-12">
        <motion.div
          className="flex flex-col items-center gap-2 text-center"
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ type: 'spring', stiffness: 300, damping: 18 }}
        >
          <span className="text-paper/70 text-[13px] uppercase tracking-[0.2em]">
            Fim de partida
          </span>

          <h1
            id="resultado-titulo"
            className="font-display italic text-gold text-[44px] md:text-[64px] leading-none"
          >
            {gameResultTitle(state)}
          </h1>

          <p className="text-paper text-[16px] md:text-[18px]">
            {subtitle[outcome]}
          </p>
        </motion.div>

        <div className="w-full flex items-start gap-3 bg-felt-night/70 border-l-4 border-gold px-4 py-3 text-paper text-[14px] md:text-[15px] leading-[1.5]">
          <span className="text-gold font-bold shrink-0">
            Por que acabou?
          </span>

          <span>
            {finishReasonText(state)}
          </span>
        </div>

        <div className="w-full grid grid-cols-1 sm:grid-cols-2 gap-4">
          <UtilsFor
            each={[ETeam.A, ETeam.B] as Array<`${ETeam}`>}
            eachKey={({ item }) => item}
          >
            {({ item: team, index }) => (
              <TeamPanel
                state={state}
                team={team}
                total={totals[team]}
                winner={state.winning_team === team}
                index={index}
              />
            )}
          </UtilsFor>
        </div>

        <Link
          href="/"
          className="bg-gold text-gold-ink font-bold px-6 py-3 text-[15px] hover:bg-gold-deep transition-colors"
        >
          Voltar ao início
        </Link>
      </div>
    </section>
  );
}
