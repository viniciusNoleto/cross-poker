'use client';

import { motion } from 'motion/react';
import { UtilsFor } from '@/components/utils/For';
import { UtilsIf } from '@/components/utils/If';
import { ETeam } from '../enums/ETeam';
import { IPublicGamePlayer } from '../models/GameState';
import { CrossLogo } from './Card';
import { TurnChip, TurnChipSide } from './TurnChip';

const INITIAL_MELDS = 5;
const INITIAL_DISCARDS = 5;
const MAX_FAN_CARDS = 8;
// Angle between two neighbouring cards of an opponent's fan.
const FAN_STEP_DEG = 8;

const TEAM_RING: Record<`${ETeam}`, string> = {
  [ETeam.A]: 'ring-team-a',
  [ETeam.B]: 'ring-team-b',
};

const TEAM_TEXT: Record<`${ETeam}`, string> = {
  [ETeam.A]: 'text-team-a',
  [ETeam.B]: 'text-team-b',
};

type FanSide = Exclude<TurnChipSide, 'bottom'>;

// The whole table is seen from the bottom seat: each fan is first turned so the card tops point
// at the player holding them (outwards, away from the centre), then the same `rotateX` tilts it
// back like the rest of the table — the side hands become trapezoids that narrow towards the top.
const FAN_TRANSFORM: Record<FanSide, string> = {
  top: 'perspective(320px) rotateX(42deg)',
  left: 'perspective(320px) rotateX(30deg) rotate(-90deg)',
  right: 'perspective(320px) rotateX(30deg) rotate(90deg)',
};

// Footprint of the fan once turned (transforms don't change layout, so the box is sized by hand).
const FAN_BOX: Record<FanSide, string> = {
  top: 'w-24 h-11 md:w-29 md:h-13.5',
  left: 'w-13 h-22 md:w-15.5 md:h-27.5',
  right: 'w-13 h-22 md:w-15.5 md:h-27.5',
};

const TURN_RIPPLES = [0, 1, 2];

// Rings that pop out around the avatar and drift away, fading, when the turn reaches it.
function TurnRipple() {
  return (
    <UtilsFor
      each={TURN_RIPPLES}
      eachKey={({ item }) => item}
    >
      {({ item }) => (
        <motion.span
          className="pointer-events-none absolute rounded-full border-2 border-gold"
          initial={{ top: 0, right: 0, bottom: 0, left: 0, opacity: 0.95 }}
          animate={{ top: -26, right: -26, bottom: -26, left: -26, opacity: 0 }}
          transition={{ duration: 1.2, delay: item * 0.32, ease: 'easeOut' }}
          aria-hidden="true"
        />
      )}
    </UtilsFor>
  );
}

function Pips({ total, remaining, activeColor, label }: { total: number; remaining: number; activeColor: string; label: string }) {
  return (
    <div
      className="flex gap-0.75"
      title={`${label}: ${remaining} de ${total}`}
      aria-label={`${label}: ${remaining} de ${total}`}
    >
      <UtilsFor
        each={Array.from({ length: total })}
        eachKey={({ index }) => index}
      >
        {({ index }) => (
          <span
            className={`w-1.75 h-1.75 rotate-45 ${index < remaining ? activeColor : 'bg-paper/15'}`}
          />
        )}
      </UtilsFor>
    </div>
  );
}

// Face-down cards held by an opponent, fanned out and laid in perspective on the table. Plain
// backs (not <Card>): the animated `layout` of <Card> fights the 3D transform of the fan.
function HandFan({ count, side }: { count: number; side: FanSide }) {
  const shown = Math.min(count, MAX_FAN_CARDS);
  const middle = (shown - 1) / 2;

  return (
    <div
      className={`relative shrink-0 pointer-events-none ${FAN_BOX[side]}`}
      role="img"
      aria-label={`${count} cartas na mão`}
    >
      <div
        className="absolute left-1/2 top-1/2 w-0 h-0 md:scale-[1.2]"
        style={{ transform: FAN_TRANSFORM[side] }}
      >
        <UtilsFor
          each={Array.from({ length: shown })}
          eachKey={({ index }) => index}
        >
          {({ index }) => (
            <span
              className="card-back absolute -left-4 -top-5.5 w-8 h-11.25 rounded-sm shadow-[0_1px_0_rgba(0,0,0,0.25),0_2px_6px_-2px_rgba(0,0,0,0.4)]"
              style={{
                transform: `rotate(${(index - middle) * FAN_STEP_DEG}deg)`,
                transformOrigin: '50% 210%',
              }}
            >
              <span className="absolute inset-0.5 rounded-xs flex items-center justify-center ring-[1.5px] ring-paper/70">
                <CrossLogo className="w-3 h-3 text-gold" />
              </span>
            </span>
          )}
        </UtilsFor>
      </div>
    </div>
  );
}

function Avatar({ player, isCurrentTurn, turnKey }: { player: IPublicGamePlayer; isCurrentTurn: boolean; turnKey: string }) {
  return (
    <span className="relative shrink-0">
      <UtilsIf condition={isCurrentTurn}>
        {() => (
          <TurnRipple key={turnKey} />
        )}
      </UtilsIf>

      <span
        className={`relative flex items-center justify-center w-7 h-7 md:w-10 md:h-10 rounded-full bg-felt-night ring-2 ${isCurrentTurn ? 'ring-gold' : TEAM_RING[player.team]} font-display text-[15px] md:text-[21px] leading-none ${TEAM_TEXT[player.team]}`}
        aria-hidden="true"
      >
        {player.name.charAt(0).toUpperCase()}
      </span>
    </span>
  );
}

/**
 * A player around the table: opponents show their face-down hand in perspective plus a small
 * nameplate (avatar with the team colour, name, score and the Jogadas/Descartes left as pips);
 * the bottom seat (you) only shows the nameplate — your hand is right below the table.
 */
export function PlayerSeat({ player, isCurrentTurn, turnKey, side }: { player: IPublicGamePlayer; isCurrentTurn: boolean; turnKey: string; side: TurnChipSide }) {
  // Side seats are narrow on phones: the nameplate stacks (avatar over name/score) until `md`.
  const isSide = side === 'left' || side === 'right';

  return (
    <div className="relative flex flex-col items-center gap-1.5 min-w-0">
      <UtilsIf condition={side !== 'bottom'}>
        {() => (
          <HandFan
            count={player.hand_count}
            side={side as FanSide}
          />
        )}
      </UtilsIf>

      <div className={`relative min-w-0 max-w-full ${side === 'top' ? 'order-2' : ''}`}>
        <UtilsIf condition={isCurrentTurn}>
          {() => (
            <TurnChip
              side={side}
              turnKey={turnKey}
            />
          )}
        </UtilsIf>

        <div className={`flex items-center min-w-0 max-w-full bg-felt-night/85 shadow-[0_4px_12px_-6px_rgba(0,0,0,0.7)] ${isSide ? 'flex-col gap-1 px-1 pt-1 pb-1.5 rounded-2xl md:flex-row md:gap-2 md:pl-0.5 md:pr-3 md:py-0.5 md:rounded-full' : 'gap-2 pl-0.5 pr-3 py-0.5 rounded-full'} ${isCurrentTurn ? 'outline-2 outline-gold/70' : ''}`}>
          <Avatar
            player={player}
            isCurrentTurn={isCurrentTurn}
            turnKey={turnKey}
          />

          <div className={`flex flex-col min-w-0 max-w-full leading-none ${isSide ? 'items-center md:items-start' : ''}`}>
            <span className={`truncate max-w-full text-[12px] md:text-[15px] font-semibold ${isSide ? 'max-w-13 md:max-w-35' : ''} ${isCurrentTurn ? 'text-gold' : 'text-paper'}`}>
              {player.name}
            </span>

            <span className="font-display text-gold text-[15px] md:text-[18px] tabular-nums mt-0.5">
              {player.score}
            </span>
          </div>
        </div>
      </div>

      <div className={isSide ? 'flex flex-col items-center gap-1 md:flex-row md:gap-2' : 'flex items-center gap-2'}>
        <Pips
          label="Jogadas"
          total={INITIAL_MELDS}
          remaining={player.melds_remaining}
          activeColor="bg-gold"
        />

        <Pips
          label="Descartes"
          total={INITIAL_DISCARDS}
          remaining={player.discards_remaining}
          activeColor="bg-paper"
        />
      </div>
    </div>
  );
}
