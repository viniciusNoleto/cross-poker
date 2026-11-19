'use client';

import { useEffect, useRef, useState } from 'react';
import { animate, motion, useAnimate } from 'motion/react';
import { sounds } from '@/utils/sound';
import { UtilsFor } from '@/components/utils/For';
import { UtilsIf } from '@/components/utils/If';
import { ETeam } from '../enums/ETeam';
import { CHIP_COLORS, StackedChip } from './PokerChip';
import { MarqueeBulbs, SlotReel } from './SlotReel';
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
const REEL_DIGITS = 4;
// Same "spin and land" curve as the meld count (`MeldScoreAnimation.tsx`).
const EASE_SLOT_MACHINE: [number, number, number, number] = [0.11, 0.75, 0.24, 1];
const ROLL_DURATION_S = 1.3;
const LIT_AFTER_ROLL_MS = 650;

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
  name, team, total, ahead, players, swatch, side,
}: {
  name: string;
  team: `${ETeam}`;
  total: number;
  ahead: boolean;
  players: IPublicGamePlayer[];
  swatch: string;
  side: 'left' | 'right';
}) {
  const previousTotalRef = useRef(total);
  const [shown, setShown] = useState(total);
  const [rolling, setRolling] = useState(false);
  const shownRef = useRef(total);

  // The total rolls up like a slot machine counter to its new value, then the window stays lit
  // for a moment ("payout"). A total that doesn't go up just snaps.
  useEffect(() => {
    const from = shownRef.current;

    if (total <= from) {
      shownRef.current = total;
      setShown(total);

      return undefined;
    }

    let litTimer: ReturnType<typeof setTimeout> | undefined;

    setRolling(true);

    const controls = animate(from, total, {
      duration: ROLL_DURATION_S,
      ease: EASE_SLOT_MACHINE,
      onUpdate: (value) => {
        shownRef.current = value;
        setShown(value);
      },
      onComplete: () => {
        litTimer = setTimeout(() => setRolling(false), LIT_AFTER_ROLL_MS);
      },
    });

    return () => {
      controls.stop();
      clearTimeout(litTimer);
      setRolling(false);
    };
  }, [total]);

  // Chips falling on the team's tower: one clack per new chip (at least one whenever the total
  // goes up), timed with the spring drop. Skipped on the first render.
  useEffect(() => {
    const previous = previousTotalRef.current;

    previousTotalRef.current = total;

    if (total <= previous) return undefined;

    const count = Math.max(1, chipsForTotal(total) - chipsForTotal(previous));
    const timer = setTimeout(() => sounds.chipDrop(count), 120);

    return () => clearTimeout(timer);
  }, [total]);

  const tower = (
    <ChipTower
      total={total}
      team={team}
    />
  );

  // Mirrored around the sign's centre: the chip tower on the outer side, the reels on the inner one.
  return (
    <div className="flex flex-col items-center gap-1.5 min-w-0">
      <span className="flex items-center gap-2 text-[12px] md:text-[13px] text-paper/85 whitespace-nowrap">
        <span
          className={`w-2.5 h-2.5 rotate-45 ${swatch}`}
          aria-hidden="true"
        />

        {name}

        <span
          className={`w-2.5 h-2.5 rotate-45 ${swatch}`}
          aria-hidden="true"
        />
      </span>

      <span className="flex items-end gap-2.5">
        <UtilsIf condition={side === 'left'}>
          {() => tower}
        </UtilsIf>

        <motion.span
          className="block text-[20px] md:text-[26px] origin-bottom"
          animate={{ scale: rolling ? 1.08 : 1 }}
          transition={{ type: 'spring', stiffness: 380, damping: 18 }}
        >
          <SlotReel
            value={shown}
            digits={REEL_DIGITS}
            tone={ahead ? 'gold' : 'paper'}
            lit={rolling}
          />
        </motion.span>

        <UtilsIf condition={side === 'right'}>
          {() => tower}
        </UtilsIf>
      </span>

      <span className="hidden sm:block [@media(max-height:760px)]:hidden! text-[12px] text-paper/70 whitespace-nowrap truncate max-w-45 text-center">
        {players.map((player) => `${player.name} ${player.score}`).join(' · ')}
      </span>
    </div>
  );
}

// One link chain hanging the sign from the top of the screen.
function Chain({ side }: { side: 'left' | 'right' }) {
  const links = [0, 1, 2, 3, 4];

  return (
    <span
      className={`absolute bottom-full flex flex-col items-center ${side === 'left' ? 'left-[14%]' : 'right-[14%]'}`}
      aria-hidden="true"
    >
      <UtilsFor
        each={links}
        eachKey={({ item }) => item}
      >
        {({ index }) => (
          <span
            className={`block border-2 border-gold-deep rounded-full ${index % 2 ? 'w-1 h-2.25 -my-0.5' : 'w-1.75 h-2.25 -my-0.5'}`}
          />
        )}
      </UtilsFor>
    </span>
  );
}

const RIVET_POSITIONS = ['left-1 top-1', 'right-1 top-1', 'left-1 bottom-1', 'right-1 bottom-1'];

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

  const [signScope, animateSign] = useAnimate();
  const [chasing, setChasing] = useState(false);
  const previousSumRef = useRef(totalA + totalB);

  // Whenever a team scores, the sign swings a little on its chains and its bulbs chase while the
  // reels roll.
  useEffect(() => {
    const sum = totalA + totalB;
    const previous = previousSumRef.current;

    previousSumRef.current = sum;

    if (sum <= previous) return undefined;

    setChasing(true);
    animateSign(signScope.current, { rotate: [0, -2.4, 1.8, -1.1, 0.5, 0] }, { duration: 1.6, ease: 'easeOut' });

    const timer = setTimeout(() => setChasing(false), (ROLL_DURATION_S * 1000) + LIT_AFTER_ROLL_MS);

    return () => clearTimeout(timer);
  }, [totalA, totalB, animateSign, signScope]);

  return (
    <div
      ref={signScope}
      className="relative mt-3 md:mt-4"
      style={{ transformOrigin: '50% -16px' }}
    >
      <Chain side="left" />

      <Chain side="right" />

      <div className="relative flex flex-col items-center gap-2 bg-felt-night border-[3px] border-gold-deep px-4 md:px-6 pt-2 pb-2.5 shadow-[0_14px_28px_-14px_rgba(0,0,0,0.8)]">
        <UtilsFor
          each={RIVET_POSITIONS}
          eachKey={({ item }) => item}
        >
          {({ item: position }) => (
            <span
              className={`absolute ${position} w-1.25 h-1.25 rounded-full bg-gold-deep`}
              aria-hidden="true"
            />
          )}
        </UtilsFor>

        <span className="block w-full px-3 [@media(max-height:760px)]:hidden">
          <MarqueeBulbs
            count={15}
            size={5}
            mode={chasing ? 'chase' : 'idle'}
          />
        </span>

        <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3 md:gap-5">
          <TeamScore
            name="Equipe A"
            team={ETeam.A}
            total={totalA}
            ahead={totalA > totalB}
            players={playersA}
            swatch="bg-team-a"
            side="left"
          />

          <span className="font-display italic text-gold text-lg">
            vs
          </span>

          <TeamScore
            name="Equipe B"
            team={ETeam.B}
            total={totalB}
            ahead={totalB > totalA}
            players={playersB}
            swatch="bg-team-b"
            side="right"
          />
        </div>
      </div>
    </div>
  );
}
