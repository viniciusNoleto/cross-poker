import { HomeChipStacks } from './ChipStacks';

export function HomeOrigin() {
  return (
    <section
      id="origem"
      className="bg-paper text-ink home-frame py-[clamp(96px,14vw,200px)]"
      aria-labelledby="origem-titulo"
    >
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-x-8 gap-y-12 items-center">
        <div className="lg:col-span-5 flex flex-col gap-8">
          <h2
            id="origem-titulo"
            data-reveal
            className="font-display font-normal text-[clamp(2.5rem,1.4rem+3.6vw,4.5rem)] leading-[0.95] tracking-[-0.02em]"
          >
            Quatro cadeiras, duas duplas
          </h2>

          <p
            data-reveal
            style={{ '--i': 1 } as React.CSSProperties}
            className="text-[1.1875rem] leading-[1.55] max-w-[40ch]"
          >
            O Cross Poker nasceu depois de uma longa sessão de Balatro: a vontade era jogar aquilo em duplas, com os amigos, como se joga baralho numa mesa de cozinha. Como esse jogo não existia, virou este.
          </p>

          <p
            data-reveal
            style={{ '--i': 2 } as React.CSSProperties}
            className="text-[1.1875rem] leading-[1.55] max-w-[40ch]"
          >
            Seu parceiro senta à sua frente. A mão dele você nunca vê, mas pode trocar cartas com ele às escondidas, e no fim os pontos dos dois somam juntos.
          </p>
        </div>

        <div
          data-reveal
          style={{ '--i': 1 } as React.CSSProperties}
          className="lg:col-start-7 lg:col-span-6"
        >
          <HomeChipStacks />
        </div>
      </div>
    </section>
  );
}
