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
    ];
  },
};

export default nextConfig;
