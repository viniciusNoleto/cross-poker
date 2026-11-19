import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach, vi } from 'vitest';

// O jsdom não implementa estas APIs, usadas pelo Mantine (media queries, popovers, ScrollArea).
if (!window.matchMedia) {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: (query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    }),
  });
}

class ResizeObserverStub {
  observe() {}

  unobserve() {}

  disconnect() {}
}

globalThis.ResizeObserver ??= ResizeObserverStub as unknown as typeof ResizeObserver;

window.HTMLElement.prototype.scrollIntoView ??= () => {};

// Os efeitos sonoros usam Web Audio, que o jsdom não tem: nos testes de componente eles viram espiões.
vi.mock('@/utils/sound', () => {
  const sounds = new Proxy({} as Record<string, ReturnType<typeof vi.fn>>, {
    get(target, key: string) {
      target[key] ??= vi.fn();

      return target[key];
    },
  });

  return {
    sounds,
    isSoundMuted: () => true,
    setSoundMuted: vi.fn(),
    useSoundMuted: () => true,
  };
});

afterEach(() => {
  cleanup();
});
