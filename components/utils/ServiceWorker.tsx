'use client';

import { useEffect } from 'react';

// Registra o service worker do PWA (public/sw.js). Só em produção: em dev o cache
// atrapalharia o HMR do Next.
export function UtilsServiceWorker() {
  useEffect(() => {
    if (process.env.NODE_ENV !== 'production') return;
    if (!('serviceWorker' in navigator)) return;

    navigator.serviceWorker
      .register('/sw.js', { scope: '/', updateViaCache: 'none' })
      .catch((err) => console.error('Falha ao registrar o service worker:', err));
  }, []);

  return null;
}
