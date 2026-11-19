import { act, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MeldScoreAnimationLayer } from '@/resources/game/components/MeldScoreAnimationLayer';
import { DrawAnimation } from '@/resources/game/components/DrawAnimation';
import { DiscardAnimation } from '@/resources/game/components/DiscardAnimation';
import { SwapAnimation } from '@/resources/game/components/SwapAnimation';
import { TurnChip } from '@/resources/game/components/TurnChip';
import { sounds } from '@/utils/sound';
import type { IPublicLastAction } from '@/resources/game/models/GameState';
import { cards, gameState } from '../../support/factories';
import { renderWithProviders } from '../../support/render';

beforeEach(() => {
  vi.useFakeTimers({ shouldAdvanceTime: true });
});

afterEach(() => {
  vi.useRealTimers();
});

const meld = (seat: number, id = 10): IPublicLastAction => ({
  id,
  seat,
  type: 'meld',
  created_at: null,
  melded_cards: cards('hearts-8', 'spades-8', 'clubs-2'),
  combo: 'pair',
  scoring_cards: cards('hearts-8', 'spades-8'),
  chips: 26,
  multiplier: 2,
  points: 52,
  draw_source: 'deck',
  drawn_count: 3,
});

describe('MeldScoreAnimationLayer', () => {
  it('sem última ação, não mostra nada', () => {
    renderWithProviders(<MeldScoreAnimationLayer state={gameState()} />);

    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  it('Jogada de outro jogador: mostra as cartas jogadas, a combinação e quem jogou; avisa ao terminar a contagem', async () => {
    const onScoreCounted = vi.fn();

    renderWithProviders(
      <MeldScoreAnimationLayer
        state={gameState({ last_action: meld(1) })}
        onScoreCounted={onScoreCounted}
      />,
    );

    // Jogada é pública: os valores reais aparecem para todos.
    expect(screen.getAllByRole('button', { name: '8 de copas' }).length).toBeGreaterThan(0);
    expect(screen.getByRole('button', { name: '2 de paus' })).toBeInTheDocument();
    // A combinação e o nome aparecem quando as cartas pousam no centro.
    expect(screen.queryByText('Par')).not.toBeInTheDocument();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(2000);
    });

    expect(screen.getByText('Par')).toBeInTheDocument();
    expect(screen.getByText('Bruno')).toBeInTheDocument();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(20_000);
    });

    expect(onScoreCounted).toHaveBeenCalledWith(10);
    expect(sounds.chipTick).toHaveBeenCalled();
  });

  it('não reage a ações que não são Jogada', () => {
    renderWithProviders(
      <MeldScoreAnimationLayer state={gameState({ last_action: { id: 1, seat: 1, type: 'discard', created_at: null, discarded_count: 2 } })} />,
    );

    expect(screen.queryByText(/pontos/)).not.toBeInTheDocument();
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });
});

describe('DrawAnimation', () => {
  it('quem comprou foi você: as cartas reais voam para a sua mão', () => {
    const action = { ...meld(0), drawn_cards: cards('diamonds-K', 'clubs-9', 'spades-4') };

    renderWithProviders(<DrawAnimation state={gameState({ last_action: action })} />);

    expect(screen.getByRole('button', { name: 'K de ouros' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '9 de paus' })).toBeInTheDocument();
  });

  it('quem comprou foi outro: só cartas viradas para baixo (nunca a identidade)', () => {
    const { container } = renderWithProviders(<DrawAnimation state={gameState({ last_action: meld(2) })} />);

    expect(screen.queryByRole('button')).not.toBeInTheDocument();
    expect(container.querySelectorAll('.card-back')).toHaveLength(3);
  });

  it('some ao terminar o voo', async () => {
    const { container } = renderWithProviders(<DrawAnimation state={gameState({ last_action: meld(2) })} />);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(5000);
    });

    expect(container.querySelectorAll('.card-back')).toHaveLength(0);
  });

  it('Troca não tem compra: nada a animar', () => {
    const { container } = renderWithProviders(
      <DrawAnimation state={gameState({ last_action: { id: 3, seat: 0, type: 'swap', created_at: null, partner_seat: 2, swap_quantity: 2 } })} />,
    );

    expect(container.querySelectorAll('.card-back')).toHaveLength(0);
  });
});

describe('DiscardAnimation', () => {
  it('cartas viradas para baixo voando para o Descarte, com som', async () => {
    const { container } = renderWithProviders(
      <DiscardAnimation state={gameState({ last_action: { id: 4, seat: 3, type: 'discard', created_at: null, discarded_count: 2, draw_source: 'deck', drawn_count: 2 } })} />,
    );

    expect(container.querySelectorAll('.card-back')).toHaveLength(2);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(500);
    });

    expect(sounds.cardsPlayed).toHaveBeenCalledWith(2);
  });

  it('não reage a Jogadas', () => {
    const { container } = renderWithProviders(<DiscardAnimation state={gameState({ last_action: meld(1) })} />);

    expect(container.querySelectorAll('.card-back')).toHaveLength(0);
  });
});

describe('SwapAnimation', () => {
  it('cartas viradas cruzando entre os parceiros (as duas direções)', () => {
    const { container } = renderWithProviders(
      <SwapAnimation state={gameState({ last_action: { id: 5, seat: 1, type: 'swap', created_at: null, partner_seat: 3, swap_quantity: 2 } })} />,
    );

    expect(container.querySelectorAll('.card-back')).toHaveLength(4);
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
    expect(sounds.swapCardsFly).toHaveBeenCalledWith(2, expect.any(Number), expect.any(Number));
  });
});

describe('TurnChip', () => {
  it('ficha decorativa (aria-hidden)', () => {
    const { container } = renderWithProviders(
      <TurnChip
        side="top"
        turnKey="0"
      />,
    );

    const chip = container.querySelector('.absolute.z-20');

    expect(chip).toHaveAttribute('aria-hidden', 'true');
    expect(chip?.querySelector('svg')).toBeInTheDocument();
  });
});
