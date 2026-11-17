import { Icon } from '@iconify/react';
import { UtilsFor } from '@/components/utils/For';
import { Card } from '@/resources/game/components/Card';
import type { ICard } from '@/resources/game/models/Card';

const FULL_HOUSE: ICard[] = [
  { id: 'hearts-K-1', suit: 'hearts', rank: 'K' },
  { id: 'spades-K-1', suit: 'spades', rank: 'K' },
  { id: 'clubs-K-1', suit: 'clubs', rank: 'K' },
  { id: 'diamonds-9-1', suit: 'diamonds', rank: '9' },
  { id: 'clubs-9-1', suit: 'clubs', rank: '9' },
];

const DISCARD_TOP: Array<ICard | null> = [null, null, null, null];

const SEATS = [
  { name: 'Lia', note: 'anfitriã · dupla A' },
  { name: 'Davi', note: 'dupla B' },
  { name: 'Rafa', note: 'dupla A' },
  { name: null, note: 'lugar livre' },
];

function MeldFragment() {
  return (
    <div
      data-ui
      className="flex flex-col items-center gap-8 bg-felt text-paper w-full h-full justify-start px-6 pt-12 pb-10 md:pt-[10dvh]"
    >
      <div className="flex items-end gap-2 sm:gap-3">
        <UtilsFor
          each={FULL_HOUSE}
          eachKey={({ item }) => item.id}
        >
          {({ item, index }) => (
            <div style={{ transform: `translateY(${index % 2 ? -10 : 0}px)` }}>
              <Card
                card={item}
                size="lg"
                className="outline-[3px] outline-gold"
              />
            </div>
          )}
        </UtilsFor>
      </div>

      <div className="flex flex-col items-center gap-2">
        <span className="font-display italic text-[2.25rem] leading-none text-gold">
          Full House
        </span>

        <span className="text-[1.0625rem] tabular">
          (40 + 48) × 4
        </span>

        <span className="font-display text-[3.5rem] leading-none tabular">
          352
        </span>
      </div>
    </div>
  );
}

function DiscardFragment() {
  return (
    <div
      data-ui
      className="flex flex-col items-center gap-8 bg-felt text-paper w-full h-full justify-start px-6 pt-12 pb-10 md:pt-[10dvh]"
    >
      <div className="flex items-center gap-10">
        <div className="flex flex-col items-center gap-2">
          <div className="relative w-[68px] h-[95px]">
            <Card
              card={null}
              size="lg"
              className="absolute! top-0 left-0 translate-x-1 translate-y-1"
            />

            <Card
              card={null}
              size="lg"
              className="absolute! top-0 left-0"
            />
          </div>

          <span className="text-[0.9375rem] tabular">
            Monte · 20
          </span>
        </div>

        <div className="flex flex-col items-center gap-2">
          <div className="flex -space-x-9">
            <UtilsFor
              each={DISCARD_TOP}
              eachKey={({ index }) => index}
            >
              {({ item }) => (
                <Card
                  card={item}
                  size="lg"
                />
              )}
            </UtilsFor>
          </div>

          <span className="text-[0.9375rem] tabular">
            Descarte · 6
          </span>
        </div>
      </div>

      <div className="flex flex-col items-center gap-3 w-full max-w-[380px]">
        <span className="text-[1rem]">
          Escolha de onde comprar 3 cartas
        </span>

        <div className="grid grid-cols-2 gap-2 w-full">
          <span className="bg-gold text-gold-ink font-bold text-center py-3 text-[0.9375rem]">
            Do Monte
          </span>

          <span className="bg-paper text-ink font-bold text-center py-3 text-[0.9375rem]">
            Do Descarte
          </span>
        </div>
      </div>
    </div>
  );
}

function SwapFragment() {
  return (
    <div
      data-ui
      className="flex flex-col items-center gap-6 bg-felt text-paper w-full h-full justify-start px-6 pt-12 pb-10 md:pt-[10dvh]"
    >
      <div className="flex flex-col items-center gap-3">
        <span className="text-[1rem]">
          Parceiro
        </span>

        <div className="flex -space-x-4">
          <UtilsFor
            each={[0, 1, 2]}
            eachKey={({ item }) => item}
          >
            {() => (
              <Card
                card={null}
                size="lg"
              />
            )}
          </UtilsFor>
        </div>
      </div>

      <span className="flex items-center gap-3 bg-felt-night px-5 py-2.5 text-[1rem]">
        <Icon
          icon="lucide:arrow-up-down"
          className="w-5 h-5 text-gold"
        />

        Troca de 3 cartas, só vocês dois veem
      </span>

      <div className="flex flex-col items-center gap-3">
        <div className="flex gap-2">
          <Card
            card={{ id: 'diamonds-5-1', suit: 'diamonds', rank: '5' }}
            size="lg"
            className="outline-[3px] outline-gold"
          />

          <Card
            card={{ id: 'clubs-2-1', suit: 'clubs', rank: '2' }}
            size="lg"
            className="outline-[3px] outline-gold"
          />

          <Card
            card={{ id: 'hearts-3-1', suit: 'hearts', rank: '3' }}
            size="lg"
            className="outline-[3px] outline-gold"
          />
        </div>

        <span className="text-[1rem]">
          Você
        </span>
      </div>
    </div>
  );
}

function RoomFragment() {
  return (
    <div
      data-ui
      className="flex flex-col gap-6 bg-paper text-ink w-full h-full justify-start px-7 pt-12 pb-10 md:pt-[10dvh]"
    >
      <div className="flex flex-col gap-1">
        <span className="text-[1rem] text-ink-soft">
          Código da sala
        </span>

        <span className="font-display text-[clamp(3rem,2rem+3vw,4.5rem)] leading-none tracking-[0.12em] tabular">
          7K2P9M
        </span>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <UtilsFor
          each={SEATS}
          eachKey={({ index }) => index}
        >
          {({ item }) => (
            <div className={`flex flex-col gap-0.5 px-4 py-3 ${item.name ? 'bg-paper-3' : 'bg-paper-2 text-ink-soft'}`}>
              <span className="font-bold text-[1.0625rem]">
                {item.name ?? 'Aguardando'}
              </span>

              <span className="text-[0.875rem] text-ink-soft">
                {item.note}
              </span>
            </div>
          )}
        </UtilsFor>
      </div>

      <span className="bg-felt-light text-paper font-bold text-center py-3.5 text-[1rem]">
        Aguardando jogadores (3/4)
      </span>
    </div>
  );
}

const SHEETS = [
  {
    id: 'jogada',
    name: 'Jogada',
    text: 'Jogue de uma a cinco cartas. O jogo acha a melhor combinação entre elas e só as cartas da combinação pontuam. Todas vão para o Bolo, viradas para cima, à vista de todos. Cada jogador tem cinco Jogadas por partida.',
    className: 'bg-gold text-gold-ink',
    Fragment: MeldFragment,
  },
  {
    id: 'descarte',
    name: 'Descarte',
    text: 'Descarte de uma a cinco cartas viradas para baixo e compre a mesma quantidade, do Monte ou do topo do Descarte. Quem compra do Descarte leva o que os outros descartaram, e só ele vê essas cartas.',
    className: 'bg-paper text-ink',
    Fragment: DiscardFragment,
  },
  {
    id: 'troca',
    name: 'Troca',
    text: 'No lugar de um Descarte, combine uma troca com o seu parceiro. Os dois escolhem as cartas em segredo, a troca acontece ao mesmo tempo e a outra dupla só fica sabendo que ela aconteceu.',
    className: 'bg-suit-red text-paper',
    Fragment: SwapFragment,
  },
  {
    id: 'sala',
    name: 'Sala',
    text: 'Sem cadastro e sem senha. Quem cria a sala recebe um código de seis letras, os amigos entram com um apelido e a partida começa quando os quatro lugares estiverem ocupados.',
    className: 'bg-felt-light text-paper',
    Fragment: RoomFragment,
  },
];

export function HomeActions() {
  return (
    <section
      id="jogadas"
      className="bg-felt-night text-paper pt-[clamp(96px,14vw,200px)]"
      aria-labelledby="jogadas-titulo"
    >
      <div className="home-frame pb-12">
        <h2
          id="jogadas-titulo"
          data-reveal
          className="font-display font-normal text-[clamp(2.5rem,1.4rem+3.6vw,4.5rem)] leading-[0.95] tracking-[-0.02em]"
        >
          Três ações e uma sala
        </h2>
      </div>

      <div className="relative">
        <UtilsFor
          each={SHEETS}
          eachKey={({ item }) => item.id}
        >
          {({ item: sheet, index }) => (
            <article
              id={sheet.id}
              className={`sheet ${sheet.className} grid grid-cols-1 md:grid-cols-12 md:min-h-[86dvh] min-h-[70dvh]`}
              style={{ '--sheet-index': index } as React.CSSProperties}
              aria-labelledby={`${sheet.id}-titulo`}
            >
              <div className="md:col-span-6 home-frame flex flex-col gap-6 md:gap-10 pb-10 md:pb-14">
                <h3
                  id={`${sheet.id}-titulo`}
                  className="font-display font-medium text-[1.75rem] md:text-[2.75rem] leading-none h-14 md:h-[72px] flex items-center"
                >
                  {sheet.name}
                </h3>

                <p className="text-[1.125rem] md:text-[1.5rem] leading-[1.45] max-w-[30ch]">
                  {sheet.text}
                </p>
              </div>

              <div className="md:col-span-6 md:mt-[72px] flex min-h-[380px]">
                <sheet.Fragment />
              </div>
            </article>
          )}
        </UtilsFor>
      </div>
    </section>
  );
}
