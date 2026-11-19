import { vi } from 'vitest';

/** AudioParam que só registra a automação agendada. */
function param(initial = 0) {
  return {
    value: initial,
    setValueAtTime: vi.fn(),
    linearRampToValueAtTime: vi.fn(),
    exponentialRampToValueAtTime: vi.fn(),
    cancelScheduledValues: vi.fn(),
  };
}

function node(extra: Record<string, unknown> = {}) {
  return { connect: vi.fn(), disconnect: vi.fn(), ...extra };
}

/** Web Audio de mentira: registra os osciladores/ruídos criados, para os testes contarem as notas. */
export class FakeAudioContext {
  static instances: FakeAudioContext[] = [];

  state: 'suspended' | 'running' = 'running';

  currentTime = 0;

  sampleRate = 44100;

  destination = node();

  oscillators: any[] = [];

  sources: any[] = [];

  constructor() {
    FakeAudioContext.instances.push(this);
  }

  resume = vi.fn(async () => {
    this.state = 'running';
  });

  createGain = vi.fn(() => node({ gain: param(1) }));

  createWaveShaper = vi.fn(() => node({ curve: null, oversample: 'none' }));

  createBiquadFilter = vi.fn(() => node({ type: 'lowpass', frequency: param(), Q: param() }));

  createDynamicsCompressor = vi.fn(() => node({ threshold: param(), knee: param(), ratio: param(), attack: param(), release: param() }));

  createOscillator = vi.fn(() => {
    const oscillator = node({ type: 'square', frequency: param(440), detune: param(), start: vi.fn(), stop: vi.fn() });

    this.oscillators.push(oscillator);

    return oscillator;
  });

  createBuffer = vi.fn((_channels: number, length: number) => ({ getChannelData: () => new Float32Array(length) }));

  createBufferSource = vi.fn(() => {
    const source = node({ buffer: null, loop: false, playbackRate: param(1), start: vi.fn(), stop: vi.fn() });

    this.sources.push(source);

    return source;
  });

  createMediaElementSource = vi.fn(() => node());
}
