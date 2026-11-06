'use client';

import { useState } from 'react';
import { SegmentedControl } from '@mantine/core';
import { UtilsIf } from '@/components/utils/If';
import { CreateRoomLogicComponent, useCreateRoomLogicData } from '@/resources/room/logics/CreateRoom';
import { JoinRoomLogicComponent, useJoinRoomLogicData } from '@/resources/room/logics/JoinRoom';

type JoinMode = 'create' | 'join';

export function HomeJoin({ createRoomLogicData, joinRoomLogicData }: {
  createRoomLogicData: ReturnType<typeof useCreateRoomLogicData>;
  joinRoomLogicData: ReturnType<typeof useJoinRoomLogicData>;
}) {
  const [mode, setMode] = useState<JoinMode>('create');

  return (
    <section
      id="jogar"
      className="felt-surface-deep text-paper home-frame min-h-[90svh] py-[clamp(72px,10vw,140px)] grid grid-cols-1 lg:grid-cols-12 gap-x-8 gap-y-12 items-end"
      aria-labelledby="jogar-titulo"
    >
      <div className="lg:col-span-6 flex flex-col gap-6 self-end">
        <span
          data-reveal
          className="flex items-center gap-3 text-[1.375rem] leading-none"
          aria-hidden="true"
        >
          <span className="text-suit-red">
            ♥
          </span>

          <span className="text-paper/70">
            ♠
          </span>

          <span className="text-suit-red">
            ♦
          </span>

          <span className="text-paper/70">
            ♣
          </span>
        </span>

        <h2
          id="jogar-titulo"
          data-reveal
          className="font-display font-normal text-[clamp(3.5rem,1.6rem+6.4vw,7rem)] leading-[0.92] tracking-[-0.02em]"
        >
          Puxe uma cadeira.
        </h2>

        <p
          data-reveal
          style={{ '--i': 1 } as React.CSSProperties}
          className="text-[1.1875rem] leading-[1.55] max-w-[38ch] text-paper/85"
        >
          Crie a sala e mande o código para três amigos. A partida começa quando a mesa encher.
        </p>
      </div>

      <div
        data-ui
        data-reveal
        style={{ '--i': 1 } as React.CSSProperties}
        className="lg:col-start-8 lg:col-span-5 xl:col-start-8 xl:col-span-4 w-full bg-paper text-ink px-6 py-7 md:px-8 md:py-8 border-t-4 border-gold shadow-[0_24px_60px_-20px_rgba(0,0,0,0.6)]"
        role="dialog"
        aria-labelledby="jogar-dialogo"
      >
        <p
          id="jogar-dialogo"
          className="font-display text-[1.875rem] leading-none"
        >
          Nova partida
        </p>

        <SegmentedControl
          value={mode}
          onChange={(value) => setMode(value as JoinMode)}
          fullWidth
          size="md"
          radius={0}
          color="dark"
          className="mt-6"
          data={[
            { value: 'create', label: 'Criar sala' },
            { value: 'join', label: 'Tenho um código' },
          ]}
        />

        <div className="mt-6">
          <UtilsIf
            cases={[
              {
                condition: mode === 'create',
                content: () => (
                  <CreateRoomLogicComponent logicData={createRoomLogicData} />
                ),
              },
              {
                content: () => (
                  <JoinRoomLogicComponent logicData={joinRoomLogicData} />
                ),
              },
            ]}
          />
        </div>
      </div>
    </section>
  );
}
