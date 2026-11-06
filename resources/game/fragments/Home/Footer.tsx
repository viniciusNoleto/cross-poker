import { UtilsFor } from '@/components/utils/For';

const LINKS = [
  { href: '#mesa', label: 'Pontuação' },
  { href: '#como-se-joga', label: 'Como se joga' },
  { href: '#maos', label: 'As mãos' },
  { href: '#jogar', label: 'Jogar' },
];

export function HomeFooter() {
  return (
    <footer className="curtain-footer felt-surface text-paper home-frame min-h-[90svh] flex flex-col justify-between pt-10 pb-8 gap-16">
      <div className="flex flex-col md:flex-row md:items-start justify-between gap-6 text-[0.9375rem]">
        <div className="flex flex-col md:flex-row gap-3 md:gap-12 max-w-[60ch]">
          <p>
            Poker em duplas, no navegador.
          </p>

          <p>
            Sem cadastro, sem anúncio, sem aposta.
          </p>

          <p>
            Pontuação inspirada em Balatro.
          </p>
        </div>

        <a
          href="#topo"
          className="home-link decoration-paper/40 self-start"
        >
          Voltar ao topo
        </a>
      </div>

      <div className="flex flex-col gap-10">
        <a
          href="#jogar"
          className="font-display italic font-normal leading-[0.85] tracking-[-0.03em] text-[clamp(4.5rem,17vw,16rem)] hover:text-gold transition-colors duration-300"
        >
          Cross Poker
        </a>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-[0.875rem]">
          <nav
            className="flex flex-wrap gap-x-5 gap-y-2"
            aria-label="Rodapé"
          >
            <UtilsFor
              each={LINKS}
              eachKey={({ item }) => item.href}
            >
              {({ item }) => (
                <a
                  href={item.href}
                  className="home-link decoration-paper/40"
                >
                  {item.label}
                </a>
              )}
            </UtilsFor>
          </nav>

          <p className="md:text-center">
            Feito para jogar com os amigos.
          </p>

          <p className="md:text-right">
            2026
          </p>
        </div>
      </div>
    </footer>
  );
}
