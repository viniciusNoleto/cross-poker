// Service worker do Cross Poker.
//
// Estratégia:
// - /api/** (inclusive os streams SSE) nunca passa pelo cache: o jogo é 100% online e o
//   estado da Partida tem que vir sempre do servidor.
// - Navegações (HTML): rede primeiro; sem conexão, cai na página /offline.html.
// - /_next/static/** (arquivos com hash, imutáveis): cache primeiro.
// - Demais arquivos estáticos do mesmo domínio (ícones etc.): stale-while-revalidate.

const VERSION = 'v1';
const STATIC_CACHE = `cross-poker-static-${VERSION}`;
const OFFLINE_URL = '/offline.html';

const PRECACHE = [
  OFFLINE_URL,
  '/icon.svg',
  '/android-chrome-192x192.png',
  '/android-chrome-512x512.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(STATIC_CACHE)
      .then((cache) => cache.addAll(PRECACHE))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(
        keys
          .filter((key) => key.startsWith('cross-poker-') && key !== STATIC_CACHE)
          .map((key) => caches.delete(key)),
      ))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;

  if (request.method !== 'GET') return;

  const url = new URL(request.url);

  if (url.origin !== self.location.origin) return;
  if (url.pathname.startsWith('/api/')) return;
  if (request.headers.get('accept')?.includes('text/event-stream')) return;

  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request).catch(async () => {
        const cache = await caches.open(STATIC_CACHE);

        return (await cache.match(OFFLINE_URL)) ?? Response.error();
      }),
    );

    return;
  }

  if (url.pathname.startsWith('/_next/static/')) {
    event.respondWith(cacheFirst(request));

    return;
  }

  if (/\.(?:png|svg|ico|webp|jpg|jpeg|gif|woff2?)$/.test(url.pathname)) {
    event.respondWith(staleWhileRevalidate(request, event));
  }
});

async function cacheFirst(request) {
  const cache = await caches.open(STATIC_CACHE);
  const cached = await cache.match(request);

  if (cached) return cached;

  const response = await fetch(request);

  if (response.ok) cache.put(request, response.clone());

  return response;
}

async function staleWhileRevalidate(request, event) {
  const cache = await caches.open(STATIC_CACHE);
  const cached = await cache.match(request);

  const network = fetch(request)
    .then((response) => {
      if (response.ok) cache.put(request, response.clone());

      return response;
    })
    .catch(() => cached ?? Response.error());

  if (cached) {
    event.waitUntil(network);

    return cached;
  }

  return network;
}
