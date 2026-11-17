import { UtilsFor } from '@/components/utils/For';
import { HomeSlotReels } from './SlotReels';

type SlipRow = { what: string; value: string };

type SlipGroup = { heading: string; rows: SlipRow[] };

// Every number here comes from the rules (README.md / game-concept.md, section 2).
const SLIP: SlipGroup[] = [
  {
    heading: 'Antes da primeira carta',
    rows: [
      { what: 'Duplas sentadas frente a frente', value: '4 lugares' },
      { what: 'Cartas na mão de cada um', value: '8' },
      { what: 'Jogadas e Descartes de cada um', value: '5 e 5' },
    ],
  },
  {
    heading: 'Na sua vez, uma ação',
    rows: [
      { what: 'Jogada: jogar de 1 a 5 cartas e pontuar', value: '1 Jogada' },
      { what: 'Descarte: descartar de 1 a 5 e repor', value: '1 Descarte' },
      { what: 'Troca: passar cartas ao parceiro', value: '1 Descarte cada' },
    ],
  },
  {
    heading: 'Depois da ação',
    rows: [
      { what: 'Comprar do Monte ou do Descarte, nunca dos dois', value: 'até 8' },
      { what: 'Cartas jogadas vão para o Bolo, que não se compra', value: 'à vista' },
      { what: 'Quem não tem Jogada nem Descarte passa a vez', value: 'pula' },
    ],
  },
  {
    heading: 'Fim',
    rows: [
      { what: 'Ninguém mais tem Jogadas', value: 'acabou' },
      { what: 'Só uma dupla tem Jogadas e já está na frente', value: 'acabou' },
      { what: 'Mais de 1 hora sem ninguém jogar', value: 'encerrada' },
    ],
  },
];

export function HomeHowItWorks() {
  return (
    <section
      id="como-se-joga"
      className="felt-surface home-frame py-[clamp(96px,14vw,200px)] text-paper"
      aria-labelledby="como-se-joga-titulo"
    >
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-x-8 gap-y-14 items-start">
        <div className="lg:col-span-5 flex flex-col gap-7">
          <h2
            id="como-se-joga-titulo"
            data-reveal
            className="font-display font-normal text-[clamp(2.5rem,1.4rem+3.6vw,4.5rem)] leading-[0.95] tracking-[-0.02em]"
          >
            Como uma partida anda
          </h2>

          <p
            data-reveal
            style={{ '--i': 1 } as React.CSSProperties}
            className="text-[1.1875rem] leading-[1.55] max-w-[34ch]"
          >
            Um baralho, quatro amigos, duas duplas. A vez gira no sentido horário, então as duplas se alternam sozinhas. Cada um gasta suas Jogadas e seus Descartes até não sobrar Jogada na mesa.
          </p>

          <div
            data-reveal
            style={{ '--i': 2 } as React.CSSProperties}
            className="mt-6"
          >
            <HomeSlotReels />
          </div>
        </div>

        <div className="lg:col-start-7 lg:col-span-6 xl:col-start-7 xl:col-span-5">
          <div
            data-reveal
            style={{ '--i': 1 } as React.CSSProperties}
            className="slip bg-paper text-ink px-6 md:px-9 pt-8 md:pt-10 pb-14 tabular"
          >
            <p className="font-display text-[1.75rem] leading-none">
              Uma partida de Cross Poker
            </p>

            <UtilsFor
              each={SLIP}
              eachKey={({ item }) => item.heading}
            >
              {({ item: group }) => (
                <div className="mt-8">
                  <p className="font-bold text-[1.0625rem]">
                    {group.heading}
                  </p>

                  <UtilsFor
                    each={group.rows}
                    eachKey={({ item }) => item.what}
                  >
                    {({ item: row }) => (
                      <div className="flex items-baseline mt-2.5 text-[1.0625rem]">
                        <span>
                          {row.what}
                        </span>

                        <span
                          className="slip-leader"
                          aria-hidden="true"
                        />

                        <span className="whitespace-nowrap">
                          {row.value}
                        </span>
                      </div>
                    )}
                  </UtilsFor>
                </div>
              )}
            </UtilsFor>

            <div className="-mx-6 md:-mx-9 mt-9 bg-ink text-paper px-6 md:px-9 min-h-12 py-3 flex items-center justify-between gap-4 text-[1.0625rem] font-bold">
              <span>
                Vence a dupla com mais pontos
              </span>

              <span className="whitespace-nowrap font-normal">
                soma dos dois
              </span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
