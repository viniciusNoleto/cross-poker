'use client';

import { useSyncExternalStore } from 'react';
import { duckGameMusic } from './music';

// Retro "32-bit" sound effects synthesized on the fly with the Web Audio API — no audio files.
// Every sound is a short sequence of square/triangle notes (plus filtered noise for the card
// "flicks"), passed through a light bit-crusher to give it that console-era grit.
//
// Browsers only allow audio after a user gesture: the AudioContext is created lazily and resumed
// on the first pointer/key interaction. Until then, calls are silently ignored.

const MUTED_KEY = 'cp_sound_muted';
const MASTER_VOLUME = 0.16;
// Turn announcements (your turn / partner / opponent) go through their own, louder bus: they must
// cut through the meld animation sounds and the background music, which often play at the same time.
const ALERT_VOLUME = 0.42;

let context: AudioContext | null = null;
let master: GainNode | null = null;
let alert: GainNode | null = null;
let noiseBuffer: AudioBuffer | null = null;
let muted = false;
const listeners = new Set<() => void>();

if (typeof window !== 'undefined') {
  try {
    muted = window.localStorage.getItem(MUTED_KEY) === '1';
  } catch {
    muted = false;
  }

  const unlock = () => {
    const ctx = getContext();

    if (ctx && ctx.state === 'suspended') ctx.resume().catch(() => undefined);
  };

  window.addEventListener('pointerdown', unlock, { passive: true });
  window.addEventListener('keydown', unlock);
}

// Quantizes the waveform to a few levels — the "bit" in the retro sound.
function crushCurve(levels: number): Float32Array<ArrayBuffer> {
  const samples = 1024;
  const curve = new Float32Array(samples);

  for (let i = 0; i < samples; i++) {
    const x = (i / (samples - 1)) * 2 - 1;

    curve[i] = Math.round(x * levels) / levels;
  }

  return curve;
}

function getContext(): AudioContext | null {
  if (typeof window === 'undefined') return null;

  if (!context) {
    const AudioContextClass = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;

    if (!AudioContextClass) return null;

    context = new AudioContextClass();

    // Chain: every sound → `master` (entry) → bit-crusher → output volume → speakers.
    const crusher = context.createWaveShaper();
    const output = context.createGain();

    crusher.curve = crushCurve(24);
    output.gain.value = MASTER_VOLUME;

    master = context.createGain();
    master.connect(crusher);
    crusher.connect(output);
    output.connect(context.destination);

    // Alert bus: same retro grit (a bit finer), louder output.
    const alertCrusher = context.createWaveShaper();
    const alertOutput = context.createGain();

    alertCrusher.curve = crushCurve(32);
    alertOutput.gain.value = ALERT_VOLUME;

    alert = context.createGain();
    alert.connect(alertCrusher);
    alertCrusher.connect(alertOutput);
    alertOutput.connect(context.destination);
  }

  return context;
}

function ready(): AudioContext | null {
  if (muted) return null;

  const ctx = getContext();

  if (!ctx || ctx.state !== 'running') return null;

  return ctx;
}

type Bus = 'fx' | 'alert';

function busNode(bus: Bus): GainNode {
  return bus === 'alert' ? alert! : master!;
}

type ToneOptions = {
  freq: number;
  at?: number; // seconds from now
  duration: number;
  type?: OscillatorType;
  volume?: number;
  slideTo?: number;
  vibrato?: number; // depth in Hz (6Hz rate) — gives sustained notes a "ringing" feel
  bus?: Bus;
};

function tone(ctx: AudioContext, { freq, at = 0, duration, type = 'square', volume = 1, slideTo, vibrato, bus = 'fx' }: ToneOptions) {
  const start = ctx.currentTime + at;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();

  osc.type = type;
  osc.frequency.setValueAtTime(freq, start);

  if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, start + duration);

  gain.gain.setValueAtTime(0.0001, start);
  gain.gain.exponentialRampToValueAtTime(volume, start + 0.008);
  gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);

  if (vibrato) {
    const lfo = ctx.createOscillator();
    const depth = ctx.createGain();

    lfo.frequency.value = 6;
    depth.gain.value = vibrato;
    lfo.connect(depth);
    depth.connect(osc.frequency);
    lfo.start(start);
    lfo.stop(start + duration + 0.02);
  }

  osc.connect(gain);
  gain.connect(busNode(bus));
  osc.start(start);
  osc.stop(start + duration + 0.02);
}

function noise(ctx: AudioContext, { at = 0, duration, volume = 1, highpass = 1800, bus = 'fx' }: { at?: number; duration: number; volume?: number; highpass?: number; bus?: Bus }) {
  if (!noiseBuffer) {
    noiseBuffer = ctx.createBuffer(1, ctx.sampleRate * 0.5, ctx.sampleRate);

    const data = noiseBuffer.getChannelData(0);

    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
  }

  const start = ctx.currentTime + at;
  const source = ctx.createBufferSource();
  const filter = ctx.createBiquadFilter();
  const gain = ctx.createGain();

  source.buffer = noiseBuffer;
  filter.type = 'highpass';
  filter.frequency.value = highpass;

  gain.gain.setValueAtTime(volume, start);
  gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);

  source.connect(filter);
  filter.connect(gain);
  gain.connect(busNode(bus));
  source.start(start);
  source.stop(start + duration + 0.02);
}

// Band-passed noise whose center frequency sweeps `from` → `to`: the "air" of a card flying by.
function whoosh(ctx: AudioContext, { at = 0, duration, from, to, volume = 1 }: { at?: number; duration: number; from: number; to: number; volume?: number }) {
  if (!noiseBuffer) noise(ctx, { duration: 0.001, volume: 0.0001 });

  const start = ctx.currentTime + at;
  const source = ctx.createBufferSource();
  const filter = ctx.createBiquadFilter();
  const gain = ctx.createGain();

  source.buffer = noiseBuffer;
  source.loop = true;
  filter.type = 'bandpass';
  filter.Q.value = 2.5;
  filter.frequency.setValueAtTime(from, start);
  filter.frequency.exponentialRampToValueAtTime(to, start + duration);

  // Swells in, peaks in the middle (card passing closest), fades out.
  gain.gain.setValueAtTime(0.0001, start);
  gain.gain.exponentialRampToValueAtTime(volume, start + duration * 0.45);
  gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);

  source.connect(filter);
  filter.connect(gain);
  gain.connect(busNode('fx'));
  source.start(start);
  source.stop(start + duration + 0.02);
}

// Semitone helper around A4 = 440Hz.
function note(semitonesFromA4: number): number {
  return 440 * 2 ** (semitonesFromA4 / 12);
}

// C5, E5, G5, C6...
const C5 = note(3);
const E5 = note(7);
const G5 = note(10);
const C6 = note(15);
const E6 = note(19);
const G6 = note(22);

export const sounds = {
  // Cards hitting the table — one flick per card.
  cardsPlayed(count = 1) {
    const ctx = ready();

    if (!ctx) return;

    for (let i = 0; i < Math.max(1, Math.min(count, 6)); i++) {
      const at = i * 0.075;

      noise(ctx, { at, duration: 0.06, volume: 0.9, highpass: 2400 });
      tone(ctx, { at, freq: 900, slideTo: 300, duration: 0.05, volume: 0.35 });
    }
  },

  // One chip being counted; `step` raises the pitch as the count goes up.
  chipTick(step = 0) {
    const ctx = ready();

    if (!ctx) return;

    const freq = note(10 + Math.min(step, 14) * 2);

    tone(ctx, { freq, duration: 0.07, volume: 0.5 });
    tone(ctx, { freq: freq * 2, at: 0.035, duration: 0.05, type: 'triangle', volume: 0.35 });
  },

  // Fast roll of chips for the final total, ending on a bright "ding".
  chipRoll() {
    const ctx = ready();

    if (!ctx) return;

    for (let i = 0; i < 9; i++) {
      tone(ctx, { freq: note(12 + i * 2), at: i * 0.055, duration: 0.05, volume: 0.4 });
    }

    tone(ctx, { freq: C6, at: 0.52, duration: 0.25, type: 'triangle', volume: 0.7 });
    tone(ctx, { freq: G5, at: 0.52, duration: 0.25, volume: 0.35 });
  },

  // Card picked up from the hand: tiny rising blip.
  cardSelect() {
    const ctx = ready();

    if (!ctx) return;

    noise(ctx, { duration: 0.025, volume: 0.3, highpass: 5000 });
    tone(ctx, { freq: note(12), slideTo: note(19), duration: 0.06, type: 'triangle', volume: 0.55 });
  },

  // Card put back in the hand: the same blip, falling and a bit lower.
  cardDeselect() {
    const ctx = ready();

    if (!ctx) return;

    noise(ctx, { duration: 0.02, volume: 0.2, highpass: 3500 });
    tone(ctx, { freq: note(14), slideTo: note(5), duration: 0.07, type: 'triangle', volume: 0.45 });
  },

  // "Jogada" chosen: confident power-chord stab going up a fifth.
  chooseMeld() {
    const ctx = ready();

    if (!ctx) return;

    tone(ctx, { freq: note(-2), duration: 0.09, volume: 0.45 });
    tone(ctx, { freq: note(5), duration: 0.09, volume: 0.35 });
    tone(ctx, { freq: note(5), at: 0.09, duration: 0.2, volume: 0.45 });
    tone(ctx, { freq: note(12), at: 0.09, duration: 0.2, type: 'triangle', volume: 0.45 });
  },

  // "Descarte" chosen: an airy whoosh ending in a low thud (cards tossed aside).
  chooseDiscard() {
    const ctx = ready();

    if (!ctx) return;

    noise(ctx, { duration: 0.16, volume: 0.45, highpass: 900 });
    tone(ctx, { freq: note(-14), at: 0.1, slideTo: note(-26), duration: 0.14, type: 'triangle', volume: 0.8 });
  },

  // "Troca" chosen: ping-pong between two notes, like cards going back and forth.
  chooseSwap() {
    const ctx = ready();

    if (!ctx) return;

    [note(7), note(2), note(7), note(2), note(14)].forEach((freq, index) => {
      tone(ctx, { freq, at: index * 0.06, duration: index === 4 ? 0.14 : 0.05, type: 'triangle', volume: 0.55 });
    });
  },

  // Troca modal: one more card appears on each side — a snap plus a short rising pop whose pitch
  // climbs with the quantity, so 1→5 reads as a growing pile.
  swapCardAppear(quantity = 1) {
    const ctx = ready();

    if (!ctx) return;

    const base = note(2 + Math.min(quantity, 5) * 2);

    noise(ctx, { duration: 0.03, volume: 0.45, highpass: 4500 });
    tone(ctx, { freq: base * 0.75, slideTo: base, duration: 0.06, type: 'triangle', volume: 0.5 });
    tone(ctx, { freq: base * 1.5, at: 0.05, duration: 0.07, type: 'triangle', volume: 0.3 });
  },

  // Troca modal: a card leaves the pile — the same pop, falling and softer.
  swapCardVanish(quantity = 1) {
    const ctx = ready();

    if (!ctx) return;

    const base = note(2 + Math.min(quantity, 5) * 2);

    noise(ctx, { duration: 0.025, volume: 0.25, highpass: 3500 });
    tone(ctx, { freq: base * 1.25, slideTo: base * 0.7, duration: 0.08, type: 'triangle', volume: 0.4 });
  },

  // Troca confirmed: "deal closed" — a firm double handshake thump, then a resolving
  // dominant → tonic cadence (G → C) with a ringing top note, like a stamp on the agreement.
  swapDeal() {
    const ctx = ready();

    if (!ctx) return;

    // Handshake: two quick low thumps.
    [0, 0.11].forEach((at) => {
      noise(ctx, { at, duration: 0.05, volume: 0.5, highpass: 500 });
      tone(ctx, { freq: note(-26), at, slideTo: note(-31), duration: 0.09, type: 'triangle', volume: 0.75 });
    });

    // Cadence: G major stab → C major chord ringing.
    tone(ctx, { freq: note(-2), at: 0.24, duration: 0.1, volume: 0.3 });
    tone(ctx, { freq: note(2), at: 0.24, duration: 0.1, type: 'triangle', volume: 0.35 });

    tone(ctx, { freq: C5, at: 0.36, duration: 0.45, volume: 0.28, vibrato: 4 });
    tone(ctx, { freq: E5, at: 0.36, duration: 0.45, type: 'triangle', volume: 0.35 });
    tone(ctx, { freq: G5, at: 0.36, duration: 0.45, type: 'triangle', volume: 0.3 });
    tone(ctx, { freq: C6, at: 0.42, duration: 0.4, type: 'triangle', volume: 0.3, vibrato: 6 });
  },

  // Troca resolving on the table: the two streams of cards cross each other. Each card gets a
  // flick on departure, a whoosh while flying (one stream sweeping up, the other down, so the
  // crossing is audible) and a soft landing tap. Timings mirror `SwapAnimation.tsx`.
  swapCardsFly(count = 1, durationMs = 750, staggerMs = 70) {
    const ctx = ready();

    if (!ctx) return;

    const flight = durationMs / 1000;
    const cards = Math.max(1, Math.min(count, 5));

    for (let i = 0; i < cards; i++) {
      const at = (i * staggerMs) / 1000;

      noise(ctx, { at, duration: 0.04, volume: 0.6, highpass: 3200 });
      whoosh(ctx, { at, duration: flight, from: 700, to: 3200, volume: 0.9 });
      whoosh(ctx, { at: at + 0.02, duration: flight, from: 3000, to: 650, volume: 0.9 });
      tone(ctx, { freq: note(5), at: at + flight * 0.35, slideTo: note(10), duration: flight * 0.3, type: 'triangle', volume: 0.12 });

      noise(ctx, { at: at + flight - 0.03, duration: 0.05, volume: 0.55, highpass: 2400 });
      tone(ctx, { freq: 700, at: at + flight - 0.03, slideTo: 280, duration: 0.05, volume: 0.25 });
    }
  },

  // Draw from the Monte: a quick riffle of cards being shuffled off the top.
  chooseDeck() {
    const ctx = ready();

    if (!ctx) return;

    for (let i = 0; i < 6; i++) {
      noise(ctx, { at: i * 0.035, duration: 0.03, volume: 0.55, highpass: 3000 + i * 300 });
    }

    tone(ctx, { freq: note(0), at: 0.21, duration: 0.12, volume: 0.35, slideTo: note(7) });
  },

  // Draw from the Descarte: muted two-note pluck going down (face-down cards, a bit mysterious).
  chooseDiscardPile() {
    const ctx = ready();

    if (!ctx) return;

    tone(ctx, { freq: note(3), duration: 0.08, type: 'sawtooth', volume: 0.25 });
    tone(ctx, { freq: note(-1), at: 0.08, duration: 0.16, type: 'sawtooth', volume: 0.25 });
    noise(ctx, { at: 0.08, duration: 0.04, volume: 0.2, highpass: 2000 });
  },

  // Chips landing on the scoreboard tower: ceramic clack + a small bounce, once per chip.
  chipDrop(count = 1) {
    const ctx = ready();

    if (!ctx) return;

    for (let i = 0; i < Math.max(1, Math.min(count, 6)); i++) {
      const at = i * 0.09;

      noise(ctx, { at, duration: 0.03, volume: 0.6, highpass: 6000 });
      tone(ctx, { freq: 2300, at, duration: 0.04, volume: 0.3 });
      tone(ctx, { freq: 3400, at: at + 0.005, duration: 0.03, type: 'triangle', volume: 0.3 });
      tone(ctx, { freq: 2600, at: at + 0.06, duration: 0.025, volume: 0.15 });
    }
  },

  // It's your turn: bright fanfare — a sparkle, a fast octave-doubled arpeggio and a ringing
  // major chord on top. The loudest and longest of the three, so it's hard to miss.
  yourTurn() {
    const ctx = ready();

    if (!ctx) return;

    duckGameMusic(1.3);

    noise(ctx, { duration: 0.08, volume: 0.35, highpass: 6000, bus: 'alert' });

    [C5, E5, G5, C6].forEach((freq, index) => {
      const at = index * 0.075;

      tone(ctx, { freq, at, duration: 0.11, volume: 0.4, bus: 'alert' });
      tone(ctx, { freq: freq / 2, at, duration: 0.11, type: 'triangle', volume: 0.35, bus: 'alert' });
    });

    // Ringing chord: C6 + E6 + G6 with a bass C4 underneath.
    tone(ctx, { freq: C6, at: 0.3, duration: 0.65, volume: 0.3, vibrato: 6, bus: 'alert' });
    tone(ctx, { freq: E6, at: 0.3, duration: 0.65, type: 'triangle', volume: 0.35, vibrato: 7, bus: 'alert' });
    tone(ctx, { freq: G6, at: 0.3, duration: 0.65, type: 'triangle', volume: 0.3, vibrato: 8, bus: 'alert' });
    tone(ctx, { freq: C5 / 2, at: 0.3, duration: 0.4, type: 'triangle', volume: 0.45, bus: 'alert' });

    // Two high "glints" over the chord.
    tone(ctx, { freq: C6 * 2, at: 0.38, duration: 0.12, type: 'triangle', volume: 0.25, bus: 'alert' });
    tone(ctx, { freq: G6 * 2, at: 0.5, duration: 0.2, type: 'triangle', volume: 0.2, bus: 'alert' });
  },

  // Turn passed to your partner: warm "ding-dong" doorbell, bell-like (triangle + octave).
  allyTurn() {
    const ctx = ready();

    if (!ctx) return;

    duckGameMusic(0.9);

    tone(ctx, { freq: E6, duration: 0.3, type: 'triangle', volume: 0.55, bus: 'alert' });
    tone(ctx, { freq: E5, duration: 0.3, volume: 0.22, bus: 'alert' });
    noise(ctx, { duration: 0.03, volume: 0.25, highpass: 7000, bus: 'alert' });

    tone(ctx, { freq: C6, at: 0.2, duration: 0.5, type: 'triangle', volume: 0.6, vibrato: 5, bus: 'alert' });
    tone(ctx, { freq: C5, at: 0.2, duration: 0.5, volume: 0.22, bus: 'alert' });
    tone(ctx, { freq: G5, at: 0.2, duration: 0.4, type: 'triangle', volume: 0.25, bus: 'alert' });
    noise(ctx, { at: 0.2, duration: 0.03, volume: 0.25, highpass: 7000, bus: 'alert' });
  },

  // Turn passed to an opponent: low, tense "uh-oh" — two heavy descending stabs (minor second)
  // over a bass thump, gritty sawtooth instead of the friendly triangles of the other two.
  opponentTurn() {
    const ctx = ready();

    if (!ctx) return;

    duckGameMusic(0.9);

    noise(ctx, { duration: 0.06, volume: 0.4, highpass: 400, bus: 'alert' });
    tone(ctx, { freq: note(-36), slideTo: note(-42), duration: 0.18, type: 'triangle', volume: 0.7, bus: 'alert' });

    tone(ctx, { freq: note(-4), duration: 0.14, type: 'sawtooth', volume: 0.32, bus: 'alert' });
    tone(ctx, { freq: note(-16), duration: 0.14, volume: 0.32, bus: 'alert' });

    tone(ctx, { freq: note(-5), at: 0.17, duration: 0.42, type: 'sawtooth', volume: 0.32, slideTo: note(-7), vibrato: 4, bus: 'alert' });
    tone(ctx, { freq: note(-17), at: 0.17, duration: 0.42, volume: 0.32, slideTo: note(-19), bus: 'alert' });
    tone(ctx, { freq: note(-29), at: 0.17, duration: 0.42, type: 'triangle', volume: 0.5, bus: 'alert' });
  },

  // Slot-machine reels: ticks that slow down over `durationMs`, then a landing chime.
  roulette(durationMs = 1700) {
    const ctx = ready();

    if (!ctx) return;

    const total = durationMs / 1000;
    let at = 0;
    let gap = 0.04;
    let index = 0;

    while (at < total) {
      tone(ctx, { freq: index % 2 ? note(5) : note(8), at, duration: 0.03, volume: 0.22 });
      noise(ctx, { at, duration: 0.02, volume: 0.25, highpass: 4000 });
      at += gap;
      gap *= 1.07;
      index++;
    }

    tone(ctx, { freq: G5, at: total, duration: 0.12, volume: 0.4 });
    tone(ctx, { freq: C6, at: total + 0.1, duration: 0.3, type: 'triangle', volume: 0.5 });
  },

  // End of the Partida: fanfare for a win, a sad fall for a loss, a neutral chord for a tie.
  gameEnd(outcome: 'win' | 'lose' | 'tie' = 'win') {
    const ctx = ready();

    if (!ctx) return;

    const melodies: Record<typeof outcome, number[]> = {
      win: [C5, E5, G5, C6, G5, C6, E5 * 2, C6 * 2],
      lose: [G5, note(8), E5, note(5), note(3), note(0), note(-2), note(-5)],
      tie: [C5, G5, E5, G5, C5, G5, C6, C6],
    };

    melodies[outcome].forEach((freq, index) => {
      const last = index === melodies[outcome].length - 1;

      tone(ctx, { freq, at: index * 0.11, duration: last ? 0.6 : 0.12, volume: 0.55 });
      tone(ctx, { freq: freq / 2, at: index * 0.11, duration: last ? 0.6 : 0.12, type: 'triangle', volume: 0.45 });
    });

    for (let i = 0; i < 6; i++) {
      noise(ctx, { at: 0.9 + i * 0.09, duration: 0.05, volume: 0.35, highpass: 5000 });
    }
  },
};

export function isSoundMuted(): boolean {
  return muted;
}

export function setSoundMuted(value: boolean) {
  muted = value;

  try {
    window.localStorage.setItem(MUTED_KEY, value ? '1' : '0');
  } catch {
    // Storage unavailable (private mode, blocked site data) — keep the in-memory value only.
  }

  if (!value) getContext()?.resume().catch(() => undefined);

  listeners.forEach((listener) => listener());
}

function subscribe(listener: () => void) {
  listeners.add(listener);

  return () => {
    listeners.delete(listener);
  };
}

export function useSoundMuted(): boolean {
  return useSyncExternalStore(subscribe, () => muted, () => false);
}
