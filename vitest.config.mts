import path from 'node:path';
import { fileURLToPath } from 'node:url';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';
import { testDatabaseEnv } from './tests/support/database-env.mjs';

const root = path.dirname(fileURLToPath(import.meta.url));

// `@/src/*` e `@/*` apontam para a raiz (ver tsconfig.json). `server-only` só existe dentro do Next:
// nos testes vira um módulo vazio, para os Route Handlers e libs poderem ser importados direto.
const resolve = {
  alias: [
    { find: /^@\/src\//, replacement: `${root}/` },
    { find: /^@\//, replacement: `${root}/` },
    { find: /^server-only$/, replacement: path.join(root, 'tests/support/server-only.ts') },
  ],
};

/**
 * Três projetos:
 * - `unit`: regras puras (models, utils, libs sem banco), ambiente Node;
 * - `dom`: componentes, logics e hooks React, em jsdom com Testing Library;
 * - `integration`: Route Handlers de verdade contra um Postgres descartável (`<POSTGRES_DB>_test`).
 *
 *   npm run test:unit           unit + dom
 *   npm run test:integration    integration (precisa do Postgres do `make up`)
 *   npm run test:coverage       tudo, com cobertura
 */
export default defineConfig({
  plugins: [react()],
  resolve,
  test: {
    coverage: {
      provider: 'v8',
      reporter: ['text-summary', 'html', 'lcov'],
      reportsDirectory: 'coverage',
      include: [
        'app/api/**/*.ts',
        'libs/**/*.ts',
        'resources/**/*.{ts,tsx}',
        'utils/**/*.ts',
        'components/**/*.tsx',
      ],
      exclude: [
        '**/*.d.ts',
        // Mapas de tradução e config de tema: só dados.
        'libs/i18n.ts',
        'libs/matine/**',
        'libs/yup/**',
        // Código morto herdado do template: importa `js-cookie`, que nem está instalado.
        'utils/cookies.ts',
        // Seções visuais da home (marketing), cobertas pelo E2E.
        'resources/game/fragments/Home/**',
      ],
    },
    projects: [
      {
        plugins: [react()],
        resolve,
        test: {
          name: 'unit',
          environment: 'node',
          include: ['tests/unit/**/*.test.ts'],
        },
      },
      {
        plugins: [react()],
        resolve,
        test: {
          name: 'dom',
          environment: 'jsdom',
          include: ['tests/unit/**/*.test.tsx'],
          setupFiles: ['tests/support/dom-setup.ts'],
          css: false,
        },
      },
      {
        plugins: [react()],
        resolve,
        test: {
          name: 'integration',
          environment: 'node',
          include: ['tests/integration/**/*.test.ts'],
          globalSetup: ['tests/integration/support/global-setup.ts'],
          setupFiles: ['tests/integration/support/setup.ts'],
          // TZ=UTC como no container de produção (node:lts-alpine). Ver o `it.fails` sobre fuso em
          // tests/integration/stale-games-and-stream.test.ts.
          env: { ...testDatabaseEnv('test'), TZ: 'UTC' },
          // Um banco só para todos os arquivos: um arquivo por vez.
          fileParallelism: false,
          testTimeout: 20_000,
          hookTimeout: 60_000,
        },
      },
    ],
  },
});
