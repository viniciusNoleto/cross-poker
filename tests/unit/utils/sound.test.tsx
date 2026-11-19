import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { FakeAudioContext } from '../../support/fake-audio';

// O setup do projeto `dom` substitui `@/utils/sound` por espiões; aqui o módulo real é testado.
vi.unmock('@/utils/sound');

const duckGameMusic = vi.hoisted(() => vi.fn());

vi.mock('@/utils/music', () => ({ duckGameMusic }));

async function loadSound() {
  vi.resetModules();

  return import('@/utils/sound');
}

beforeEach(() => {
  FakeAudioContext.instances = [];
  window.localStorage.clear();
  (window as any).AudioContext = FakeAudioContext;
  duckGameMusic.mockClear();
});

describe('utils/sound — efeitos sonoros', () => {
  it('lê a preferência de mudo salva no navegador', async () => {
    window.localStorage.setItem('cp_sound_muted', '1');

    const { isSoundMuted } = await loadSound();

    expect(isSoundMuted()).toBe(true);
  });

  it('setSoundMuted persiste e avisa o hook', async () => {
    const { setSoundMuted, useSoundMuted } = await loadSound();
    const { result } = renderHook(() => useSoundMuted());

    expect(result.current).toBe(false);

    act(() => setSoundMuted(true));

    expect(result.current).toBe(true);
    expect(window.localStorage.getItem('cp_sound_muted')).toBe('1');

    act(() => setSoundMuted(false));

    expect(result.current).toBe(false);
    expect(window.localStorage.getItem('cp_sound_muted')).toBe('0');
  });

  it('com som ligado, cada efeito sintetiza notas no Web Audio', async () => {
    const { sounds } = await loadSound();
    const effects = Object.keys(sounds) as Array<keyof typeof sounds>;

    effects.forEach((effect) => {
      if (effect === 'gameEnd') {
        (['win', 'lose', 'tie'] as const).forEach((outcome) => sounds.gameEnd(outcome));
      } else {
        (sounds[effect] as (...args: any[]) => void)(3);
      }
    });

    const [ctx] = FakeAudioContext.instances;

    expect(ctx).toBeDefined();
    expect(ctx.oscillators.length + ctx.sources.length).toBeGreaterThan(effects.length);
  });

  it('cardsPlayed toca uma "batida" por carta (limitado a 6)', async () => {
    const { sounds } = await loadSound();

    sounds.cardsPlayed(2);
    const [ctx] = FakeAudioContext.instances;
    const afterTwo = ctx.sources.length;

    sounds.cardsPlayed(50);

    expect(afterTwo).toBe(2);
    expect(ctx.sources.length - afterTwo).toBe(6);
  });

  it('os avisos de vez abaixam a música por instantes', async () => {
    const { sounds } = await loadSound();

    sounds.yourTurn();

    expect(duckGameMusic).toHaveBeenCalled();
  });

  it('mudo: nenhum som é criado', async () => {
    window.localStorage.setItem('cp_sound_muted', '1');

    const { sounds } = await loadSound();

    sounds.cardsPlayed(3);
    sounds.yourTurn();

    const created = FakeAudioContext.instances.reduce((sum, ctx) => sum + ctx.oscillators.length + ctx.sources.length, 0);

    expect(created).toBe(0);
  });

  it('sem Web Audio no navegador, os efeitos são ignorados sem erro', async () => {
    delete (window as any).AudioContext;

    const { sounds } = await loadSound();

    expect(() => sounds.cardsPlayed(2)).not.toThrow();
  });
});
