// Conexão com o banco descartável dos testes (`<POSTGRES_DB>_<sufixo>`), vista do host (fora do Docker).
// Sem `import.meta`: também é carregado pelo Playwright, que transpila os testes para CommonJS.
// Os comandos de teste rodam da raiz do projeto, onde fica o `.env`.
import { config } from 'dotenv';

config({ path: '.env', quiet: true });

/** TEST_POSTGRES_HOST/TEST_POSTGRES_PORT sobrescrevem; senão, o Postgres do compose publicado no host. */
export function testDatabaseEnv(suffix) {
  const base = process.env.POSTGRES_DB ?? 'cross_poker';

  return {
    POSTGRES_HOST: process.env.TEST_POSTGRES_HOST ?? 'localhost',
    POSTGRES_PORT: process.env.TEST_POSTGRES_PORT ?? process.env.POSTGRES_HOST_PORT ?? '5433',
    POSTGRES_USER: process.env.POSTGRES_USER ?? 'postgres',
    POSTGRES_PASSWORD: process.env.POSTGRES_PASSWORD ?? 'postgres',
    POSTGRES_DB: `${base}_${suffix}`,
  };
}
