// Shared Postgres client WITHOUT the `server-only` guard, so it can also be loaded from
// `instrumentation.ts` (the inactivity sweeper). Route handlers keep importing `libs/db.ts`.
// The pool lives on `globalThis` so every module graph (instrumentation, route handlers, dev HMR)
// reuses the same connections.
import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import * as schema from '../db/schema';

type Database = ReturnType<typeof drizzle<typeof schema>>;

const globalForDb = globalThis as typeof globalThis & { __crossPokerDb?: Database };

function createDatabase(): Database {
  const pool = new Pool({
    host: process.env.POSTGRES_HOST,
    port: Number(process.env.POSTGRES_PORT),
    user: process.env.POSTGRES_USER,
    password: process.env.POSTGRES_PASSWORD,
    database: process.env.POSTGRES_DB,
  });

  return drizzle(pool, { schema });
}

export const db: Database = globalForDb.__crossPokerDb ?? (globalForDb.__crossPokerDb = createDatabase());
