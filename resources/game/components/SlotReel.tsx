'use client';

import { UtilsFor } from '@/components/utils/For';

const STRIP = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 0];

export type SlotReelProps = {
  // Value shown by the reels. May be fractional while counting: each column then sits between two
  // digits, like a mechanical odometer (the units column spins fast, the higher ones slowly).
  value: number;
  // Minimum number of columns — leading zeros are shown dimmed, like a slot machine counter.
  digits?: number;
  // Reels spinning blurred in a loop, before the value is known.
  spinning?: boolean;
  // "Jackpot" window: gold background, ink digits.
  lit?: boolean;
  // Digit colour when the window isn't lit.
  tone?: 'paper' | 'gold';
  className?: string;
};

function digitCount(value: number, digits: number) {
  return Math.max(digits, String(Math.max(0, Math.round(value))).length);
}

/**
 * A slot machine counter window: one rolling strip of digits per column. Purely visual — the
 * rounded value is exposed to screen readers as plain text.
 */
export function SlotReel({
  value, digits = 1, spinning = false, lit = false, tone = 'paper', className = '',
}: SlotReelProps) {
  const safeValue = Math.max(0, value);
  const count = digitCount(safeValue, digits);
  // Powers of ten, highest column first (e.g. [2, 1, 0] for three columns).
  const columns = Array.from({ length: count }, (_, index) => count - 1 - index);

  const digitColor = lit ? 'text-gold-ink' : tone === 'gold' ? 'text-gold' : 'text-paper';

  return (
    <span
      className={`inline-flex items-stretch gap-0.75 p-0.75 font-display tabular-nums leading-none transition-colors duration-300 ${lit ? 'bg-gold' : 'bg-gold-deep'} ${className}`}
    >
      <span className="sr-only">
        {Math.round(safeValue)}
      </span>

      <UtilsFor
        each={columns}
        eachKey={({ item }) => item}
      >
        {({ item: power }) => {
          // Odometer: the units column turns continuously; a higher column only turns while every
          // column below it is rolling over from 9 to 0 — so it always rests exactly on a digit.
          const unit = 10 ** power;
          const position = (Math.floor(safeValue / unit) % 10) + Math.max(0, (safeValue % unit) - (unit - 1));
          const leading = power > 0 && Math.round(safeValue) < 10 ** power && !spinning;

          return (
            <span
              className={`relative block overflow-hidden w-[0.72em] h-[1.15em] transition-colors duration-300 ${lit ? 'bg-paper' : 'bg-ink'}`}
              aria-hidden="true"
            >
              <span
                key={spinning ? 'spin' : 'land'}
                className={`block h-full ${spinning ? '' : 'animate-reel-land'}`}
                style={{ animationDelay: `${power * 60}ms` }}
              >
                <span
                  className={`flex flex-col transition-opacity duration-300 ${digitColor} ${spinning ? 'animate-reel-spin blur-[0.8px]' : ''} ${leading ? 'opacity-25' : 'opacity-100'}`}
                  style={{
                    transform: spinning ? undefined : `translateY(${(-position * 100) / STRIP.length}%)`,
                    animationDuration: spinning ? `${260 + power * 70}ms` : undefined,
                  }}
                >
                  <UtilsFor
                    each={STRIP}
                    eachKey={({ index }) => index}
                  >
                    {({ item: digit }) => (
                      <span className="flex items-center justify-center h-[1.15em]">
                        {digit}
                      </span>
                    )}
                  </UtilsFor>
                </span>
              </span>
            </span>
          );
        }}
      </UtilsFor>
    </span>
  );
}

/**
 * The row of marquee bulbs around the slot cabinet: idle (dim), chasing (a light running along
 * the row) or flashing all together (jackpot).
 */
export function MarqueeBulbs({ count, mode, size = 7 }: { count: number; mode: 'idle' | 'chase' | 'flash' | 'on'; size?: number }) {
  const bulbs = Array.from({ length: count }, (_, index) => index);

  const modeClass = {
    idle: 'opacity-[0.22]',
    chase: 'animate-bulb-chase',
    flash: 'animate-bulb-flash',
    on: 'opacity-100',
  }[mode];

  return (
    <span
      className="flex justify-between gap-1.5 w-full"
      aria-hidden="true"
    >
      <UtilsFor
        each={bulbs}
        eachKey={({ item }) => item}
      >
        {({ item: index }) => (
          <span
            className={`block rounded-full transition-opacity duration-300 ${index % 2 ? 'bg-paper' : 'bg-gold'} ${modeClass}`}
            style={{ width: size, height: size, animationDelay: mode === 'chase' ? `${(index * 1000) / count}ms` : undefined }}
          />
        )}
      </UtilsFor>
    </span>
  );
}
