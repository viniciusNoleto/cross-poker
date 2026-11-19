// Banco descartável para os testes de integração (Vitest) e E2E (Playwright).
//
// Recria do zero `<POSTGRES_DB>_<sufixo>` no mesmo Postgres do ambiente de desenvolvimento (o container
// `cross-poker-postgres`, publicado no host em POSTGRES_HOST_PORT) e aplica as migrações do Drizzle.
// Nunca toca no banco de desenvolvimento.
//
//   node tests/support/prepare-database.mjs e2e   → recria `<POSTGRES_DB>_e2e` (CLI)
import { drizzle } from 'drizzle-orm/node-postgres';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';
import { testDatabaseEnv } from './database-env.mjs';

export { testDatabaseEnv };

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

function poolFor(env, database) {
  return new pg.Pool({
    host: env.POSTGRES_HOST,
    port: Number(env.POSTGRES_PORT),
    user: env.POSTGRES_USER,
    password: env.POSTGRES_PASSWORD,
    database,
  });
}

export async function recreateDatabase(suffix) {
  const env = testDatabaseEnv(suffix);

  if (!/^[a-z0-9_]+$/i.test(env.POSTGRES_DB)) throw new Error(`Nome de banco inválido: ${env.POSTGRES_DB}`);

  const admin = poolFor(env, 'postgres');

  try {
    await admin.query(`DROP DATABASE IF EXISTS ${env.POSTGRES_DB} WITH (FORCE)`);
    await admin.query(`CREATE DATABASE ${env.POSTGRES_DB}`);
  } finally {
    await admin.end();
  }

  const pool = poolFor(env, env.POSTGRES_DB);

  try {
    await migrate(drizzle(pool), { migrationsFolder: path.join(ROOT, 'db/migrations') });
  } finally {
    await pool.end();
  }

  return env;
}
