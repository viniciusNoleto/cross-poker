'use client';

import { useSyncExternalStore } from 'react';

// Background music for the Partida: one ambient track on loop, with its own volume and mute
// (independent from the sound effects in `utils/sound.ts`, preferences kept in this browser).
//
// The track is an `<audio loop>` element streamed by the browser (a 3-minute track decoded into
// a Web Audio buffer would take ~45MB of memory). It's routed through a Web Audio GainNode
// because iOS ignores `HTMLMediaElement.volume` — the gain is the only volume control that works
// everywhere, and it also gives smooth fade-in/fade-out.
//
// `.ogg` (Vorbis) is preferred; browsers that can't play it (older Safari) get the `.m4a` (AAC).
// Browsers only allow audio after a user gesture: until the first pointer/key interaction,
// `startGameMusic` just records the intent and the music starts on that interaction.

const MUSIC_SOURCES = [
  { src: '/audio/game-music.ogg', type: 'audio/ogg; codecs=vorbis' },
  { src: '/audio/game-music.m4a', type: 'audio/mp4; codecs="mp4a.40.2"' },
];

const VOLUME_KEY = 'cp_music_volume';
const MUTED_KEY = 'cp_music_muted';

// Ambient by default: the slider sits at 30%, and the gain follows a squared curve (closer to how
// loudness is perceived), so 30% ≈ -21dB — background, under the sound effects.
export const DEFAULT_MUSIC_VOLUME = 0.3;

const FADE_IN_S = 2.5;
const FADE_OUT_S = 1.2;
const RAMP_S = 0.08;

type MusicSettings = { volume: number; muted: boolean };

let settings: MusicSettings = { volume: DEFAULT_MUSIC_VOLUME, muted: false };
let audio: HTMLAudioElement | null = null;
let context: AudioContext | null = null;
let gain: GainNode | null = null;
let wanted = false; // a game screen asked for music (it may still be waiting for a user gesture)
let pauseTimer: ReturnType<typeof setTimeout> | null = null;
const listeners = new Set<() => void>();

if (typeof window !== 'undefined') {
  try {
    const storedVolume = Number(window.localStorage.getItem(VOLUME_KEY));
    const storedMuted = window.localStorage.getItem(MUTED_KEY);

    settings = {
      volume: window.localStorage.getItem(VOLUME_KEY) !== null && Number.isFinite(storedVolume)
        ? clamp(storedVolume)
        : DEFAULT_MUSIC_VOLUME,
      muted: storedMuted === '1',
    };
  } catch {
    // Storage unavailable (private mode, blocked site data) — keep the defaults in memory.
  }

  const unlock = () => {
    if (wanted) play();
  };

  window.addEventListener('pointerdown', unlock, { passive: true });
  window.addEventListener('keydown', unlock);
}

function clamp(value: number): number {
  return Math.min(1, Math.max(0, value));
}

function targetGain(): number {
  return settings.muted ? 0 : settings.volume ** 2;
}

function pickSource(element: HTMLAudioElement): string {
  const playable = MUSIC_SOURCES.find(({ type }) => element.canPlayType(type) !== '');

  return (playable ?? MUSIC_SOURCES[MUSIC_SOURCES.length - 1]).src;
}

function setup(): boolean {
  if (typeof window === 'undefined') return false;

  if (!audio) {
    audio = new Audio();
    audio.loop = true;
    audio.preload = 'auto';
    audio.src = pickSource(audio);
  }

  if (!context) {
    const AudioContextClass = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;

    if (!AudioContextClass) {
      // No Web Audio: fall back to the element's own volume (ignored on iOS, fine elsewhere).
      audio.volume = targetGain();

      return true;
    }

    context = new AudioContextClass();
    gain = context.createGain();
    gain.gain.value = 0;
    context.createMediaElementSource(audio).connect(gain);
    gain.connect(context.destination);
  }

  return true;
}

function rampTo(value: number, seconds: number) {
  if (!context || !gain) {
    if (audio) audio.volume = value;

    return;
  }

  const now = context.currentTime;

  gain.gain.cancelScheduledValues(now);
  gain.gain.setValueAtTime(gain.gain.value, now);
  gain.gain.linearRampToValueAtTime(value, now + seconds);
}

function play() {
  if (!setup() || !audio) return;

  if (pauseTimer) {
    clearTimeout(pauseTimer);
    pauseTimer = null;
  }

  // Muted: don't even download/decode — the music starts when it's unmuted.
  if (settings.muted) return;

  context?.resume().catch(() => undefined);

  if (!audio.paused) {
    rampTo(targetGain(), FADE_IN_S);

    return;
  }

  audio.play()
    .then(() => rampTo(targetGain(), FADE_IN_S))
    // Autoplay blocked (no user gesture yet): the next pointer/key interaction retries.
    .catch(() => undefined);
}

function pause(fadeSeconds: number) {
  if (!audio || audio.paused) return;

  rampTo(0, fadeSeconds);

  if (pauseTimer) clearTimeout(pauseTimer);

  pauseTimer = setTimeout(() => {
    pauseTimer = null;
    audio?.pause();
  }, fadeSeconds * 1000 + 50);
}

function emit() {
  listeners.forEach((listener) => listener());
}

function save() {
  try {
    window.localStorage.setItem(VOLUME_KEY, String(settings.volume));
    window.localStorage.setItem(MUTED_KEY, settings.muted ? '1' : '0');
  } catch {
    // Storage unavailable — keep the in-memory value only.
  }
}

// Called by the game screen while the Partida is being played; the track keeps its position
// between calls, so it resumes where it stopped.
export function startGameMusic() {
  wanted = true;
  play();
}

export function stopGameMusic() {
  wanted = false;
  pause(FADE_OUT_S);
}

// Briefly lowers the music so an important sound effect (turn announcements) stands out, then
// brings it back. No-op while the music isn't playing.
export function duckGameMusic(seconds: number) {
  if (!context || !gain || !audio || audio.paused || settings.muted) return;

  const now = context.currentTime;
  const target = targetGain();

  gain.gain.cancelScheduledValues(now);
  gain.gain.setValueAtTime(gain.gain.value, now);
  gain.gain.linearRampToValueAtTime(target * 0.3, now + 0.06);
  gain.gain.setValueAtTime(target * 0.3, now + seconds);
  gain.gain.linearRampToValueAtTime(target, now + seconds + 0.5);
}

export function setMusicVolume(volume: number) {
  const unmuting = settings.muted && volume > 0;

  settings = { volume: clamp(volume), muted: settings.muted && !unmuting };
  save();

  if (unmuting && wanted) play();
  else rampTo(targetGain(), RAMP_S);

  emit();
}

export function setMusicMuted(muted: boolean) {
  settings = { ...settings, muted };
  save();

  if (muted) pause(RAMP_S * 3);
  else if (wanted) play();

  emit();
}

function subscribe(listener: () => void) {
  listeners.add(listener);

  return () => {
    listeners.delete(listener);
  };
}

const serverSettings: MusicSettings = { volume: DEFAULT_MUSIC_VOLUME, muted: false };

export function useMusicSettings(): MusicSettings {
  return useSyncExternalStore(subscribe, () => settings, () => serverSettings);
}
