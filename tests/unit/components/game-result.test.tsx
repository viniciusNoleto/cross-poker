import { screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { finishReasonText, gameOutcomeFor, gameResultTitle, GameResult } from '@/resources/game/components/GameResult';
import { GameEndAnimation } from '@/resources/game/components/GameEndAnimation';
import { sounds } from '@/utils/sound';
import { gameState, player } from '../../support/factories';
import { renderWithProviders } from '../../support/render';

const scored = (a0: number, b1: number, a2: number, b3: number) => [
  player(0, { score: a0 }),
  player(1, { score: b1 }),
  player(2, { score: a2 }),
  player(3, { score: b3 }),
];

const finished = (overrides = {}, youSeat: number | null = 0) => gameState({
  status: 'finished',
  winning_team: 'A',
  finish_reason: 'no_melds',
  players: scored(100, 50, 30, 10),
  ...overrides,
}, youSeat);

describe('resultado — textos', () => {
  it('título', () => {
    expect(gameResultTitle(finished())).toBe('Equipe A venceu!');
    expect(gameResultTitle(finished({ winning_team: null }))).toBe('Empate!');
  });

  it('resultado do ponto de vista de quem vê', () => {
    expect(gameOutcomeFor(finished({}, 0))).toBe('win');
    expect(gameOutcomeFor(finished({}, 1))).toBe('lose');
    expect(gameOutcomeFor(finished({ winning_team: null }, 1))).toBe('tie');
    // Espectador sem assento
    expect(gameOutcomeFor(finished({}, null))).toBe('win');
  });

  it('motivo do fim', () => {
    expect(finishReasonText(finished())).toBe('Todas as jogadas foram usadas.');
    expect(finishReasonText(finished({ finish_reason: 'inactivity' }))).toMatch(/inatividade/);
    expect(finishReasonText(finished({ finish_reason: 'decided' }))).toBe(
      'Fim antecipado: a Equipe B já tinha usado todas as suas jogadas e só a Equipe A ainda tinha jogadas, já estando na frente. O placar não podia mais virar.',
    );
    expect(finishReasonText(finished({ finish_reason: 'decided', players: scored(0, 50, 0, 10) }))).toMatch(/só a Equipe B ainda tinha jogadas/);
  });
});

describe('GameResult', () => {
  it('vencedora, placar por dupla e jogadores', () => {
    renderWithProviders(<GameResult state={finished()} />);

    expect(screen.getByRole('heading', { name: 'Equipe A venceu!' })).toBeInTheDocument();
    expect(screen.getByText('Sua dupla venceu a partida.')).toBeInTheDocument();
    expect(screen.getByText('Equipe A · sua dupla')).toBeInTheDocument();
    expect(screen.getByText('Vencedora')).toBeInTheDocument();
    expect(screen.getByText('130')).toBeInTheDocument();
    expect(screen.getByText('60')).toBeInTheDocument();
    expect(screen.getByText('Ana (você)')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Voltar ao início' })).toHaveAttribute('href', '/');
  });

  it('derrota', () => {
    renderWithProviders(<GameResult state={finished({}, 3)} />);

    expect(screen.getByText('Sua dupla perdeu desta vez.')).toBeInTheDocument();
    expect(screen.getByText('Diego (você)')).toBeInTheDocument();
  });

  it('empate: sem vencedora', () => {
    renderWithProviders(<GameResult state={finished({ winning_team: null, players: scored(10, 10, 0, 0) })} />);

    expect(screen.getByRole('heading', { name: 'Empate!' })).toBeInTheDocument();
    expect(screen.queryByText('Vencedora')).not.toBeInTheDocument();
  });

  it('espectador', () => {
    renderWithProviders(<GameResult state={finished({}, null)} />);

    expect(screen.getByText('Partida encerrada.')).toBeInTheDocument();
  });
});

describe('GameEndAnimation', () => {
  it('mostra o título, toca a fanfarra e termina chamando onFinish', () => {
    vi.useFakeTimers();

    const onFinish = vi.fn();

    renderWithProviders(
      <GameEndAnimation
        outcome="lose"
        title="Equipe B venceu!"
        onFinish={onFinish}
      />,
    );

    expect(screen.getByText('Equipe B venceu!')).toBeInTheDocument();

    vi.advanceTimersByTime(100);
    expect(sounds.gameEnd).toHaveBeenCalledWith('lose');

    vi.advanceTimersByTime(10_000);
    expect(onFinish).toHaveBeenCalledTimes(1);
    vi.useRealTimers();
  });
});
