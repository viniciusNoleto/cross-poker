// Aplica as migrações do Drizzle (db/migrations) no banco do container.
// Usado na subida do container de homolog/produção (Dockerfile.deploy) e por `make db-migrate`.
// Não depende do drizzle-kit (devDependency): usa só drizzle-orm + pg, que são dependências de produção.
import { drizzle } from 'drizzle-orm/node-postgres';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import pg from 'pg';

const pool = new pg.Pool({
  host: process.env.POSTGRES_HOST,
  port: Number(process.env.POSTGRES_PORT || 5432),
  user: process.env.POSTGRES_USER,
  password: process.env.POSTGRES_PASSWORD,
  database: process.env.POSTGRES_DB,
});

try {
  await migrate(drizzle(pool), { migrationsFolder: './db/migrations' });
  console.log('Migrações aplicadas.');
} catch (error) {
  console.error('Falha ao aplicar as migrações:', error);
  process.exitCode = 1;
} finally {
  await pool.end();
}
