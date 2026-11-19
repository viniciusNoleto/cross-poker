import { describe, expect, it, vi } from 'vitest';
import { publish, subscribe } from '@/libs/realtimeHub';

describe('realtimeHub — pub/sub em memória', () => {
  it('entrega o evento a todos os assinantes do canal', () => {
    const a = vi.fn();
    const b = vi.fn();
    const offA = subscribe('game:1', a);
    const offB = subscribe('game:1', b);

    publish('game:1');

    expect(a).toHaveBeenCalledTimes(1);
    expect(b).toHaveBeenCalledTimes(1);
    offA();
    offB();
  });

  it('não vaza entre canais', () => {
    const listener = vi.fn();
    const off = subscribe('room:ABC', listener);

    publish('room:XYZ');
    publish('game:1');

    expect(listener).not.toHaveBeenCalled();
    off();
  });

  it('cancelar a assinatura para de entregar e limpa o canal vazio', () => {
    const listener = vi.fn();
    const off = subscribe('game:2', listener);

    off();
    publish('game:2');

    expect(listener).not.toHaveBeenCalled();
    expect((globalThis as any).__crossPokerChannels.has('game:2')).toBe(false);
  });

  it('publicar num canal sem ninguém não falha', () => {
    expect(() => publish('game:404')).not.toThrow();
  });

  it('o registro fica em globalThis (compartilhado com a rotina de inatividade)', () => {
    const off = subscribe('game:3', () => {});

    expect((globalThis as any).__crossPokerChannels).toBeInstanceOf(Map);
    expect((globalThis as any).__crossPokerChannels.get('game:3').size).toBe(1);
    off();
  });
});
