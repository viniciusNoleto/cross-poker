import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // O vídeo de demonstração (`npm run demo:video`) compila em `.next-demo`, para não disputar o `.next`
  // com o `next dev` do container, e usa o `tsconfig.demo.json`, que ignora os tipos gerados no `.next`.
  distDir: process.env.NEXT_DIST_DIR || '.next',
  typescript: {
    tsconfigPath: process.env.NEXT_TSCONFIG || 'tsconfig.json',
  },
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
