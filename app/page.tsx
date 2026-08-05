'use client';

import { useRouter } from 'next/navigation';
import { Icon } from '@iconify/react';
import { UtilsCard } from '@/components/utils/Card';
import { useCreateRoomLogicData, CreateRoomLogicComponent } from '@/resources/room/logics/CreateRoom';
import { useJoinRoomLogicData, JoinRoomLogicComponent } from '@/resources/room/logics/JoinRoom';

export default function Home() {
  const router = useRouter();

  const createRoomLogicData = useCreateRoomLogicData({
    onSuccess: (state) => router.push(`/rooms/${state.room.code}`),
  });

  const joinRoomLogicData = useJoinRoomLogicData({
    onSuccess: (state) => router.push(`/rooms/${state.room.code}`),
  });

  return (
    <main className="felt-surface flex flex-1 flex-col items-center justify-center px-6 py-16">
      <div className="flex flex-col items-center gap-10 max-w-4xl w-full text-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-16 h-16 rounded-2xl bg-secondary-500 flex items-center justify-center shadow-lg shadow-black/30">
            <Icon
              icon="lucide:spade"
              className="text-primary-900"
              width={32}
              height={32}
            />
          </div>

          <h1 className="text-5xl font-bold text-white tracking-tight">
            Cross Poker
          </h1>

          <p className="text-lg text-white/70">
            Um jogo de cartas em duplas para jogar com seus amigos, direto do navegador.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 w-full text-left">
          <UtilsCard className="flex flex-col gap-4">
            <div className="flex items-center gap-2">
              <Icon
                icon="lucide:sparkles"
                className="text-primary-600"
                width={20}
                height={20}
              />

              <h2 className="text-lg font-semibold text-gray-800">
                Criar uma sala
              </h2>
            </div>

            <p className="text-sm text-gray-500">
              Comece uma sala nova e compartilhe o código com 3 amigos para jogar.
            </p>

            <CreateRoomLogicComponent logicData={createRoomLogicData} />
          </UtilsCard>

          <UtilsCard className="flex flex-col gap-4">
            <div className="flex items-center gap-2">
              <Icon
                icon="lucide:log-in"
                className="text-secondary-600"
                width={20}
                height={20}
              />

              <h2 className="text-lg font-semibold text-gray-800">
                Entrar em uma sala
              </h2>
            </div>

            <p className="text-sm text-gray-500">
              Já tem um código? Digite seu nome e entre na sala dos seus amigos.
            </p>

            <JoinRoomLogicComponent logicData={joinRoomLogicData} />
          </UtilsCard>
        </div>
      </div>
    </main>
  );
}
