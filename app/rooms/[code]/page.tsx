'use client';

import { useEffect } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useMutation, useQuery } from '@tanstack/react-query';
import { notifications } from '@mantine/notifications';
import { Icon } from '@iconify/react';
import { UtilsFor } from '@/components/utils/For';
import { UtilsIf } from '@/components/utils/If';
import { FormButton } from '@/components/form/Button';
import { useServerSentEvent } from '@/utils/hooks';
import { resolveApiMessage } from '@/utils/apiMessage';
import { getRoomService, GET_ROOM_KEY } from '@/resources/room/services/getRoom';
import { startRoomService } from '@/resources/room/services/startRoom';

const TOTAL_SEATS = 4;

export default function RoomPage() {
  const { code } = useParams<{ code: string }>();
  const roomCode = String(code).toUpperCase();
  const router = useRouter();

  const {
    data: roomData,
    refetch: roomRefetch,
  } = useQuery({
    queryKey: GET_ROOM_KEY(roomCode),
    queryFn: ({ signal }) => getRoomService({ signal, code: roomCode }),
  });

  useServerSentEvent(`/api/rooms/${roomCode}/stream`, () => roomRefetch());

  const state = roomData?.data;
  const players = state?.players ?? [];
  const you = state?.you;

  useEffect(() => {
    if (state?.room.status === 'playing' && state.game_id) {
      router.push(`/games/${state.game_id}`);
    }
  }, [state?.room.status, state?.game_id, router]);

  const {
    mutate: startGame,
    isPending: startGameIsPending,
  } = useMutation({
    mutationFn: () => startRoomService({ code: roomCode }),
    onSuccess: (res) => {
      router.push(`/games/${res.data.game_id}`);
    },
    onError: (err: any) => {
      notifications.show({
        title: 'Erro',
        message: err?.message ? resolveApiMessage(err.message, 'pt-br') : 'Não foi possível iniciar a partida.',
        color: 'red',
      });
    },
  });

  const seats = Array.from({ length: TOTAL_SEATS }, (_, seat) => players.find((player) => player.seat === seat) ?? null);

  function copyCode() {
    navigator.clipboard.writeText(roomCode);

    notifications.show({ message: 'Código copiado!', color: 'green' });
  }

  const SEAT_PLACE = [
    'col-start-2 row-start-3',
    'col-start-1 row-start-2',
    'col-start-2 row-start-1',
    'col-start-3 row-start-2',
  ];

  return (
    <main className="felt-surface relative flex flex-1 flex-col min-h-[100svh] px-4 md:px-8 pb-12">
      <header className="flex items-center justify-between gap-4 pt-5 md:pt-7">
        <Link
          href="/"
          className="flex items-center gap-3 text-paper"
        >
          <Image
            src="/icon.svg"
            alt=""
            width={38}
            height={38}
            className="rounded-[6px]"
          />

          <span className="font-display text-[1.375rem]">
            Cross Poker
          </span>
        </Link>

        <span className="text-paper/85 text-[15px] tabular">
          {`${players.length} de ${TOTAL_SEATS} na mesa`}
        </span>
      </header>

      <div className="flex-1 grid grid-cols-1 lg:grid-cols-12 gap-x-8 gap-y-12 items-center pt-10 lg:pt-0 max-w-6xl w-full mx-auto">
        <div className="lg:col-span-5 flex flex-col gap-6">
          <h1 className="font-display font-normal text-paper text-[clamp(2.5rem,1.6rem+3vw,4rem)] leading-[0.95] tracking-[-0.02em]">
            Sala de espera
          </h1>

          <p className="text-paper text-[1.125rem] leading-[1.55] max-w-[36ch]">
            Mande este código para os amigos. Parceiros sentam frente a frente; a partida começa com os quatro lugares ocupados.
          </p>

          <button
            type="button"
            onClick={copyCode}
            className="group self-start flex items-center gap-5 bg-paper text-ink pl-6 pr-5 py-4 transition-transform hover:-translate-y-0.5 active:translate-y-px"
            aria-label={`Copiar código da sala ${roomCode}`}
          >
            <span className="font-display text-[clamp(2.5rem,1.8rem+2.4vw,3.5rem)] leading-none tracking-[0.14em] tabular">
              {roomCode}
            </span>

            <span className="flex items-center gap-1.5 text-[14px] text-ink-soft group-hover:text-ink">
              <Icon
                icon="lucide:copy"
                width={18}
                height={18}
              />

              Copiar
            </span>
          </button>

          <div className="mt-2">
            <UtilsIf
              cases={[
                {
                  condition: !!you?.is_host,
                  content: () => (
                    <FormButton
                      color="secondary"
                      size="lg"
                      radius={0}
                      disabled={players.length < TOTAL_SEATS}
                      loading={startGameIsPending}
                      onClick={() => startGame()}
                      rightIcon="lucide:play"
                    >
                      {players.length < TOTAL_SEATS ? `Aguardando jogadores (${players.length}/${TOTAL_SEATS})` : 'Iniciar partida'}
                    </FormButton>
                  ),
                },
                {
                  content: () => (
                    <p className="text-paper/85 text-[15px]">
                      {`Aguardando o anfitrião iniciar a partida (${players.length}/${TOTAL_SEATS} jogadores).`}
                    </p>
                  ),
                },
              ]}
            />
          </div>
        </div>

        <div className="lg:col-start-7 lg:col-span-6 relative grid grid-cols-[1fr_1.2fr_1fr] grid-rows-[auto_minmax(150px,1fr)_auto] gap-3 md:gap-4 items-center justify-items-center min-h-[420px]">
          <div
            className="col-start-1 col-span-3 row-start-1 row-span-3 self-stretch justify-self-stretch mx-[16%] my-[22%] rounded-[999px] bg-felt-deep border-[12px] border-[#3a2414]"
            aria-hidden="true"
          />

          <UtilsFor
            each={seats}
            eachKey={({ index }) => index}
          >
            {({ item: player, index }) => (
              <div
                className={`${SEAT_PLACE[index]} relative z-10 w-full max-w-[180px] flex flex-col gap-1 px-4 py-3 ${player ? 'bg-paper text-ink' : 'bg-felt-night text-paper/80'}`}
              >
                <span
                  className={`absolute left-0 top-0 bottom-0 w-1 ${index % 2 === 0 ? 'bg-team-a' : 'bg-team-b'}`}
                  aria-hidden="true"
                />

                <span className="font-display text-[20px] leading-tight truncate">
                  {player?.name ?? 'Lugar livre'}
                </span>

                <span className={`text-[13px] ${player ? 'text-ink-soft' : 'text-paper/70'}`}>
                  {[
                    `Equipe ${index % 2 === 0 ? 'A' : 'B'}`,
                    player?.is_host ? 'anfitrião' : null,
                    player && player.id === you?.id ? 'você' : null,
                  ].filter(Boolean).join(' · ')}
                </span>
              </div>
            )}
          </UtilsFor>
        </div>
      </div>
    </main>
  );
}
