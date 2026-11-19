import { afterEach, describe, expect, it, vi } from 'vitest';

const startStaleGameSweeper = vi.hoisted(() => vi.fn());

vi.mock('@/libs/staleGames', () => ({ startStaleGameSweeper }));

const { register } = await import('@/instrumentation');

afterEach(() => {
  vi.unstubAllEnvs();
  startStaleGameSweeper.mockClear();
});

describe('instrumentation.register', () => {
  it('no runtime Node, inicia a rotina de inatividade', async () => {
    vi.stubEnv('NEXT_RUNTIME', 'nodejs');

    await register();

    expect(startStaleGameSweeper).toHaveBeenCalledTimes(1);
  });

  it('no runtime Edge, não faz nada (sem banco nem pub/sub)', async () => {
    vi.stubEnv('NEXT_RUNTIME', 'edge');

    await register();

    expect(startStaleGameSweeper).not.toHaveBeenCalled();
  });
});
