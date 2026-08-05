'use client';

import { useMemo, useState } from 'react';
import { Modal } from '@mantine/core';
import { UtilsFor } from '@/components/utils/For';
import { UtilsIf } from '@/components/utils/If';
import { Card } from './Card';
import type { IDiscardCard } from '../models/GameState';

export type DiscardPileProps = {
  discard: IDiscardCard[];
};

export function DiscardPile({ discard }: DiscardPileProps) {
  const [opened, setOpened] = useState(false);

  // `discard` comes in bottom→top order (top = last element, see Draw.ts). The modal lists in
  // draw order: top first, since that's the next card to be drawn from there.
  const discardInDrawOrder = useMemo(() => [...discard].reverse(), [discard]);

  return (
    <>
      <div
        className="flex flex-col items-center gap-1 cursor-default"
        onMouseEnter={() => {
          if (discard.length) setOpened(true);
        }}
      >
        <div className="flex -space-x-8">
          <UtilsFor
            each={discard.slice(-4)}
            eachKey={({ index }) => index}
          >
            {({ item }) => (
              <Card card={item.card} />
            )}
          </UtilsFor>

          <UtilsIf condition={!discard.length}>
            {() => (
              <div className="w-12 h-16 rounded-md border-2 border-dashed border-white/20" />
            )}
          </UtilsIf>
        </div>

        <span className="text-white/70 text-xs">
          {`Bolo (${discard.length})`}
        </span>
      </div>

      <Modal
        opened={opened}
        onClose={() => setOpened(false)}
        title="Bolo"
        size="xl"
        centered
      >
        <div
          onMouseLeave={() => setOpened(false)}
          className="flex flex-wrap gap-2 min-h-16 overflow-y-auto p-4"
        >
          <UtilsIf condition={!discard.length}>
            {() => (
              <span className="text-gray-400 text-xs">
                Bolo vazio
              </span>
            )}
          </UtilsIf>

          <UtilsFor
            each={discardInDrawOrder}
            eachKey={({ index }) => index}
          >
            {({ item }) => (
              <Card
                card={item.card}
                size="lg"
              />
            )}
          </UtilsFor>
        </div>
      </Modal>
    </>
  );
}
