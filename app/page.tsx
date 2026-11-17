'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useCreateRoomLogicData } from '@/resources/room/logics/CreateRoom';
import { useJoinRoomLogicData } from '@/resources/room/logics/JoinRoom';
import { HomeHero } from '@/resources/game/fragments/Home/Hero';
import { HomeLiveMeld } from '@/resources/game/fragments/Home/LiveMeld';
import { HomeHowItWorks } from '@/resources/game/fragments/Home/HowItWorks';
import { HomeActions } from '@/resources/game/fragments/Home/Actions';
import { HomeCombos } from '@/resources/game/fragments/Home/Combos';
import { HomeOrigin } from '@/resources/game/fragments/Home/Origin';
import { HomeJoin, type JoinMode } from '@/resources/game/fragments/Home/Join';
import { HomeFooter } from '@/resources/game/fragments/Home/Footer';
import { useReveal } from '@/resources/game/fragments/Home/useReveal';
import '@/resources/game/fragments/Home/home.css';

export default function Home() {
  const router = useRouter();

  const [joinMode, setJoinMode] = useState<JoinMode>('create');

  const createRoomLogicData = useCreateRoomLogicData({
    onSuccess: (state) => router.push(`/rooms/${state.room.code}`),
  });

  const joinRoomLogicData = useJoinRoomLogicData({
    onSuccess: (state) => router.push(`/rooms/${state.room.code}`),
  });

  useReveal();

  return (
    <div className="flex-1 bg-felt-night">
      <main className="curtain-main bg-felt-night">
        <HomeHero onChooseJoinMode={setJoinMode} />

        <HomeLiveMeld />

        <HomeHowItWorks />

        <HomeActions />

        <HomeCombos />

        <HomeOrigin />

        <HomeJoin
          mode={joinMode}
          setMode={setJoinMode}
          createRoomLogicData={createRoomLogicData}
          joinRoomLogicData={joinRoomLogicData}
        />
      </main>

      <HomeFooter />
    </div>
  );
}
