'use client';

import Image from 'next/image';
import { motion, useReducedMotion } from 'motion/react';
import { UtilsFor } from '@/components/utils/For';
import { Card, CrossLogo } from '@/resources/game/components/Card';

const NAV_LINKS = [
  { href: '#mesa', label: 'Pontuação' },
  { href: '#como-se-joga', label: 'Como se joga' },
  { href: '#maos', label: 'As mãos' },
];

const FAN = [-2, -1, 0, 1, 2];

const EASE_DEAL: [number, number, number, number] = [0.22, 1, 0.36, 1];

// The two opponents' hands, dealt to the left and right of the big card — together with the card
// (your seat) and the partner above it they make the cross that names the game.
function DealtHand({ side, reduce }: { side: 'left' | 'right'; reduce: boolean }) {
  const direction = side === 'left' ? -1 : 1;

  return (
    <div
      className={`pointer-events-none absolute top-[46%] hidden lg:block ${side === 'left' ? 'left-[6%] xl:left-[9%]' : 'right-[6%] xl:right-[9%]'}`}
      aria-hidden="true"
    >
      <UtilsFor
        each={FAN}
        eachKey={({ item }) => item}
      >
        {({ item: offset, index }) => (
          <motion.div
            className="absolute"
            initial={reduce ? false : { x: -direction * 420, y: 160, rotate: 0, opacity: 0 }}
            animate={{ x: offset * 10, y: Math.abs(offset) * 6, rotate: direction * 90 + offset * 9, opacity: 1 }}
            transition={{ duration: 0.75, delay: 0.25 + index * 0.09 + (side === 'right' ? 0.05 : 0), ease: EASE_DEAL }}
          >
            <Card
              card={null}
              size="lg"
            />
          </motion.div>
        )}
      </UtilsFor>
    </div>
  );
}

export function HomeHero() {
  const reduce = !!useReducedMotion();

  return (
    <header className="felt-surface relative overflow-hidden flex flex-col min-h-[100svh] md:min-h-0 md:h-[max(100svh,840px)]">
      <nav
        className="home-frame relative z-20 flex items-center justify-between gap-6 pt-5 md:pt-7"
        aria-label="Principal"
      >
        <a
          href="#topo"
          className="flex items-center gap-3 text-paper"
        >
          <Image
            src="/icon.svg"
            alt=""
            width={40}
            height={40}
            className="rounded-[6px]"
            priority
          />

          <span className="font-display text-[1.375rem] font-medium">
            Cross Poker
          </span>
        </a>

        <div className="hidden md:flex items-center gap-8 text-paper text-[1.0625rem]">
          <UtilsFor
            each={NAV_LINKS}
            eachKey={({ item }) => item.href}
          >
            {({ item }) => (
              <a
                href={item.href}
                className="home-link decoration-paper/30"
              >
                {item.label}
              </a>
            )}
          </UtilsFor>
        </div>

        <a
          href="#jogar"
          className="home-button bg-gold text-gold-ink hover:bg-[#f6c65a] min-h-11! px-5!"
        >
          Jogar agora
        </a>
      </nav>

      <DealtHand
        side="left"
        reduce={reduce}
      />

      <DealtHand
        side="right"
        reduce={reduce}
      />

      <div
        id="topo"
        className="relative z-10 flex-1 flex justify-center px-3 md:px-8 pt-14 md:pt-[72px]"
        style={{ perspective: 1600 }}
      >
        <motion.div
          className="relative w-full max-w-[640px] self-start min-h-[calc(100svh-96px)] md:min-h-0 md:aspect-[5/7] -mb-12 md:mb-0"
          style={{ transformStyle: 'preserve-3d' }}
          initial={reduce ? false : { rotateY: 180, y: 120, rotate: -4 }}
          animate={{ rotateY: 0, y: 0, rotate: 0 }}
          transition={{ duration: 1.1, delay: 0.55, ease: EASE_DEAL }}
        >
          <div
            className="hero-card card-back hero-card-back absolute inset-0 flex items-center justify-center"
            style={{ backfaceVisibility: 'hidden', transform: 'rotateY(180deg)' }}
            aria-hidden="true"
          >
            <CrossLogo className="w-40 h-40 text-gold" />
          </div>

          <div
            className="hero-card relative md:absolute md:inset-0 min-h-[calc(100svh-96px)] md:min-h-0 bg-paper text-ink flex flex-col items-center text-center px-5 md:px-14 pt-12 md:pt-16 pb-24 md:pb-0"
            style={{ backfaceVisibility: 'hidden' }}
          >
            <span
              className="absolute top-5 left-6 md:top-7 md:left-8 flex flex-col items-center gap-1.5 text-suit-red"
              aria-hidden="true"
            >
              <span className="font-display text-[2rem] md:text-[2.5rem] leading-none font-medium">
                C
              </span>

              <CrossLogo className="w-6 h-6 md:w-7 md:h-7" />
            </span>

            <span
              className="absolute top-5 right-6 md:top-7 md:right-8 flex flex-col items-center gap-1.5 text-suit-red"
              aria-hidden="true"
            >
              <span className="font-display text-[2rem] md:text-[2.5rem] leading-none font-medium">
                P
              </span>

              <CrossLogo className="w-6 h-6 md:w-7 md:h-7" />
            </span>

            <CrossLogo className="w-14 h-14 md:w-16 md:h-16 text-suit-red mt-6 md:mt-4" />

            <h1 className="font-display italic font-normal leading-[0.92] tracking-[-0.02em] text-[clamp(4rem,15vw,7.5rem)] mt-6 md:mt-8 flex flex-col">
              <span className="md:-translate-x-[12%]">
                Cross
              </span>

              <span className="md:translate-x-[14%]">
                Poker
              </span>
            </h1>

            <p className="mt-8 md:mt-9 text-[1.25rem] md:text-[1.5rem] leading-[1.35] max-w-[26ch] text-ink">
              Poker em duplas, pontuado com fichas e multiplicadores. Junte três amigos e jogue no navegador.
            </p>

            <div className="mt-8 flex flex-wrap items-center justify-center gap-x-4 gap-y-2 text-[1rem] text-ink-soft">
              <span>
                4 jogadores
              </span>

              <span
                className="w-2.5 h-2.5 rotate-45 bg-suit-red"
                aria-hidden="true"
              />

              <span>
                2 duplas
              </span>

              <span
                className="w-2.5 h-2.5 rotate-45 bg-suit-red"
                aria-hidden="true"
              />

              <span>
                sem cadastro
              </span>
            </div>

            <div className="mt-9 flex flex-col sm:flex-row items-center gap-5">
              <a
                href="#jogar"
                className="home-button bg-ink text-paper hover:bg-felt-deep"
              >
                Criar uma sala
              </a>

              <a
                href="#jogar"
                className="home-link text-[1.0625rem] text-ink decoration-ink/30"
              >
                Já tenho um código
              </a>
            </div>
          </div>
        </motion.div>
      </div>
    </header>
  );
}
