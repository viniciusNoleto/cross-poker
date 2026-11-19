'use client';

import { useEffect, useMemo, useState } from 'react';
import { animate, useReducedMotion } from 'motion/react';
import { useMediaQuery } from '@mantine/hooks';
import { UtilsFor } from '@/components/utils/For';
import { UtilsIf } from '@/components/utils/If';
import { Card } from '@/resources/game/components/Card';
import { ActionButton, CardsGlyph } from '@/resources/game/components/ActionButton';
import { COMBO_NAME } from '@/resources/game/components/MeldScoreAnimation';
import { bestCombo } from '@/resources/game/models/Combo';
import { buildDeck, shuffle } from '@/resources/game/models/Deck';
import { chipsForCard, type ICard } from '@/resources/game/models/Card';

const HAND_SIZE = 8;
const MAX_SELECTED = 5;

// First hand is fixed (so the server and the browser render the same thing) and already has a
// Three of a Kind selected, so the score is on screen before anyone touches it.
const FIRST_HAND: ICard[] = [
  { id: 'hearts-K-1', suit: 'hearts', rank: 'K' },
  { id: 'spades-K-1', suit: 'spades', rank: 'K' },
  { id: 'clubs-K-1', suit: 'clubs', rank: 'K' },
  { id: 'hearts-9-1', suit: 'hearts', rank: '9' },
  { id: 'diamonds-9-1', suit: 'diamonds', rank: '9' },
  { id: 'hearts-4-1', suit: 'hearts', rank: '4' },
  { id: 'spades-A-1', suit: 'spades', rank: 'A' },
  { id: 'hearts-J-1', suit: 'hearts', rank: 'J' },
];

const FIRST_SELECTION = ['hearts-K-1', 'spades-K-1', 'clubs-K-1'];

const BASE_CHIPS: Record<string, number> = {
  high_card: 5,
  pair: 10,
  two_pair: 20,
  three_of_a_kind: 30,
  straight: 30,
  flush: 35,
  full_house: 40,
  four_of_a_kind: 60,
  straight_flush: 100,
};

function useCountUp(value: number) {
  const reduce = useReducedMotion();
  const [shown, setShown] = useState(value);

  useEffect(() => {
    if (reduce) return undefined;

    const controls = animate(shown, value, {
      duration: 0.55,
      ease: [0.11, 0.75, 0.24, 1],
      onUpdate: (latest) => setShown(Math.round(latest)),
    });

    return () => controls.stop();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, reduce]);

  return reduce ? value : shown;
}

export function HomeLiveMeld() {
  const [hand, setHand] = useState<ICard[]>(FIRST_HAND);
  const [selected, setSelected] = useState<string[]>(FIRST_SELECTION);
  const [dealCount, setDealCount] = useState(0);

  const selectedCards = useMemo(() => hand.filter((card) => selected.includes(card.id)), [hand, selected]);
  const combo = useMemo(() => (selectedCards.length ? bestCombo(selectedCards) : null), [selectedCards]);
  const scoringIds = useMemo(() => combo?.scoringCards.map((card) => card.id) ?? [], [combo]);
  const cardChips = combo ? combo.scoringCards.reduce((sum, card) => sum + chipsForCard(card), 0) : 0;
  const baseChips = combo ? BASE_CHIPS[combo.type] : 0;

  const points = useCountUp(combo?.points ?? 0);
  const isPhone = useMediaQuery('(max-width: 639px)');

  function toggle(cardId: string) {
    setSelected((current) => {
      if (current.includes(cardId)) return current.filter((id) => id !== cardId);
      if (current.length >= MAX_SELECTED) return current;

      return [...current, cardId];
    });
  }

  function dealAgain() {
    setHand(shuffle(buildDeck()).slice(0, HAND_SIZE));
    setSelected([]);
    setDealCount((count) => count + 1);
  }

  return (
    <section
      id="mesa"
      className="felt-surface-deep home-frame py-[clamp(96px,14vw,200px)] text-paper"
      aria-labelledby="mesa-titulo"
    >
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-x-8 gap-y-14 items-start">
        <div className="lg:col-span-5 flex flex-col">
          <h2
            id="mesa-titulo"
            data-reveal
            className="font-display font-normal text-[clamp(2.5rem,1.4rem+3.6vw,4.5rem)] leading-[0.95] tracking-[-0.02em]"
          >
            Quanto vale a sua mão?
          </h2>

          <p
            data-reveal
            style={{ '--i': 1 } as React.CSSProperties}
            className="mt-7 text-[1.1875rem] leading-[1.55] max-w-[40ch]"
          >
            Toque em até cinco cartas. O jogo encontra a melhor combinação, soma as fichas das cartas que pontuam e multiplica, do jeito do Balatro.
          </p>

          <div
            data-reveal
            style={{ '--i': 2 } as React.CSSProperties}
            className="mt-12 bg-felt-night px-7 py-7 md:px-9 md:py-8"
            aria-live="polite"
          >
            <UtilsIf
              cases={[
                {
                  condition: !!combo,
                  content: () => (
                    <div className="flex flex-col gap-4">
                      <span className="font-display italic text-[clamp(2.25rem,1.5rem+2.4vw,3.25rem)] leading-none text-gold">
                        {COMBO_NAME[combo!.type]}
                      </span>

                      <span className="flex items-baseline gap-3">
                        <span className="font-display text-[clamp(4rem,2.6rem+4.4vw,6.5rem)] leading-[0.85] tabular-nums">
                          {points}
                        </span>

                        <span className="text-[1.1875rem]">
                          pontos
                        </span>
                      </span>

                      <span className="text-[1.1875rem] tabular-nums text-paper">
                        {`(${baseChips} base + ${cardChips} das cartas) × ${combo!.multiplier}`}
                      </span>
                    </div>
                  ),
                },
                {
                  content: () => (
                    <div className="flex flex-col gap-4 min-h-47 justify-center">
                      <span className="font-display italic text-[clamp(2.25rem,1.5rem+2.4vw,3.25rem)] leading-none text-paper">
                        Escolha suas cartas
                      </span>

                      <span className="text-[1.1875rem] text-paper">
                        De uma a cinco. Só as que formam a combinação pontuam.
                      </span>
                    </div>
                  ),
                },
              ]}
            />
          </div>
        </div>

        <div className="lg:col-span-7 lg:pl-8 flex flex-col gap-10">
          <div
            data-ui
            className="grid grid-cols-4 gap-3 sm:gap-5 justify-items-center pt-4"
            role="group"
            aria-label="Sua mão"
          >
            <UtilsFor
              each={hand}
              eachKey={({ item }) => `${dealCount}-${item.id}`}
            >
              {({ item, index }) => (
                <div
                  className="hand-deal"
                  style={{ '--i': index } as React.CSSProperties}
                >
                  <Card
                    card={item}
                    size={isPhone ? 'lg' : 'xl'}
                    selected={selected.includes(item.id)}
                    onClick={() => toggle(item.id)}
                    className={`${selected.includes(item.id) && !scoringIds.includes(item.id) ? 'opacity-55' : ''}`}
                  />
                </div>
              )}
            </UtilsFor>
          </div>

          <div className="flex flex-wrap items-center gap-x-8 gap-y-4">
            <ActionButton
              label="Dar outra mão"
              tone="paper"
              size="md"
              badge={<CardsGlyph variant="stack" />}
              onClick={dealAgain}
            />

            <span className="text-[1rem] text-paper tabular-nums">
              {`${selected.length} de ${MAX_SELECTED} cartas escolhidas`}
            </span>
          </div>
        </div>
      </div>
    </section>
  );
}
