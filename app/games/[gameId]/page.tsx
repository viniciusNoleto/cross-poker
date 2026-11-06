'use client';

import { useMemo, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useMediaQuery } from '@mantine/hooks';
import { useQuery } from '@tanstack/react-query';
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

function Pips({ total, remaining, activeColor, label }: { total: number; remaining: number; activeColor: string; label: string }) {
  return (
    <div
      className="flex items-center gap-1.5"
      title={`${label}: ${remaining} de ${total}`}
    >
      <span className="hidden md:inline text-[12px] text-paper/80 w-10">
        {label}
      </span>

      <div className="flex gap-[3px]">
        <UtilsFor
          each={Array.from({ length: total })}
          eachKey={({ index }) => index}
        >
          {({ index }) => (
            <span
              className={`w-2 h-2 rotate-45 ${index < remaining ? activeColor : 'bg-paper/15'}`}
            />
          )}
        </UtilsFor>
      </div>
    </div>
  );
}

const TEAM_SWATCH: Record<`${ETeam}`, string> = {
  [ETeam.A]: 'bg-team-a',
  [ETeam.B]: 'bg-team-b',
};

function PlayerSeat({ player, isCurrentTurn, isYou }: { player: IPublicGamePlayer; isCurrentTurn: boolean; isYou: boolean }) {
  return (
    <div
      className={`relative flex flex-col gap-2 [@media(max-height:760px)]:gap-1 px-3 py-2.5 md:px-4 md:py-3 [@media(max-height:760px)]:py-2! bg-felt-night min-w-0 max-w-[132px] md:max-w-none transition-[outline-color] duration-300 outline-[3px] ${isCurrentTurn ? 'outline-gold' : 'outline-transparent'}`}
    >
      <span
        className={`absolute left-0 top-0 bottom-0 w-1 ${TEAM_SWATCH[player.team]}`}
        aria-hidden="true"
      />

      <div className="flex items-baseline justify-between gap-3 min-w-0">
        <span className="font-display text-paper text-[17px] md:text-[20px] leading-tight truncate">
          {player.name}
        </span>

        <span className="font-display text-gold text-[17px] md:text-[20px] leading-tight tabular">
          {player.score}
        </span>
      </div>

      <span className="text-[12px] text-paper/80 -mt-1.5 truncate">
        <UtilsIf
          cases={[
            {
              condition: isCurrentTurn,
              content: () => (
                <span className="text-gold font-bold">
                  {isYou ? 'Sua vez' : 'Jogando agora'}
                </span>
              ),
            },
            {
              content: () => (
                <span>
                  {`Equipe ${player.team}${isYou ? ' · você' : ''}`}
                </span>
              ),
            },
          ]}
        />
      </span>

      <div className="flex flex-col gap-1 [@media(max-height:860px)]:md:flex-row [@media(max-height:860px)]:md:gap-3">
        <Pips
          label="Mesas"
          total={INITIAL_MELDS}
          remaining={player.melds_remaining}
          activeColor="bg-gold"
        />

        <Pips
          label="Bolos"
          total={INITIAL_DISCARDS}
          remaining={player.discards_remaining}
          activeColor="bg-paper"
        />
      </div>

      <UtilsIf condition={!isYou}>
        {() => (
          <div className="hidden md:flex [@media(max-height:860px)]:hidden! mt-0.5 pl-2">
            <UtilsFor
              each={Array.from({ length: Math.min(player.hand_count, 8) })}
              eachKey={({ index }) => index}
            >
              {() => (
                <Card
                  card={null}
                  size="sm"
                  className="-ml-3.5 first:ml-0"
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
  const isPhone = useMediaQuery('(max-width: 639px)');
  const isShort = useMediaQuery('(max-height: 760px)');

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

  const isSwapParticipant = !!state?.pending_swap && !!you
    && (state.pending_swap.initiator_seat === you.seat || state.pending_swap.partner_seat === you.seat);

  const currentTurnPlayer = state?.players.find((player) => player.seat === state.current_seat);

  const comboPreview = useMemo(() => {
    if (selectedCards.length === 0) return null;

    const selectedCardObjects = hand.filter((card) => selectedCards.includes(card.id));

    return bestCombo(selectedCardObjects);
  }, [hand, selectedCards]);

  return (
    <main className="felt-surface-deep relative flex flex-col h-[100svh] overflow-hidden">
      <header className="shrink-0 flex items-center justify-between gap-3 px-3 md:px-6 pt-3 md:pt-4">
        <Link
          href="/"
          className="flex items-center gap-2.5 text-paper shrink-0"
          aria-label="Cross Poker, voltar ao início"
        >
          <Image
            src="/icon.svg"
            alt=""
            width={34}
            height={34}
            className="rounded-[5px]"
          />

          <span className="hidden md:inline font-display text-[20px]">
            Cross Poker
          </span>
        </Link>

        <Scoreboard players={state?.players ?? []} />

        <div className="shrink-0">
          <ComboHelpButton />
        </div>
      </header>

      <div className="shrink-0 flex flex-wrap items-center justify-center gap-x-4 gap-y-1 pt-3 md:pt-4 px-3 min-h-[34px]">
        <span
          className="font-display text-[22px] md:text-[26px] leading-none"
          aria-live="polite"
        >
          <UtilsIf
            cases={[
              {
                condition: !!you?.is_your_turn,
                content: () => (
                  <span className="text-gold italic">
                    Sua vez
                  </span>
                ),
              },
              {
                content: () => (
                  <span className="text-paper">
                    {`Vez de ${currentTurnPlayer?.name ?? '...'}`}
                  </span>
                ),
              },
            ]}
          />
        </span>

        <UtilsIf condition={!!state?.pending_swap}>
          {() => (
            <PendingSwapBanner state={state!} />
          )}
        </UtilsIf>

      </div>

      <div className="relative w-full max-w-4xl mx-auto flex-1 grid grid-rows-[auto_1fr_auto] gap-3 md:gap-4 items-center px-2 md:px-4 py-3 min-h-0">
        <div
          className="pointer-events-none absolute left-[12%] right-[12%] top-[16%] bottom-[16%] md:left-[18%] md:right-[18%] rounded-[999px] bg-felt border-[10px] md:border-[14px] border-[#3a2414]"
          aria-hidden="true"
        />

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

        <div className="relative row-start-1 flex justify-center">
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

        <div className="relative row-start-2 flex items-center justify-between gap-2">
          <UtilsFor each={playersBySeat.filter((p) => p.position === 'left')}>
            {({ item }) => (
              <PlayerSeat
                player={item.player}
                isCurrentTurn={state?.current_seat === item.player.seat}
                isYou={false}
              />
            )}
          </UtilsFor>

          <div className="flex items-start gap-4 md:gap-8">
            <div className="flex flex-col items-center gap-1.5">
              <div className="relative">
                <Card
                  card={null}
                  className="absolute! top-0 left-0 translate-x-[3px] translate-y-[3px]"
                />

                <Card card={null} />
              </div>

              <span className="text-paper/85 text-[13px] tabular">
                {`Monte (${state?.deck_count ?? 0})`}
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

        <div className="relative row-start-3 flex justify-center">
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

      <section
        className="shrink-0 bg-felt-night w-full flex flex-col items-center gap-3 px-3 pt-3 md:pt-4 pb-4 md:pb-5"
        aria-label="Sua mão"
      >
        <div className="w-full max-w-4xl flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
          <span className="font-display italic text-gold text-[22px] leading-none min-h-[22px]">
            <UtilsIf
              cases={[
                {
                  condition: !!comboPreview,
                  content: () => (
                    <span>
                      {`${COMBO_NAME[comboPreview!.type]} · ${comboPreview!.points} pts`}
                    </span>
                  ),
                },
                {
                  content: () => (
                    <span className="not-italic font-sans text-[14px] text-paper/80">
                      Selecione de 1 a 5 cartas
                    </span>
                  ),
                },
              ]}
            />
          </span>

          <div className="flex items-center gap-1">
            <FormButton
              variant={handOrder === 'suit' ? 'filled' : 'subtle'}
              color={handOrder === 'suit' ? 'secondary' : 'gray.0'}
              size="xs"
              radius={0}
              rightIcon="lucide:layout-grid"
              onClick={() => setHandOrder(handOrder === 'suit' ? null : 'suit')}
            >
              Naipe
            </FormButton>

            <FormButton
              variant={handOrder === 'rank' ? 'filled' : 'subtle'}
              color={handOrder === 'rank' ? 'secondary' : 'gray.0'}
              size="xs"
              radius={0}
              rightIcon="lucide:arrow-up-down"
              onClick={() => setHandOrder(handOrder === 'rank' ? null : 'rank')}
            >
              Valor
            </FormButton>
          </div>
        </div>

        <div className="flex justify-center pt-3 pl-3 md:pl-0 md:gap-2">
          <UtilsFor
            each={hand}
            eachKey={({ item }) => item.id}
          >
            {({ item }) => (
              <Card
                card={item}
                size={isPhone || isShort ? 'md' : 'lg'}
                selected={selectedCards.includes(item.id)}
                onClick={() => toggleSelection(item.id)}
                className="-ml-2.5 md:ml-0"
              />
            )}
          </UtilsFor>
        </div>

        {/* The draw-source choice and the swap choice take the place of the action buttons
            (which are blocked meanwhile anyway), so the dock never grows and the screen never scrolls. */}
        <div className="min-h-[42px] flex items-center justify-center">
          <UtilsIf
            cases={[
              {
                condition: !!you?.needs_to_choose_draw,
                content: () => (
                  <ChooseDrawSourceLogicComponent
                    state={state!}
                    logicData={chooseDrawSourceLogicData}
                  />
                ),
              },
              {
                condition: isSwapParticipant,
                content: () => (
                  <ChooseSwapLogicComponent
                    state={state!}
                    selectedCards={selectedCards}
                    setSelectedCards={setSelectedCards}
                    logicData={chooseSwapLogicData}
                  />
                ),
              },
              {
                content: () => (
                  <div className="flex flex-wrap items-center justify-center gap-2">
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
                ),
              },
            ]}
          />
        </div>
      </section>
    </main>
  );
}
