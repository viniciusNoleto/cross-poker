'use client';

import { useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useMutation, useQuery } from '@tanstack/react-query';
import { notifications } from '@mantine/notifications';
import { Icon } from '@iconify/react';
import { UtilsCard } from '@/components/utils/Card';
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

  return (
    <main className="felt-surface flex flex-1 flex-col items-center justify-center px-6 py-16">
      <div className="flex flex-col items-center gap-8 max-w-xl w-full">
        <div className="flex flex-col items-center gap-2 text-center">
          <span className="text-white/60 text-sm uppercase tracking-widest">
            Sala de espera
          </span>

          <button
            type="button"
            onClick={copyCode}
            className="flex items-center gap-2 text-4xl font-bold text-white tracking-[0.3em] hover:text-secondary-300 transition-colors"
          >
            {roomCode}

            <Icon
              icon="lucide:copy"
              width={20}
              height={20}
            />
          </button>

          <span className="text-white/60 text-sm">
            Compartilhe este código com seus amigos.
          </span>
        </div>

        <UtilsCard className="w-full flex flex-col gap-4">
          <div className="grid grid-cols-2 gap-3">
            <UtilsFor
              each={seats}
              eachKey={({ index }) => index}
            >
              {({ item: player, index }) => (
                <div
                  className={`flex flex-col items-center gap-1 p-4 rounded-lg border-2 border-dashed ${player ? 'border-primary-300 bg-primary-50' : 'border-gray-200 bg-gray-50'}`}
                >
                  <Icon
                    icon={player ? 'lucide:user-round' : 'lucide:circle-dashed'}
                    className={player ? 'text-primary-600' : 'text-gray-300'}
                    width={28}
                    height={28}
                  />

                  <span className="font-semibold text-gray-800 text-sm">
                    {player?.name ?? `Assento ${index + 1}`}
                  </span>

                  <UtilsIf condition={player?.is_host}>
                    {() => (
                      <span className="text-[11px] uppercase tracking-wide text-secondary-600 font-semibold">
                        Anfitrião
                      </span>
                    )}
                  </UtilsIf>

                  <UtilsIf condition={player?.id === you?.id}>
                    {() => (
                      <span className="text-[11px] uppercase tracking-wide text-primary-600 font-semibold">
                        Você
                      </span>
                    )}
                  </UtilsIf>
                </div>
              )}
            </UtilsFor>
          </div>

          <UtilsIf condition={you?.is_host}>
            {() => (
              <FormButton
                color="primary"
                disabled={players.length < TOTAL_SEATS}
                loading={startGameIsPending}
                onClick={() => startGame()}
                rightIcon="lucide:play"
              >
                {players.length < TOTAL_SEATS ? `Aguardando jogadores (${players.length}/${TOTAL_SEATS})` : 'Iniciar partida'}
              </FormButton>
            )}
          </UtilsIf>

          <UtilsIf condition={!you?.is_host}>
            {() => (
              <p className="text-center text-sm text-gray-500">
                Aguardando o anfitrião iniciar a partida ({players.length}/{TOTAL_SEATS} jogadores).
              </p>
            )}
          </UtilsIf>
        </UtilsCard>
      </div>
    </main>
  );
}
