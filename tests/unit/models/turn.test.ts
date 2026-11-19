import { describe, expect, it } from 'vitest';
import { gameEndReason, nextSeatWithAction, scoreByTeam, teamsWithMelds, winningTeam } from '@/resources/game/models/Turn';
import { EFinishReason } from '@/resources/game/enums/EFinishReason';

type P = { seat: number; melds_remaining: number; discards_remaining: number; score: number };

function players(overrides: Array<Partial<P>> = []): P[] {
  return [0, 1, 2, 3].map((seat) => ({ seat, melds_remaining: 5, discards_remaining: 5, score: 0, ...overrides[seat] }));
}

describe('scoreByTeam / winningTeam', () => {
  it('soma a pontuação dos dois integrantes de cada dupla', () => {
    expect(scoreByTeam(players([{ score: 10 }, { score: 5 }, { score: 7 }, { score: 1 }]))).toEqual({ A: 17, B: 6 });
  });

  it('vence a dupla com maior total', () => {
    expect(winningTeam(players([{ score: 10 }, { score: 5 }]))).toBe('A');
    expect(winningTeam(players([{ score: 1 }, { score: 50 }]))).toBe('B');
  });

  it('empate → null', () => {
    expect(winningTeam(players([{ score: 10 }, { score: 4 }, { score: 0 }, { score: 6 }]))).toBeNull();
  });
});

describe('teamsWithMelds', () => {
  it('lista as equipes com pelo menos uma Jogada', () => {
    expect(teamsWithMelds(players())).toEqual(['A', 'B']);
    expect(teamsWithMelds(players([{ melds_remaining: 0 }, {}, { melds_remaining: 0 }]))).toEqual(['B']);
    expect(teamsWithMelds(players([{ melds_remaining: 0 }, { melds_remaining: 0 }, { melds_remaining: 0 }, { melds_remaining: 0 }]))).toEqual([]);
  });

  it('basta um integrante com Jogada', () => {
    expect(teamsWithMelds(players([{ melds_remaining: 0 }, { melds_remaining: 0 }, { melds_remaining: 1 }, { melds_remaining: 0 }]))).toEqual(['A']);
  });
});

describe('gameEndReason — fim da Partida', () => {
  it('ninguém com Jogadas → no_melds (mesmo com Descartes sobrando)', () => {
    const list = players([0, 1, 2, 3].map(() => ({ melds_remaining: 0, discards_remaining: 3 })));

    expect(gameEndReason(list)).toBe(EFinishReason.NO_MELDS);
  });

  it('só uma equipe com Jogadas e estritamente na frente → decided', () => {
    const list = players([{ score: 100 }, { melds_remaining: 0, score: 40 }, { score: 0 }, { melds_remaining: 0, score: 0 }]);

    expect(gameEndReason(list)).toBe(EFinishReason.DECIDED);
  });

  it('só uma equipe com Jogadas mas atrás → continua', () => {
    const list = players([{ score: 10 }, { melds_remaining: 0, score: 40 }, {}, { melds_remaining: 0 }]);

    expect(gameEndReason(list)).toBeNull();
  });

  it('só uma equipe com Jogadas e empatada → continua', () => {
    const list = players([{ score: 40 }, { melds_remaining: 0, score: 40 }, {}, { melds_remaining: 0 }]);

    expect(gameEndReason(list)).toBeNull();
  });

  it('as duas equipes com Jogadas → continua, qualquer que seja o placar', () => {
    expect(gameEndReason(players([{ score: 1000 }]))).toBeNull();
  });
});

describe('nextSeatWithAction — ordem dos turnos', () => {
  it('sentido horário: 0 → 1 → 2 → 3 → 0', () => {
    const list = players();

    expect(nextSeatWithAction(0, list)).toBe(1);
    expect(nextSeatWithAction(3, list)).toBe(0);
  });

  it('pula quem não tem nenhuma ação (0 Jogadas e 0 Descartes)', () => {
    const list = players([{}, { melds_remaining: 0, discards_remaining: 0 }, { melds_remaining: 0, discards_remaining: 0 }]);

    expect(nextSeatWithAction(0, list)).toBe(3);
  });

  it('quem só tem Descartes continua jogando', () => {
    const list = players([{}, { melds_remaining: 0, discards_remaining: 1 }]);

    expect(nextSeatWithAction(0, list)).toBe(1);
  });

  it('volta para o próprio assento se só ele tiver ações', () => {
    const none = { melds_remaining: 0, discards_remaining: 0 };
    const list = players([{}, none, none, none]);

    expect(nextSeatWithAction(0, list)).toBe(0);
  });

  it('ninguém com ações → null', () => {
    const none = { melds_remaining: 0, discards_remaining: 0 };

    expect(nextSeatWithAction(2, players([none, none, none, none]))).toBeNull();
  });
});
