'use client';

import { Icon } from '@iconify/react';
import { Button, Popover, Slider } from '@mantine/core';
import { ActionButton } from './ActionButton';
import { setMusicMuted, setMusicVolume, useMusicSettings } from '@/utils/music';

// Background music control: mute + volume, independent from the sound effects (SoundToggle).
export function MusicControl({ className = '' }: { className?: string }) {
  const { volume, muted } = useMusicSettings();

  const silent = muted || volume === 0;
  const percent = Math.round(volume * 100);

  return (
    <Popover
      position="bottom-end"
      withArrow
      shadow="md"
    >
      <Popover.Target>
        {/* Popover.Target needs an element that takes a ref: the span does, and the click bubbles up to it. */}
        <span className={`inline-flex ${className}`}>
          <ActionButton
            label="Música de fundo"
            tone="felt"
            size="icon"
            icon="lucide:music"
            iconClassName={`transition-opacity ${silent ? 'opacity-35' : ''}`}
          />
        </span>
      </Popover.Target>

      <Popover.Dropdown className="w-60">
        <div className="flex flex-col gap-3">
          <div className="flex items-center justify-between gap-2">
            <span className="text-sm font-semibold">
              Música de fundo
            </span>

            <span className="text-xs tabular-nums text-gray-500">
              {silent ? 'Mudo' : `${percent}%`}
            </span>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="subtle"
              color="gray"
              size="compact-sm"
              aria-label={muted ? 'Ativar música' : 'Silenciar música'}
              title={muted ? 'Ativar música' : 'Silenciar música'}
              onClick={() => setMusicMuted(!muted)}
            >
              <Icon
                icon={muted ? 'lucide:volume-x' : 'lucide:volume-1'}
                className="w-4 h-4"
              />
            </Button>

            <Slider
              className="flex-1"
              min={0}
              max={100}
              step={5}
              value={muted ? 0 : percent}
              onChange={(value) => setMusicVolume(value / 100)}
              label={(value) => `${value}%`}
              thumbLabel="Volume da música"
            />
          </div>
        </div>
      </Popover.Dropdown>
    </Popover>
  );
}
