'use client';

import { useMemo, useState } from 'react';
import { Modal } from '@mantine/core';
import { UtilsFor } from '@/components/utils/For';
import { UtilsIf } from '@/components/utils/If';
import { Card } from './Card';
import type { ICard } from '../models/Card';

export type MeldPileProps = {
  meldPile: ICard[];
};

/**
 * The Bolo: every card played in a Jogada, face up. It is public (anyone can see it) but it is
 * NOT a draw source — it only goes back into play when the Monte runs out (see game-concept.md).
 * Hovering only highlights the card group with a gold ring; clicking opens the full list.
 */
export function MeldPile({ meldPile }: MeldPileProps) {
  const [opened, setOpened] = useState(false);

  // `meldPile` comes in bottom→top order; the modal lists the most recent cards first.
  const meldPileNewestFirst = useMemo(() => [...meldPile].reverse(), [meldPile]);
  const hasCards = meldPile.length > 0;

  function openPile() {
    if (hasCards) setOpened(true);
  }

  return (
    <>
      {/* Not a <button>: the face-up cards inside already render as (disabled) buttons, and a
          disabled button swallows the click — so the cards ignore the pointer and the wrapper,
          acting as the button, receives it. */}
      <div
        role="button"
        tabIndex={hasCards ? 0 : -1}
        aria-disabled={!hasCards}
        aria-label={`Ver o Bolo (${meldPile.length} cartas)`}
        className={`group flex flex-col items-center gap-1.5 outline-none ${hasCards ? 'cursor-pointer' : 'cursor-default'}`}
        onClick={openPile}
        onKeyDown={(event) => {
          if (event.key !== 'Enter' && event.key !== ' ') return;

          event.preventDefault();
          openPile();
        }}
      >
        <div className={`flex -space-x-8 p-1 rounded-lg ring-0 ring-gold transition-shadow duration-150 ${hasCards ? 'group-hover:ring-[3px] group-focus-visible:ring-[3px]' : ''}`}>
          <UtilsFor
            each={meldPile.slice(-4)}
            eachKey={({ item }) => item.id}
          >
            {({ item }) => (
              <Card
                card={item}
                className="pointer-events-none"
              />
            )}
          </UtilsFor>

          <UtilsIf condition={!hasCards}>
            {() => (
              <div className="w-12 h-16.75 rounded-md border-2 border-dashed border-paper/25" />
            )}
          </UtilsIf>
        </div>

        <span className="text-paper/85 text-[13px] tabular-nums">
          {`Bolo (${meldPile.length})`}
        </span>
      </div>

      {/* Styled as the table itself: felt with the wooden rim, no close button — it closes by
          clicking outside or pressing Esc. */}
      <Modal
        opened={opened}
        onClose={() => setOpened(false)}
        title="Bolo"
        size="xl"
        radius={24}
        centered
        withCloseButton={false}
        classNames={{
          content: 'felt-surface! border-10 md:border-14 border-[#3a2414] shadow-[0_24px_60px_-20px_rgba(0,0,0,0.8)]',
          header: 'bg-transparent! justify-center pt-5! pb-0!',
          title: 'font-display italic text-gold text-[26px] leading-none',
          body: 'pb-6!',
        }}
      >
        <div className="flex flex-wrap justify-center gap-2 min-h-16 overflow-y-auto p-4">
          <UtilsIf condition={!meldPile.length}>
            {() => (
              <span className="text-paper/60 text-xs">
                Bolo vazio
              </span>
            )}
          </UtilsIf>

          <UtilsFor
            each={meldPileNewestFirst}
            eachKey={({ item }) => item.id}
          >
            {({ item }) => (
              <Card
                card={item}
                size="lg"
              />
            )}
          </UtilsFor>
        </div>
      </Modal>
    </>
  );
}
