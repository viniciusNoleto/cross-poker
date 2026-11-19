'use client';

import { useRef } from 'react';
import { motion, useScroll, useTransform, type MotionValue } from 'motion/react';
import { UtilsFor } from '@/components/utils/For';
import { UtilsIf } from '@/components/utils/If';
import { Card } from '@/resources/game/components/Card';
import { COMBOS, type IComboInfo } from '@/resources/game/components/ComboReference';

const DESCRIPTION: Record<string, string> = {
  high_card: 'Nenhuma combinação: pontua só a carta mais alta.',
  pair: 'Duas cartas do mesmo valor.',
  two_pair: 'Dois pares diferentes na mesma jogada.',
  three_of_a_kind: 'Três cartas do mesmo valor.',
  straight: 'Cinco valores em sequência, de qualquer naipe.',
  flush: 'Cinco cartas do mesmo naipe, em qualquer ordem.',
  full_house: 'Uma trinca e um par juntos.',
  four_of_a_kind: 'Quatro cartas do mesmo valor.',
  straight_flush: 'Sequência de cinco, toda do mesmo naipe.',
};

const TONES = ['bg-paper', 'bg-paper-2', 'bg-paper-3'];

const OPEN_WIDTH = 560;
const SLIVER_WIDTH = 76;

function ComboFace({ combo }: { combo: IComboInfo }) {
  return (
    <div className="flex flex-col h-full justify-between gap-6">
      <div className="flex flex-col gap-3">
        <h3 className="font-display font-medium text-[1.875rem] leading-[1.1] whitespace-nowrap">
          {combo.name}
        </h3>

        <p className="text-[1.0625rem] leading-normal">
          {DESCRIPTION[combo.id]}
        </p>

        <UtilsIf condition={!!combo.note && combo.id === 'straight'}>
          {() => (
            <p className="text-[1rem] text-ink-soft">
              {combo.note}
            </p>
          )}
        </UtilsIf>
      </div>

      <div className="flex gap-1.5">
        <UtilsFor
          each={combo.cards}
          eachKey={({ item }) => item.id}
        >
          {({ item }) => (
            <Card
              card={item}
              size="md"
            />
          )}
        </UtilsFor>
      </div>

      <div className="flex items-baseline justify-between gap-4 text-[1.0625rem] tabular-nums">
        <span>
          {`${combo.baseChips} fichas de base`}
        </span>

        <span className="font-display text-[1.875rem] leading-none text-suit-red">
          {`×${combo.multiplier}`}
        </span>
      </div>
    </div>
  );
}

function PinnedCombo({ combo, index, total, progress, onOpen }: {
  combo: IComboInfo;
  index: number;
  total: number;
  progress: MotionValue<number>;
  onOpen: (index: number) => void;
}) {
  const segment = 1 / (total - 1);
  const start = index * segment;
  const width = useTransform(
    progress,
    [start, Math.min(start + segment, 1)],
    index === total - 1 ? [OPEN_WIDTH, OPEN_WIDTH] : [OPEN_WIDTH, SLIVER_WIDTH],
  );

  return (
    <motion.div
      role="button"
      tabIndex={0}
      onClick={() => onOpen(index)}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          onOpen(index);
        }
      }}
      aria-label={`Abrir ${combo.name}`}
      className={`${TONES[index % TONES.length]} relative h-full shrink-0 overflow-hidden text-left text-ink cursor-pointer`}
      style={{ width }}
    >
      <div
        className="absolute inset-y-0 left-0 p-7"
        style={{ width: OPEN_WIDTH }}
      >
        <ComboFace combo={combo} />
      </div>
    </motion.div>
  );
}

export function HomeCombos() {
  const wrapperRef = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({ target: wrapperRef, offset: ['start start', 'end end'] });
  const progress = useTransform(scrollYProgress, [0.05, 0.92], [0, 1], { clamp: true });

  function openCombo(index: number) {
    const wrapper = wrapperRef.current;

    if (!wrapper) return;

    const target = 0.05 + (index / (COMBOS.length - 1)) * 0.87;
    const top = wrapper.getBoundingClientRect().top + window.scrollY;
    const distance = wrapper.offsetHeight - window.innerHeight;

    window.scrollTo({ top: top + target * distance, behavior: 'smooth' });
  }

  return (
    <section
      id="maos"
      className="felt-surface-deep text-paper"
      aria-labelledby="maos-titulo"
    >
      <div
        ref={wrapperRef}
        className="hidden lg:block h-[260dvh]"
      >
        <div className="sticky top-0 h-dvh home-frame flex flex-col justify-center gap-10 overflow-hidden">
          <div className="flex items-end justify-between gap-10">
            <h2
              id="maos-titulo"
              className="font-display font-normal text-[clamp(2.5rem,1.4rem+3.6vw,4.5rem)] leading-[0.95] tracking-[-0.02em]"
            >
              As nove mãos
            </h2>

            <p className="text-[1.1875rem] leading-[1.55] max-w-[44ch]">
              Pontos são as fichas de base da mão, mais as fichas de cada carta que pontua, vezes o multiplicador. Ás vale 11; figuras e o 10 valem 10; as demais, o número.
            </p>
          </div>

          <div className="flex h-95 w-full overflow-hidden">
            <UtilsFor
              each={COMBOS}
              eachKey={({ item }) => item.id}
            >
              {({ item, index }) => (
                <PinnedCombo
                  combo={item}
                  index={index}
                  total={COMBOS.length}
                  progress={progress}
                  onOpen={openCombo}
                />
              )}
            </UtilsFor>
          </div>

          <p className="text-[1.0625rem]">
            Da Carta Alta ao Straight Flush: role para folhear, ou toque numa lombada para voltar a ela.
          </p>
        </div>
      </div>

      <div className="lg:hidden home-frame py-[clamp(96px,14vw,200px)] flex flex-col gap-8">
        <h2
          data-reveal
          className="font-display font-normal text-[clamp(2.5rem,10vw,4rem)] leading-[0.95] tracking-[-0.02em]"
        >
          As nove mãos
        </h2>

        <p
          data-reveal
          className="text-[1.0625rem] leading-[1.55] max-w-[44ch]"
        >
          Pontos são as fichas de base da mão, mais as fichas de cada carta que pontua, vezes o multiplicador. Ás vale 11; figuras e o 10 valem 10; as demais, o número.
        </p>

        <div className="flex flex-col gap-3">
          <UtilsFor
            each={COMBOS}
            eachKey={({ item }) => item.id}
          >
            {({ item, index }) => (
              <div
                data-reveal
                className={`${TONES[index % TONES.length]} text-ink p-6`}
              >
                <ComboFace combo={item} />
              </div>
            )}
          </UtilsFor>
        </div>
      </div>
    </section>
  );
}
