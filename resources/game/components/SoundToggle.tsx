'use client';

import { ActionButton } from './ActionButton';
import { setSoundMuted, useSoundMuted } from '@/utils/sound';

// Mute/unmute for every game sound (preference kept in this browser).
export function SoundToggle({ className = '' }: { className?: string }) {
  const muted = useSoundMuted();

  return (
    <span className={`inline-flex ${className}`}>
      <ActionButton
        label={muted ? 'Ativar sons' : 'Silenciar sons'}
        tone="felt"
        size="icon"
        icon={muted ? 'lucide:volume-x' : 'lucide:volume-2'}
        tooltip={muted ? 'Ativar sons' : 'Silenciar sons'}
        onClick={() => setSoundMuted(!muted)}
      />
    </span>
  );
}
