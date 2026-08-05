'use client';

import { useMemo, useState } from 'react';
import { useParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { Icon } from '@iconify/react';
import { UtilsFor } from '@/components/utils/For';
import { UtilsIf } from '@/components/utils/If';
import { useServerSentEvent } from '@/utils/hooks';
import { FormButton } from '@/components/form/Button';
import { Card } from '@/resources/game/components/Card';
import { sortCardsBySuit, sortCardsByRank } from '@/resources/game/models/Card';
import { bestCombo } from '@/resources/game/models/Combo';
import { getGameService, GET_GAME_KEY } from '@/resources/game/services/getGame';
import { ETeam } from '@/resources/game/enums/ETeam';
import { IPublicGamePlayer } from '@/resources/game/models/GameState';
import {
  ChooseSwapLogicComponent,
  StartSwapLogicComponent,
  PendingSwapBanner,
  useChooseSwapLogicData,
  useStartSwapLogicData,
} from '@/resources/game/logics/PlaySwap';
import { usePlayMeldLogicData, PlayMeldLogicComponent } from '@/resources/game/logics/PlayMeld';
import { usePlayDiscardLogicData, PlayDiscardLogicComponent } from '@/resources/game/logics/PlayDiscard';
import { useChooseDrawSourceLogicData, ChooseDrawSourceLogicComponent } from '@/resources/game/logics/ChooseDrawSource';
import { DiscardPile } from '@/resources/game/components/DiscardPile';
import { ComboHelpButton } from '@/resources/game/components/ComboReference';
import { MeldScoreAnimationSelf } from '@/resources/game/components/MeldScoreAnimationSelf';
import { COMBO_NAME } from '@/resources/game/components/MeldScoreAnimation';
import { Scoreboard } from '@/resources/game/components/Scoreboard';
import { MeldScoreAnimationObservers } from '@/resources/game/components/MeldScoreAnimationObservers';
import { DrawAnimation } from '@/resources/game/components/DrawAnimation';
import { SwapAnimation } from '@/resources/game/components/SwapAnimation';
import { DiscardAnimation } from '@/resources/game/components/DiscardAnimation';
import type { PlayMeldServiceResponse } from '@/resources/game/services/playMeld';

const INITIAL_MELDS = 5;
const INITIAL_DISCARDS = 5;

const SEAT_POSITIONS = ['bottom', 'left', 'top', 'right'] as const;

function Pips({ total, remaining, activeColor }: { total: number; remaining: number; activeColor: string }) {
  return (
    <div className="flex gap-0.5">
      <UtilsFor
        each={Array.from({ length: total })}
        eachKey={({ index }) => index}
      >
        {({ index }) => (
          <span
            className={`w-1.5 h-1.5 rounded-full ${index < remaining ? activeColor : 'bg-white/20'}`}
          />
        )}
      </UtilsFor>
    </div>
  );
}

const TEAM_COLORS: Record<`${ETeam}`, { outline: string; active: string }> = {
  [ETeam.A]: {
    outline: 'border-orange-400/50',
    active: 'border-orange-400 ring-4 ring-orange-400/60 shadow-[0_0_16px_rgba(251,146,60,0.6)]',
  },
  [ETeam.B]: {
    outline: 'border-blue-400/50',
    active: 'border-blue-400 ring-4 ring-blue-400/60 shadow-[0_0_16px_rgba(96,165,250,0.6)]',
  },
};

function PlayerSeat({ player, isCurrentTurn, isYou }: { player: IPublicGamePlayer; isCurrentTurn: boolean; isYou: boolean }) {
  const colors = TEAM_COLORS[player.team];

  return (
    <div
      className={`flex flex-col items-center gap-1.5 px-4 py-3 rounded-xl bg-black/25 backdrop-blur-sm border-2 ${isCurrentTurn ? colors.active : colors.outline}`}
    >
      <div className="flex items-center gap-1.5">
        <Icon
          icon="lucide:user-round"
          className="text-white/80"
          width={14}
          height={14}
        />

        <span className="text-white font-semibold text-sm">
          {player.name}
        </span>

        <UtilsIf condition={isYou}>
          {() => (
            <span className="text-[10px] uppercase tracking-wide text-secondary-300 font-bold">
              Você
            </span>
          )}
        </UtilsIf>
      </div>

      <span className="text-[11px] text-white/50">
        Equipe {player.team} · {player.score} pts
      </span>

      <div className="flex items-center gap-3">
        <div className="flex flex-col items-center gap-0.5">
          <span className="text-[9px] uppercase text-white/40">
            Mesas
          </span>

          <Pips
            total={INITIAL_MELDS}
            remaining={player.melds_remaining}
            activeColor="bg-primary-400"
          />
        </div>

        <div className="flex flex-col items-center gap-0.5">
          <span className="text-[9px] uppercase text-white/40">
            Bolos
          </span>

          <Pips
            total={INITIAL_DISCARDS}
            remaining={player.discards_remaining}
            activeColor="bg-secondary-400"
          />
        </div>
      </div>

      <UtilsIf condition={!isYou}>
        {() => (
          <div className="flex gap-1 mt-1">
            <UtilsFor
              each={Array.from({ length: Math.min(player.hand_count, 8) })}
              eachKey={({ index }) => index}
            >
              {() => (
                <Card
                  card={null}
                  size="sm"
                  className="-mx-2 first:ml-0"
                />
              )}
            </UtilsFor>
          </div>
        )}
      </UtilsIf>
    </div>
  );
}

export default function GamePage() {
  const { gameId } = useParams<{ gameId: string }>();
  const id = Number(gameId);
  const [selectedCards, setSelectedCards] = useState<string[]>([]);
  const [meldResult, setMeldResult] = useState<PlayMeldServiceResponse | null>(null);
  const [handOrder, setHandOrder] = useState<'suit' | 'rank' | null>(null);

  const {
    data: gameData,
    refetch: gameRefetch,
  } = useQuery({
    queryKey: GET_GAME_KEY(id),
    queryFn: ({ signal }) => getGameService({ signal, gameId: id }),
  });

  useServerSentEvent(`/api/games/${id}/stream`, () => gameRefetch());

  const startSwapLogicData = useStartSwapLogicData({
    gameId: id,
    onSuccess: () => gameRefetch(),
  });

  const chooseSwapLogicData = useChooseSwapLogicData({
    gameId: id,
    onSuccess: () => gameRefetch(),
  });

  const playMeldLogicData = usePlayMeldLogicData({
    gameId: id,
    onSuccess: (result) => {
      setSelectedCards([]);
      setMeldResult(result);
      gameRefetch();
    },
  });

  const playDiscardLogicData = usePlayDiscardLogicData({
    gameId: id,
    onSuccess: () => {
      setSelectedCards([]);
      gameRefetch();
    },
  });

  const chooseDrawSourceLogicData = useChooseDrawSourceLogicData({
    gameId: id,
    onSuccess: () => gameRefetch(),
  });

  const state = gameData?.data;
  const you = state?.you;

  const playersBySeat = useMemo(() => {
    if (!state || !you) return [];

    return state.players.map((player) => {
      const relative = (player.seat - you.seat + 4) % 4;

      return { player, position: SEAT_POSITIONS[relative] };
    });
  }, [state, you]);

  const hand = useMemo(() => {
    if (!you?.hand) return [];

    if (handOrder === 'suit') return sortCardsBySuit(you.hand);
    if (handOrder === 'rank') return sortCardsByRank(you.hand);

    return you.hand;
  }, [you, handOrder]);

  function toggleSelection(cardId: string) {
    setSelectedCards((current) => {
      if (current.includes(cardId)) return current.filter((id_) => id_ !== cardId);
      if (current.length >= 5) return current;

      return [...current, cardId];
    });
  }

  const currentTurnPlayer = state?.players.find((player) => player.seat === state.current_seat);

  const comboPreview = useMemo(() => {
    if (selectedCards.length === 0) return null;

    const selectedCardObjects = hand.filter((card) => selectedCards.includes(card.id));

    return bestCombo(selectedCardObjects);
  }, [hand, selectedCards]);

  return (
    <main className="felt-surface relative flex flex-1 flex-col items-center px-4 py-6 gap-4">
      <div className="absolute top-4 right-4">
        <ComboHelpButton />
      </div>

      <Scoreboard players={state?.players ?? []} />

      <div className="w-full max-w-4xl flex items-center justify-center">
        <span className="px-4 py-1.5 rounded-full bg-black/30 text-white text-sm font-semibold backdrop-blur-sm">
          <UtilsIf condition={you?.is_your_turn}>
            {() => (
              <span className="text-secondary-300">
                É a sua vez!
              </span>
            )}
          </UtilsIf>

          <UtilsIf condition={!you?.is_your_turn}>
            {() => (
              <span>
                Vez de {currentTurnPlayer?.name ?? '...'}
              </span>
            )}
          </UtilsIf>
        </span>
      </div>

      <UtilsIf condition={!!state?.pending_swap}>
        {() => (
          <PendingSwapBanner state={state!} />
        )}
      </UtilsIf>

      <UtilsIf condition={!!state?.pending_draw}>
        {() => (
          <ChooseDrawSourceLogicComponent
            state={state!}
            logicData={chooseDrawSourceLogicData}
          />
        )}
      </UtilsIf>

      <div className="relative w-full max-w-4xl flex-1 grid grid-rows-3 gap-4 items-center">
        <MeldScoreAnimationSelf
          result={meldResult}
          onFinish={() => setMeldResult(null)}
        />

        <UtilsIf condition={!!state}>
          {() => (
            <>
              <MeldScoreAnimationObservers state={state!} />

              <DrawAnimation state={state!} />

              <SwapAnimation state={state!} />

              <DiscardAnimation state={state!} />
            </>
          )}
        </UtilsIf>

        <div className="row-start-1 flex justify-center">
          <UtilsFor each={playersBySeat.filter((p) => p.position === 'top')}>
            {({ item }) => (
              <PlayerSeat
                player={item.player}
                isCurrentTurn={state?.current_seat === item.player.seat}
                isYou={false}
              />
            )}
          </UtilsFor>
        </div>

        <div className="row-start-2 flex items-center justify-between">
          <UtilsFor each={playersBySeat.filter((p) => p.position === 'left')}>
            {({ item }) => (
              <PlayerSeat
                player={item.player}
                isCurrentTurn={state?.current_seat === item.player.seat}
                isYou={false}
              />
            )}
          </UtilsFor>

          <div className="flex items-center gap-6">
            <div className="flex flex-col items-center gap-1">
              <Card card={null} />

              <span className="text-white/70 text-xs">
                Monte ({state?.deck_count ?? 0})
              </span>
            </div>

            <DiscardPile discard={state?.discard ?? []} />
          </div>

          <UtilsFor each={playersBySeat.filter((p) => p.position === 'right')}>
            {({ item }) => (
              <PlayerSeat
                player={item.player}
                isCurrentTurn={state?.current_seat === item.player.seat}
                isYou={false}
              />
            )}
          </UtilsFor>
        </div>

        <div className="row-start-3 flex justify-center">
          <UtilsFor each={playersBySeat.filter((p) => p.position === 'bottom')}>
            {({ item }) => (
              <PlayerSeat
                player={item.player}
                isCurrentTurn={state?.current_seat === item.player.seat}
                isYou
              />
            )}
          </UtilsFor>
        </div>
      </div>

      <div className="w-full max-w-4xl flex flex-col items-center gap-3 pb-2">
        <div className="h-5 flex items-center">
          <UtilsIf condition={!!comboPreview}>
            {() => (
              <span className="text-secondary-300 text-sm font-bold uppercase tracking-wide">
                {COMBO_NAME[comboPreview!.type]}
              </span>
            )}
          </UtilsIf>
        </div>

        <div className="flex items-center gap-2">
          <FormButton
            variant="light"
            color="yellow"
            size="xs"
            rightIcon="lucide:layout-grid"
            onClick={() => setHandOrder(handOrder === 'suit' ? null : 'suit')}
          >
            Organizar por naipe
          </FormButton>

          <FormButton
            variant="light"
            color="yellow"
            size="xs"
            rightIcon="lucide:arrow-up-down"
            onClick={() => setHandOrder(handOrder === 'rank' ? null : 'rank')}
          >
            Organizar por valor
          </FormButton>
        </div>

        <div className="flex flex-wrap justify-center gap-2">
          <UtilsFor
            each={hand}
            eachKey={({ item }) => item.id}
          >
            {({ item }) => (
              <Card
                card={item}
                size="lg"
                selected={selectedCards.includes(item.id)}
                onClick={() => toggleSelection(item.id)}
              />
            )}
          </UtilsFor>
        </div>

        <UtilsIf condition={!!state}>
          {() => (
            <ChooseSwapLogicComponent
              state={state!}
              selectedCards={selectedCards}
              setSelectedCards={setSelectedCards}
              logicData={chooseSwapLogicData}
            />
          )}
        </UtilsIf>

        <div className="flex items-center gap-2">
          <PlayMeldLogicComponent
            logicData={playMeldLogicData}
            selectedCards={selectedCards}
            disabled={!you?.is_your_turn || !!state?.pending_swap || !!state?.pending_draw}
          />

          <PlayDiscardLogicComponent
            logicData={playDiscardLogicData}
            selectedCards={selectedCards}
            canPlay={!!you?.is_your_turn && !state?.pending_swap && !state?.pending_draw}
          />

          <StartSwapLogicComponent
            logicData={startSwapLogicData}
            disabled={!you?.is_your_turn || !!state?.pending_swap || !!state?.pending_draw}
          />
        </div>
      </div>
    </main>
  );
}
