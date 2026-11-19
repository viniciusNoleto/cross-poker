import { screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { Card } from '@/resources/game/components/Card';
import { DiscardPile } from '@/resources/game/components/DiscardPile';
import { MeldPile } from '@/resources/game/components/MeldPile';
import { Scoreboard } from '@/resources/game/components/Scoreboard';
import { PlayerSeat } from '@/resources/game/components/PlayerSeat';
import { DrawSourcePicker } from '@/resources/game/components/DrawSourcePicker';
import { COMBOS, ComboHelpButton } from '@/resources/game/components/ComboReference';
import { SoundToggle } from '@/resources/game/components/SoundToggle';
import { MusicControl } from '@/resources/game/components/MusicControl';
import { bestCombo } from '@/resources/game/models/Combo';
import { chipsForCard } from '@/resources/game/models/Card';
import { EActionType } from '@/resources/game/enums/EActionType';
import { setSoundMuted } from '@/utils/sound';
import { cards, gameState, player } from '../../support/factories';
import { renderWithProviders } from '../../support/render';

describe('Card', () => {
  it('carta virada para cima: botão com nome acessível "valor de naipe"', () => {
    renderWithProviders(<Card card={cards('hearts-Q')[0]} />);

    expect(screen.getByRole('button', { name: 'Q de copas' })).toBeDisabled();
  });

  it('carta clicável: aria-pressed reflete a seleção e o clique chama onClick', async () => {
    const onClick = vi.fn();
    const { user, rerender } = renderWithProviders(
      <Card
        card={cards('spades-10')[0]}
        onClick={onClick}
      />,
    );
    const button = screen.getByRole('button', { name: '10 de espadas' });

    expect(button).toHaveAttribute('aria-pressed', 'false');

    await user.click(button);
    expect(onClick).toHaveBeenCalledTimes(1);

    rerender(
      <Card
        card={cards('spades-10')[0]}
        onClick={onClick}
        selected
      />,
    );
    expect(screen.getByRole('button', { name: '10 de espadas' })).toHaveAttribute('aria-pressed', 'true');
  });

  it('carta virada para baixo não revela nada', () => {
    const { container } = renderWithProviders(<Card card={null} />);

    expect(screen.queryByRole('button')).not.toBeInTheDocument();
    expect(container.querySelector('.card-back')).toBeInTheDocument();
  });

  it('desenha um naipe por "pip" nas cartas numéricas', () => {
    renderWithProviders(<Card card={cards('diamonds-7')[0]} />);

    // 7 pips + 2 índices de canto
    expect(screen.getByRole('button').textContent!.match(/♦/g)).toHaveLength(9);
  });
});

describe('DiscardPile', () => {
  it('mostra só a contagem', () => {
    renderWithProviders(<DiscardPile count={4} />);

    expect(screen.getByText('Descarte (4)')).toBeInTheDocument();
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  it('vazio', () => {
    renderWithProviders(<DiscardPile count={0} />);

    expect(screen.getByText('Descarte (0)')).toBeInTheDocument();
  });
});

describe('MeldPile (Bolo)', () => {
  it('mostra as últimas cartas e abre a lista completa ao clicar, mais recentes primeiro', async () => {
    const pile = cards('hearts-2', 'hearts-3', 'hearts-4', 'hearts-5', 'hearts-6');
    const { user } = renderWithProviders(<MeldPile meldPile={pile} />);
    const trigger = screen.getByRole('button', { name: 'Ver o Bolo (5 cartas)' });

    // Na mesa só aparecem as 4 do topo.
    expect(within(trigger).getAllByRole('button')).toHaveLength(4);

    await user.click(trigger);

    const dialog = await screen.findByRole('dialog');
    const names = within(dialog).getAllByRole('button').map((button) => button.getAttribute('aria-label'));

    expect(names).toEqual(['6 de copas', '5 de copas', '4 de copas', '3 de copas', '2 de copas']);
  });

  it('abre pelo teclado', async () => {
    const { user } = renderWithProviders(<MeldPile meldPile={cards('clubs-A')} />);

    screen.getByRole('button', { name: /Ver o Bolo/ }).focus();
    await user.keyboard('{Enter}');

    expect(await screen.findByRole('dialog')).toBeInTheDocument();
  });

  it('vazio: não abre', async () => {
    const { user } = renderWithProviders(<MeldPile meldPile={[]} />);
    const trigger = screen.getByRole('button', { name: 'Ver o Bolo (0 cartas)' });

    expect(trigger).toHaveAttribute('aria-disabled', 'true');

    await user.click(trigger);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });
});

describe('Scoreboard', () => {
  it('soma os pontos por dupla e destaca a equipe na frente', () => {
    const players = [
      player(0, { score: 100 }),
      player(1, { score: 30 }),
      player(2, { score: 20 }),
      player(3, { score: 60 }),
    ];

    renderWithProviders(<Scoreboard players={players} />);

    expect(screen.getByText('120')).toHaveClass('text-gold');
    expect(screen.getByText('90')).not.toHaveClass('text-gold');
    expect(screen.getByText('Ana 100 · Carla 20')).toBeInTheDocument();
    expect(screen.getByText('Bruno 30 · Diego 60')).toBeInTheDocument();
  });

  it('empate: ninguém destacado', () => {
    renderWithProviders(<Scoreboard players={[0, 1, 2, 3].map((seat) => player(seat, { score: 10 }))} />);

    screen.getAllByText('20').forEach((total) => expect(total).not.toHaveClass('text-gold'));
  });
});

describe('PlayerSeat', () => {
  it('oponente: leque de cartas viradas, nome, pontos e Jogadas/Descartes restantes', () => {
    renderWithProviders(
      <PlayerSeat
        player={player(1, { hand_count: 7, score: 42, melds_remaining: 3, discards_remaining: 1 })}
        isCurrentTurn={false}
        turnKey="t"
        side="left"
      />,
    );

    expect(screen.getByLabelText('7 cartas na mão')).toBeInTheDocument();
    expect(screen.getByText('Bruno')).toBeInTheDocument();
    expect(screen.getByText('42')).toBeInTheDocument();
    expect(screen.getByLabelText('Jogadas: 3 de 5')).toBeInTheDocument();
    expect(screen.getByLabelText('Descartes: 1 de 5')).toBeInTheDocument();
  });

  it('seu assento (embaixo) não desenha o leque', () => {
    renderWithProviders(
      <PlayerSeat
        player={player(0)}
        isCurrentTurn
        turnKey="t"
        side="bottom"
      />,
    );

    expect(screen.queryByLabelText(/cartas na mão/)).not.toBeInTheDocument();
    expect(screen.getByText('Ana')).toHaveClass('text-gold');
  });
});

describe('DrawSourcePicker', () => {
  function renderPicker(overrides: Partial<Parameters<typeof DrawSourcePicker>[0]> = {}) {
    const onPick = vi.fn();
    const onCancel = vi.fn();
    const result = renderWithProviders(
      <DrawSourcePicker
        state={gameState({ deck_count: 20, discard_count: 1 })}
        actionType={EActionType.MELD}
        quantity={2}
        pendingSource={null}
        onPick={onPick}
        onCancel={onCancel}
        {...overrides}
      />,
    );

    return { ...result, onPick, onCancel };
  }

  it('mostra a ação e a quantidade a comprar', () => {
    renderPicker();

    expect(screen.getByText('Jogada · comprar 2 carta(s) de:')).toBeInTheDocument();
  });

  it('desabilita o Descarte sem cartas suficientes e escolhe o Monte', async () => {
    const { user, onPick } = renderPicker();

    expect(screen.getByRole('button', { name: 'Descarte' })).toBeDisabled();

    await user.click(screen.getByRole('button', { name: 'Monte' }));
    expect(onPick).toHaveBeenCalledWith('deck');
  });

  it('com as duas origens disponíveis, escolhe o Descarte', async () => {
    const { user, onPick } = renderPicker({ state: gameState({ deck_count: 20, discard_count: 5 }), actionType: EActionType.DISCARD });

    expect(screen.getByText('Descarte · comprar 2 carta(s) de:')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Descarte' }));
    expect(onPick).toHaveBeenCalledWith('discard');
  });

  it('Monte sem cartas mesmo com o Bolo, mas Descarte com cartas: Monte desabilitado', () => {
    renderPicker({ state: gameState({ deck_count: 0, discard_count: 5, meld_pile: cards('hearts-2') }) });

    expect(screen.getByRole('button', { name: 'Monte' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Descarte' })).toBeEnabled();
  });

  it('Cancelar', async () => {
    const { user, onCancel } = renderPicker();

    await user.click(screen.getByRole('button', { name: 'Cancelar' }));
    expect(onCancel).toHaveBeenCalled();
  });

  it('com a requisição em andamento, tudo fica travado', () => {
    renderPicker({ pendingSource: 'deck' });

    expect(screen.getByRole('button', { name: 'Cancelar' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Descarte' })).toBeDisabled();
  });
});

describe('ComboReference', () => {
  it('a tabela de consulta bate com o motor de pontuação', () => {
    COMBOS.forEach((combo) => {
      const result = bestCombo(combo.cards);
      const cardChips = result.scoringCards.reduce((sum, card) => sum + chipsForCard(card), 0);

      expect(result.type, combo.name).toBe(combo.id);
      expect(result.multiplier, combo.name).toBe(combo.multiplier);
      expect(result.chips - cardChips, combo.name).toBe(combo.baseChips);
    });
  });

  it('o botão "Como pontuar" abre a consulta', async () => {
    const { user } = renderWithProviders(<ComboHelpButton />);

    await user.click(screen.getByRole('button', { name: /Como pontuar/ }));

    const dialog = await screen.findByRole('dialog', { name: 'Combinações e pontuação' });

    COMBOS.forEach((combo) => expect(within(dialog).getAllByText(combo.name).length).toBeGreaterThan(0));
  });
});

describe('SoundToggle', () => {
  it('alterna o mudo', async () => {
    const { user } = renderWithProviders(<SoundToggle />);

    // `useSoundMuted` é stub (mudo) no setup: o botão oferece ativar os sons.
    await user.click(screen.getByRole('button', { name: 'Ativar sons' }));

    expect(setSoundMuted).toHaveBeenCalledWith(false);
  });
});

describe('MusicControl', () => {
  it('abre o controle de volume e silencia a música', async () => {
    const { user } = renderWithProviders(<MusicControl />);

    await user.click(screen.getByRole('button', { name: 'Música de fundo' }));
    expect(await screen.findByText('30%')).toBeInTheDocument();

    // O dropdown do Popover ainda está na transição de entrada (oculto para a árvore de acessibilidade).
    await user.click(screen.getByLabelText('Silenciar música'));
    expect(await screen.findByText('Mudo')).toBeInTheDocument();
  });
});
