'use client';

import { FormButton } from '@/components/form/Button';
import { setSoundMuted, useSoundMuted } from '@/utils/sound';

// Mute/unmute for every game sound (preference kept in this browser).
export function SoundToggle({ className = '' }: { className?: string }) {
  const muted = useSoundMuted();

  return (
    <FormButton
      variant="subtle"
      color="gray.0"
      className={className}
      icon={muted ? 'lucide:volume-x' : 'lucide:volume-2'}
      tooltip={muted ? 'Ativar sons' : 'Silenciar sons'}
      aria-label={muted ? 'Ativar sons' : 'Silenciar sons'}
      onClick={() => setSoundMuted(!muted)}
    />
  );
}
