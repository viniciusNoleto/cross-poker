import { defineConfig, devices } from '@playwright/test';

/**
 * Testes E2E: o app de verdade (build de produção) num navegador de verdade, com vários jogadores ao
 * mesmo tempo (um contexto de navegador por jogador). Roda isolado do ambiente de desenvolvimento:
 *
 * - banco `<POSTGRES_DB>_e2e`, recriado do zero no Postgres do container (`make up` precisa estar no ar);
 * - build de produção em `.next-e2e`, servido na porta E2E_PORT (`tests/e2e/support/server.sh`).
 *
 *   npm run test:e2e                       compila, sobe o servidor e roda tudo
 *   E2E_SKIP_BUILD=1 npm run test:e2e      reaproveita o último build
 *   npm run test:e2e -- --ui               modo interativo
 *
 * O vídeo de demonstração tem a sua própria config (`playwright.demo.config.ts`).
 */
const PORT = Number(process.env['E2E_PORT'] ?? 3300);
const BASE_URL = `http://localhost:${PORT}`;

export default defineConfig({
  testDir: 'tests/e2e',
  testMatch: '**/*.e2e.ts',
  outputDir: 'test-results-e2e',
  timeout: 90_000,
  expect: { timeout: 15_000 },
  // Cada teste cria a sua própria sala: podem rodar em paralelo no mesmo servidor.
  fullyParallel: true,
  // Cada teste de mesa abre até 4 abas com animações pesadas: mais workers deixa o navegador lento.
  workers: 2,
  retries: process.env['CI'] ? 1 : 0,
  forbidOnly: !!process.env['CI'],
  reporter: process.env['CI'] ? [['list'], ['html', { open: 'never', outputFolder: 'playwright-report' }]] : 'list',
  use: {
    baseURL: BASE_URL,
    locale: 'pt-BR',
    timezoneId: 'America/Sao_Paulo',
    actionTimeout: 15_000,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [
    {
      name: 'desktop',
      use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 900 } },
    },
    {
      name: 'mobile',
      use: { ...devices['Pixel 7'] },
      // No celular: a entrada (home → sala) e a mesa com as ações principais.
      testMatch: ['**/home.e2e.ts', '**/lobby.e2e.ts', '**/mobile.e2e.ts'],
    },
  ],
  webServer: {
    command: 'bash tests/e2e/support/server.sh',
    url: BASE_URL,
    reuseExistingServer: !process.env['CI'],
    timeout: 400_000,
    stdout: 'ignore',
    stderr: 'pipe',
    env: { E2E_PORT: String(PORT) },
  },
});
