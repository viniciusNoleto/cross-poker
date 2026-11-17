import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Atrás do Nginx Proxy Manager: sem isto o nginx bufferiza as respostas em streaming
  // (SSE de /api/rooms/[code]/stream e /api/games/[gameId]/stream) e o tempo real trava.
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          {
            key: 'X-Accel-Buffering',
            value: 'no',
          },
        ],
      },
      {
        // Service worker do PWA: nunca cachear o próprio sw.js, senão as atualizações
        // demoram a chegar aos jogadores.
        source: '/sw.js',
        headers: [
          {
            key: 'Content-Type',
            value: 'application/javascript; charset=utf-8',
          },
          {
            key: 'Cache-Control',
            value: 'no-cache, no-store, must-revalidate',
          },
          {
            key: 'Content-Security-Policy',
            value: "default-src 'self'; script-src 'self'",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
