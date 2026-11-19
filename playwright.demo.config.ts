import { defineConfig, devices } from '@playwright/test';

/**
 * Vídeo de demonstração: um único teste que cria a sala, enche a mesa, joga algumas rodadas e mostra o fim
 * da partida, gravando a tela do anfitrião (screencast do Chrome) e o som do jogo. Os outros três jogadores
 * agem pela API. Roda isolado do ambiente de desenvolvimento:
 *
 * - banco `<POSTGRES_DB>_demo`, recriado do zero, no Postgres do container (`make up` precisa estar no ar);
 * - build de produção em `.next-demo`, servido na porta DEMO_PORT (`tests/demo/support/demo-server.sh`).
 *
 *   npm run demo:video                     compila, sobe o servidor e grava em videos/demo.mp4
 *   DEMO_SKIP_BUILD=1 npm run demo:video   reaproveita o último build
 */
const PORT = Number(process.env['DEMO_PORT'] ?? 3200);
const BASE_URL = `http://localhost:${PORT}`;

export default defineConfig({
  testDir: 'tests/demo',
  testMatch: '**/*.demo.ts',
  outputDir: 'test-results-demo',
  // A gravação inteira é um teste só.
  timeout: 10 * 60_000,
  expect: { timeout: 20_000 },
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: 'list',
  use: {
    ...devices['Desktop Chrome'],
    baseURL: BASE_URL,
    viewport: { width: 1440, height: 900 },
    deviceScaleFactor: 1,
    locale: 'pt-BR',
    timezoneId: 'America/Sao_Paulo',
    // Cada ação um pouco mais lenta, para ser acompanhada no vídeo.
    // O som do jogo é gravado dentro da página (ver `installAudioTap` em `tests/demo/match.demo.ts`):
    // áudio liberado sem gesto, e sem saída de áudio real — no WSL/headless ela trava o relógio do Web Audio
    // depois de ~30s; com a saída falsa do Chrome, o áudio é renderizado em tempo real e sem pausas.
    launchOptions: { slowMo: 40, args: ['--autoplay-policy=no-user-gesture-required', '--disable-audio-output'] },
    actionTimeout: 15_000,
    trace: 'retain-on-failure',
  },
  webServer: {
    command: 'bash tests/demo/support/demo-server.sh',
    url: BASE_URL,
    reuseExistingServer: true,
    timeout: 400_000,
    stdout: 'ignore',
    stderr: 'pipe',
    env: { DEMO_PORT: String(PORT) },
  },
});
