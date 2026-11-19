'use client';

import { UtilsFor } from '@/components/utils/For';
import { UtilsIf } from '@/components/utils/If';
import { Card } from './Card';

export type DiscardPileProps = {
  count: number;
};

/**
 * The Descarte: cards discarded face down. Only the count is public. It is a draw source
 * (top cards first), alongside the Monte.
 */
export function DiscardPile({ count }: DiscardPileProps) {
  const visible = Math.min(count, 3);

  return (
    <div className="flex flex-col items-center gap-1.5">
      <div className="relative w-12 h-16.75">
        <UtilsFor
          each={Array.from({ length: visible })}
          eachKey={({ index }) => index}
        >
          {({ index }) => (
            <div
              className="absolute top-0 left-0"
              style={{ transform: `translate(${(visible - 1 - index) * 2}px, ${(visible - 1 - index) * 2}px) rotate(${(index - 1) * 4}deg)` }}
            >
              <Card card={null} />
            </div>
          )}
        </UtilsFor>

        <UtilsIf condition={!count}>
          {() => (
            <div className="w-12 h-16.75 rounded-md border-2 border-dashed border-paper/25" />
          )}
        </UtilsIf>
      </div>

      <span className="text-paper/85 text-[13px] tabular-nums">
        {`Descarte (${count})`}
      </span>
    </div>
  );
}
