import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { FakeAudioContext } from '../../support/fake-audio';

class FakeAudio {
  static instances: FakeAudio[] = [];

  loop = false;

  preload = '';

  src = '';

  volume = 1;

  paused = true;

  constructor() {
    FakeAudio.instances.push(this);
  }

  canPlayType = vi.fn((type: string): string => (type.startsWith('audio/ogg') ? 'probably' : ''));

  play = vi.fn(async () => {
    this.paused = false;
  });

  pause = vi.fn(() => {
    this.paused = true;
  });
}

async function loadMusic() {
  vi.resetModules();

  return import('@/utils/music');
}

beforeEach(() => {
  FakeAudio.instances = [];
  FakeAudioContext.instances = [];
  window.localStorage.clear();
  (window as any).AudioContext = FakeAudioContext;
  (globalThis as any).Audio = FakeAudio;
});

afterEach(() => {
  vi.useRealTimers();
});

describe('utils/music — música de fundo', () => {
  it('padrões: volume 30%, sem mudo', async () => {
    const { useMusicSettings, DEFAULT_MUSIC_VOLUME } = await loadMusic();
    const { result } = renderHook(() => useMusicSettings());

    expect(result.current).toEqual({ volume: DEFAULT_MUSIC_VOLUME, muted: false });
  });

  it('lê volume e mudo salvos (volume limitado a 0..1)', async () => {
    window.localStorage.setItem('cp_music_volume', '7');
    window.localStorage.setItem('cp_music_muted', '1');

    const { useMusicSettings } = await loadMusic();
    const { result } = renderHook(() => useMusicSettings());

    expect(result.current).toEqual({ volume: 1, muted: true });
  });

  it('startGameMusic toca a faixa .ogg em loop', async () => {
    const { startGameMusic } = await loadMusic();

    startGameMusic();
    await Promise.resolve();

    const [audio] = FakeAudio.instances;

    expect(audio.loop).toBe(true);
    expect(audio.src).toBe('/audio/game-music.ogg');
    expect(audio.play).toHaveBeenCalled();
  });

  it('sem suporte a ogg, usa o .m4a', async () => {
    const { startGameMusic } = await loadMusic();

    // Sobrescrito no `beforeEach` do próximo teste.
    (globalThis as any).Audio = class extends FakeAudio {
      canPlayType = vi.fn(() => '');
    };

    startGameMusic();

    expect(FakeAudio.instances[0].src).toBe('/audio/game-music.m4a');
  });

  it('mudo: não toca nada', async () => {
    window.localStorage.setItem('cp_music_muted', '1');

    const { startGameMusic } = await loadMusic();

    startGameMusic();

    expect(FakeAudio.instances[0]?.play).not.toHaveBeenCalled();
  });

  it('setMusicMuted(true) pausa depois do fade e persiste', async () => {
    vi.useFakeTimers();

    const { startGameMusic, setMusicMuted, useMusicSettings } = await loadMusic();
    const { result } = renderHook(() => useMusicSettings());

    startGameMusic();
    await vi.waitFor(() => expect(FakeAudio.instances[0].paused).toBe(false));

    act(() => setMusicMuted(true));
    vi.advanceTimersByTime(2000);

    expect(FakeAudio.instances[0].pause).toHaveBeenCalled();
    expect(result.current.muted).toBe(true);
    expect(window.localStorage.getItem('cp_music_muted')).toBe('1');
  });

  it('subir o volume estando mudo tira o mudo e volta a tocar', async () => {
    window.localStorage.setItem('cp_music_muted', '1');

    const { startGameMusic, setMusicVolume, useMusicSettings } = await loadMusic();
    const { result } = renderHook(() => useMusicSettings());

    startGameMusic();
    act(() => setMusicVolume(0.8));

    expect(result.current).toEqual({ volume: 0.8, muted: false });
    expect(FakeAudio.instances[0].play).toHaveBeenCalled();
    expect(window.localStorage.getItem('cp_music_volume')).toBe('0.8');
  });

  it('stopGameMusic pausa a faixa', async () => {
    vi.useFakeTimers();

    const { startGameMusic, stopGameMusic } = await loadMusic();

    startGameMusic();
    await vi.waitFor(() => expect(FakeAudio.instances[0].paused).toBe(false));

    stopGameMusic();
    vi.advanceTimersByTime(3000);

    expect(FakeAudio.instances[0].paused).toBe(true);
  });

  it('duckGameMusic abaixa e devolve o ganho enquanto toca', async () => {
    const { startGameMusic, duckGameMusic } = await loadMusic();

    startGameMusic();
    await vi.waitFor(() => expect(FakeAudio.instances[0].paused).toBe(false));

    const [ctx] = FakeAudioContext.instances;
    const gain = ctx.createGain.mock.results[0].value.gain;

    gain.linearRampToValueAtTime.mockClear();
    duckGameMusic(1);

    expect(gain.linearRampToValueAtTime).toHaveBeenCalledTimes(2);
  });

  it('duckGameMusic não faz nada com a música parada', async () => {
    const { duckGameMusic } = await loadMusic();

    expect(() => duckGameMusic(1)).not.toThrow();
  });
});
