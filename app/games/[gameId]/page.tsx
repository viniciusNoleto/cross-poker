'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { motion } from 'motion/react';
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
import { DiscardPile } from '@/resources/game/components/DiscardPile';
import { MeldPile } from '@/resources/game/components/MeldPile';
import { GameResult, gameOutcomeFor, gameResultTitle } from '@/resources/game/components/GameResult';
import { GameEndAnimation } from '@/resources/game/components/GameEndAnimation';
import { SoundToggle } from '@/resources/game/components/SoundToggle';
import { MusicControl } from '@/resources/game/components/MusicControl';
import { startGameMusic, stopGameMusic } from '@/utils/music';
import { EGameStatus } from '@/resources/game/enums/EGameStatus';
import { EActionType } from '@/resources/game/enums/EActionType';
import { teamsWithMelds } from '@/resources/game/models/Turn';
import { sounds } from '@/utils/sound';
import { ComboHelpButton } from '@/resources/game/components/ComboReference';
import { COMBO_NAME } from '@/resources/game/components/MeldScoreAnimation';
import { Scoreboard } from '@/resources/game/components/Scoreboard';
import { MeldScoreAnimationLayer } from '@/resources/game/components/MeldScoreAnimationLayer';
import { DrawSourcePicker } from '@/resources/game/components/DrawSourcePicker';
import { DrawAnimation } from '@/resources/game/components/DrawAnimation';
import { SwapAnimation } from '@/resources/game/components/SwapAnimation';
import { DiscardAnimation } from '@/resources/game/components/DiscardAnimation';
import { EDrawSource } from '@/resources/game/enums/EDrawSource';
import { TurnChip, TurnChipSide } from '@/resources/game/components/TurnChip';

const INITIAL_MELDS = 5;
const INITIAL_DISCARDS = 5;

const SEAT_POSITIONS = ['bottom', 'left', 'top', 'right'] as const;

// How long the board stays up after the game finishes, so the last action's animation (a Jogada's
// score count is the longest) can finish before the end celebration and the result screen.
const RESULT_DELAY_AFTER_MELD_MS = 5500;
const RESULT_DELAY_MS = 1500;

function Pips({ total, remaining, activeColor, label }: { total: number; remaining: number; activeColor: string; label: string }) {
  return (
    <div
      className="flex items-center gap-1.5"
      title={`${label}: ${remaining} de ${total}`}
    >
      <span className="hidden md:inline text-[12px] text-paper/80 w-[60px]">
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

const TURN_RIPPLES = [0, 1, 2];

// Rings that pop out around the seat and drift away, fading, when the turn reaches it.
function TurnRipple() {
  return (
    <UtilsFor
      each={TURN_RIPPLES}
      eachKey={({ item }) => item}
    >
      {({ item }) => (
        <motion.span
          className="pointer-events-none absolute border-2 border-gold"
          initial={{ top: 0, right: 0, bottom: 0, left: 0, opacity: 0.95 }}
          animate={{ top: -30, right: -30, bottom: -30, left: -30, opacity: 0 }}
          transition={{ duration: 1.2, delay: item * 0.32, ease: 'easeOut' }}
          aria-hidden="true"
        />
      )}
    </UtilsFor>
  );
}

function PlayerSeat({ player, isCurrentTurn, isYou, turnKey, side }: { player: IPublicGamePlayer; isCurrentTurn: boolean; isYou: boolean; turnKey: string; side: TurnChipSide }) {
  return (
    <div className="relative flex flex-col gap-2 [@media(max-height:760px)]:gap-1 px-3 py-2.5 md:px-4 md:py-3 [@media(max-height:760px)]:py-2! bg-felt-night min-w-0 max-w-[132px] md:max-w-none">
      <span
        className={`absolute left-0 top-0 bottom-0 w-1 ${TEAM_SWATCH[player.team]}`}
        aria-hidden="true"
      />

      <UtilsIf condition={isCurrentTurn}>
        {() => (
          <>
            <TurnRipple key={turnKey} />

            <TurnChip
              side={side}
              turnKey={turnKey}
            />
          </>
        )}
      </UtilsIf>

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
  // Jogada/Descarte clicked, waiting for the draw-source choice (nothing sent yet — action + draw
  // go in a single request, see game-concept.md, "Compra junto com a ação").
  // Tied to the `last_action.id` seen when it was opened, so any new action (turn passed, Swap
  // resolved…) discards a stale choice.
  const [drawChoiceRequest, setDrawChoiceRequest] = useState<{ type: EActionType.MELD | EActionType.DISCARD; lastActionId: number | null } | null>(null);
  // Last Jogada (`last_action.id`) whose score count already finished on screen.
  const [scoredMeldId, setScoredMeldId] = useState<number | null>(null);
  const [handOrder, setHandOrder] = useState<'suit' | 'rank' | null>(null);
  const isPhone = useMediaQuery('(max-width: 639px)');
  const isShort = useMediaQuery('(max-height: 760px)');
  const [showResult, setShowResult] = useState(false);
  const [celebrating, setCelebrating] = useState(false);
  const seenPlayingRef = useRef(false);
  const lastTurnKeyRef = useRef<string | undefined>(undefined);
  // Last turn shown on screen outside a score count — kept while the next Jogada's count plays.
  const [settledTurnKey, setSettledTurnKey] = useState<string | null>(null);

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
    onSuccess: () => {
      setSelectedCards([]);
      setDrawChoiceRequest(null);
      gameRefetch();
    },
  });

  const playDiscardLogicData = usePlayDiscardLogicData({
    gameId: id,
    onSuccess: () => {
      setSelectedCards([]);
      setDrawChoiceRequest(null);
      gameRefetch();
    },
  });

  const {
    playMeldMutation: {
      mutate: playMeldMutate,
      isPending: playMeldIsPending,
      variables: playMeldVariables,
    },
  } = playMeldLogicData;

  const {
    playDiscardMutation: {
      mutate: playDiscardMutate,
      isPending: playDiscardIsPending,
      variables: playDiscardVariables,
    },
  } = playDiscardLogicData;

  const actionIsPending = playMeldIsPending || playDiscardIsPending;

  const state = gameData?.data;
  const you = state?.you;
  const lastAction = state?.last_action;

  // A Jogada's score count is on screen: its points stay out of the scoreboard and the turn stays
  // with whoever played until the count ends — only then the turn passes (chip, ripple, sound,
  // "Sua vez"), so the count and the next turn don't happen (and sound) at the same time.
  const scoreCounting = !!you && !showResult && lastAction?.type === EActionType.MELD
    && typeof lastAction.points === 'number' && lastAction.id !== scoredMeldId;

  // Changes every time the turn moves (even back to the same seat), replaying the seat's ring.
  const liveTurnKey = `${lastAction?.id ?? 'start'}-${state?.current_seat ?? ''}`;

  if (state && !scoreCounting && settledTurnKey !== liveTurnKey) setSettledTurnKey(liveTurnKey);

  const shownTurnSeat = scoreCounting ? lastAction!.seat : state?.current_seat;
  const turnKey = scoreCounting ? (settledTurnKey ?? 'counting') : liveTurnKey;
  const isYourShownTurn = !!you && shownTurnSeat === you.seat;

  const canAct = !!you?.is_your_turn && !scoreCounting && !state?.pending_swap;

  const drawChoice = drawChoiceRequest
    && (canAct || actionIsPending)
    && drawChoiceRequest.lastActionId === (state?.last_action?.id ?? null)
    ? drawChoiceRequest.type
    : null;

  function openDrawChoice(type: EActionType.MELD | EActionType.DISCARD) {
    if (type === EActionType.MELD) sounds.chooseMeld();
    else sounds.chooseDiscard();

    setDrawChoiceRequest({ type, lastActionId: state?.last_action?.id ?? null });
  }

  // While a Jogada's score count is on screen, its points stay out of the scoreboard/seats — they
  // only go up when the count ends, the same moment for everyone.
  const displayedPlayers = useMemo(() => {
    const players = state?.players ?? [];

    if (!scoreCounting) return players;

    return players.map((player) => (player.seat === lastAction!.seat
      ? { ...player, score: player.score - lastAction!.points! }
      : player));
  }, [state, scoreCounting, lastAction]);

  const playersBySeat = useMemo(() => {
    if (!state || !you) return [];

    return displayedPlayers.map((player) => {
      const relative = (player.seat - you.seat + 4) % 4;

      return { player, position: SEAT_POSITIONS[relative] };
    });
  }, [state, you, displayedPlayers]);

  const hand = useMemo(() => {
    if (!you?.hand) return [];

    if (handOrder === 'suit') return sortCardsBySuit(you.hand);
    if (handOrder === 'rank') return sortCardsByRank(you.hand);

    return you.hand;
  }, [you, handOrder]);

  function toggleSelection(cardId: string) {
    // The selection is locked while choosing the draw source (it's what will be sent).
    if (drawChoice || actionIsPending) return;

    if (selectedCards.includes(cardId)) {
      sounds.cardDeselect();
      setSelectedCards(selectedCards.filter((id_) => id_ !== cardId));

      return;
    }

    if (selectedCards.length >= 5) return;

    sounds.cardSelect();
    setSelectedCards([...selectedCards, cardId]);
  }

  function pickDrawSource(source: `${EDrawSource}`) {
    if (source === EDrawSource.DECK) sounds.chooseDeck();
    else sounds.chooseDiscardPile();

    if (drawChoice === EActionType.MELD) playMeldMutate({ cards: selectedCards, source });
    else if (drawChoice === EActionType.DISCARD) playDiscardMutate({ cards: selectedCards, source });
  }


  const isSwapParticipant = !!state?.pending_swap && !!you
    && (state.pending_swap.initiator_seat === you.seat || state.pending_swap.partner_seat === you.seat);

  const currentTurnPlayer = state?.players.find((player) => player.seat === shownTurnSeat);

  const status = state?.status;
  const lastActionType = state?.last_action?.type;

  // Result screen: shown right away when the game was already over on load; when it ends while
  // you're watching, the board stays up a moment (last animation) and then the end celebration plays.
  useEffect(() => {
    if (!status) return undefined;

    if (status === EGameStatus.PLAYING) {
      seenPlayingRef.current = true;

      return undefined;
    }

    if (showResult) return undefined;

    const watchedTheEnd = seenPlayingRef.current;
    const delay = !watchedTheEnd ? 0 : (lastActionType === EActionType.MELD ? RESULT_DELAY_AFTER_MELD_MS : RESULT_DELAY_MS);

    const timer = setTimeout(() => {
      setShowResult(true);
      setCelebrating(watchedTheEnd);
    }, delay);

    return () => clearTimeout(timer);
  }, [status, showResult, lastActionType]);

  // Background music: plays (on loop, fading in) while the Partida is being played; fades out
  // when it ends or when leaving the screen.
  useEffect(() => {
    if (status !== EGameStatus.PLAYING) return undefined;

    startGameMusic();

    return () => stopGameMusic();
  }, [status]);

  // Turn sounds: play who's next (you, your partner or an opponent) whenever the turn shown on
  // screen moves — after a Jogada, that's only once its score count ended (see `scoreCounting`).
  // Skipped on the first snapshot and once the game is over.
  useEffect(() => {
    if (!state || !you) return undefined;

    if (lastTurnKeyRef.current === undefined) {
      lastTurnKeyRef.current = turnKey;

      return undefined;
    }

    if (lastTurnKeyRef.current === turnKey) return undefined;

    lastTurnKeyRef.current = turnKey;

    if (state.status !== EGameStatus.PLAYING || shownTurnSeat === undefined) return undefined;

    const seat = shownTurnSeat;
    // Right after a score count the table is already quiet; after other actions, wait for their
    // own animation sounds (cards flying, draw) to pass.
    const delay = lastActionType === EActionType.MELD ? 250 : 600;

    const timer = setTimeout(() => {
      if (seat === you.seat) sounds.yourTurn();
      else if (seat % 2 === you.seat % 2) sounds.allyTurn();
      else sounds.opponentTurn();
    }, delay);

    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [turnKey]);

  // Early-finish warning: one team is out of Jogadas, so the game ends as soon as the other one
  // gets ahead (see `gameEndReason` in Turn.ts) — said out loud to avoid surprises.
  const earlyFinishWarning = useMemo(() => {
    if (!state || state.status !== EGameStatus.PLAYING) return null;

    const remaining = teamsWithMelds(state.players);

    if (remaining.length !== 1) return null;

    const team = remaining[0];
    const other = team === ETeam.A ? ETeam.B : ETeam.A;

    return `A Equipe ${other} não tem mais jogadas. A partida acaba assim que a Equipe ${team} passar à frente no placar (ou quando ela também ficar sem jogadas).`;
  }, [state]);

  const comboPreview = useMemo(() => {
    if (selectedCards.length === 0) return null;

    const selectedCardObjects = hand.filter((card) => selectedCards.includes(card.id));

    return bestCombo(selectedCardObjects);
  }, [hand, selectedCards]);

  return (
    <main className="felt-surface-deep relative flex flex-col h-dvh overflow-hidden">
      {/* Three columns, the side ones of equal width: the scoreboard sits exactly in the middle. */}
      <header className="shrink-0 grid grid-cols-[1fr_auto_1fr] items-center gap-3 px-3 md:px-6 pt-3 md:pt-4">
        <Link
          href="/"
          className="justify-self-start flex items-center gap-2.5 text-paper shrink-0"
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

        <Scoreboard players={displayedPlayers} />

        {/* Wraps (upward, via wrap-reverse) when its 1fr column gets too narrow, so the
            buttons never push the scoreboard off the center. */}
        <div className="justify-self-end min-w-0 flex flex-wrap-reverse items-center justify-end gap-1">
          <MusicControl />

          <SoundToggle />

          <ComboHelpButton />
        </div>
      </header>

      <UtilsIf condition={celebrating && !!state}>
        {() => (
          <GameEndAnimation
            outcome={gameOutcomeFor(state!)}
            title={gameResultTitle(state!)}
            onFinish={() => setCelebrating(false)}
          />
        )}
      </UtilsIf>

      <UtilsIf
        cases={[
          {
            condition: showResult && !!state,
            content: () => (
              <GameResult state={state!} />
            ),
          },
          {
            content: () => (
              <>
                <div className="shrink-0 flex flex-wrap items-center justify-center gap-x-4 gap-y-1 pt-3 md:pt-4 px-3 min-h-[34px]">
                  <span
                    className="font-display text-[22px] md:text-[26px] leading-none"
                    aria-live="polite"
                  >
                    <UtilsIf
                      cases={[
                        {
                          condition: status === EGameStatus.FINISHED,
                          content: () => (
                            <span className="text-gold italic">
                              Fim de partida!
                            </span>
                          ),
                        },
                        {
                          condition: isYourShownTurn,
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

                <UtilsIf condition={!!earlyFinishWarning}>
                  {() => (
                    <div
                      className="shrink-0 mx-auto mt-2 max-w-2xl flex items-start gap-2 bg-felt-night/80 border-l-4 border-gold px-3 py-2 text-paper text-[13px] leading-snug"
                      role="status"
                    >
                      <span className="text-gold font-bold shrink-0">
                        Atenção:
                      </span>

                      <span>
                        {earlyFinishWarning}
                      </span>
                    </div>
                  )}
                </UtilsIf>

                <div className="relative w-full max-w-4xl mx-auto flex-1 grid grid-rows-[auto_1fr_auto] gap-3 md:gap-4 items-center px-2 md:px-4 py-3 min-h-0">
                  <div
                    className="pointer-events-none absolute left-[12%] right-[12%] top-[16%] bottom-[16%] md:left-[18%] md:right-[18%] rounded-[999px] bg-felt border-[10px] md:border-[14px] border-[#3a2414]"
                    aria-hidden="true"
                  />

                  <UtilsIf condition={!!state}>
                    {() => (
                      <>
                        <MeldScoreAnimationLayer
                          state={state!}
                          onScoreCounted={setScoredMeldId}
                        />

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
                          side="top"
                          isCurrentTurn={shownTurnSeat === item.player.seat}
                          turnKey={turnKey}
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
                          side="left"
                          isCurrentTurn={shownTurnSeat === item.player.seat}
                          turnKey={turnKey}
                          isYou={false}
                        />
                      )}
                    </UtilsFor>

                    <div className="flex items-start gap-3 md:gap-6">
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

                      <MeldPile meldPile={state?.meld_pile ?? []} />

                      <DiscardPile count={state?.discard_count ?? 0} />
                    </div>

                    <UtilsFor each={playersBySeat.filter((p) => p.position === 'right')}>
                      {({ item }) => (
                        <PlayerSeat
                          player={item.player}
                          side="right"
                          isCurrentTurn={shownTurnSeat === item.player.seat}
                          turnKey={turnKey}
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
                          side="bottom"
                          isCurrentTurn={shownTurnSeat === item.player.seat}
                          turnKey={turnKey}
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
                        rightIcon="lucide:layout-grid"
                        onClick={() => setHandOrder(handOrder === 'suit' ? null : 'suit')}
                      >
                        Naipe
                      </FormButton>

                      <FormButton
                        variant={handOrder === 'rank' ? 'filled' : 'subtle'}
                        color={handOrder === 'rank' ? 'secondary' : 'gray.0'}
                        size="xs"
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
                          condition: !!drawChoice && !!state,
                          content: () => (
                            <DrawSourcePicker
                              state={state!}
                              actionType={drawChoice!}
                              quantity={selectedCards.length}
                              pendingSource={(playMeldIsPending ? playMeldVariables?.source : (playDiscardIsPending ? playDiscardVariables?.source : null)) ?? null}
                              onPick={pickDrawSource}
                              onCancel={() => setDrawChoiceRequest(null)}
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
                                selectedCards={selectedCards}
                                disabled={!canAct}
                                onChooseSource={() => openDrawChoice(EActionType.MELD)}
                              />

                              <PlayDiscardLogicComponent
                                selectedCards={selectedCards}
                                canPlay={canAct}
                                onChooseSource={() => openDrawChoice(EActionType.DISCARD)}
                              />

                              <StartSwapLogicComponent
                                logicData={startSwapLogicData}
                                disabled={!canAct}
                                partnerName={state?.players.find((player) => you && player.seat === (you.seat + 2) % 4)?.name}
                              />
                            </div>
                          ),
                        },
                      ]}
                    />
                  </div>
                </section>
              </>
            ),
          },
        ]}
      />
    </main>
  );
}
