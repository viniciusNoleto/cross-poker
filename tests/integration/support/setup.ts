import { afterAll, beforeEach, vi } from 'vitest';
import { sql } from 'drizzle-orm';
import { db } from '@/libs/database';

vi.mock('next/headers', async () => {
  const { currentContext } = await import('./request-context');

  return {
    cookies: async () => {
      const { jar } = currentContext();

      return {
        get: (name: string) => (jar.values.has(name) ? { name, value: jar.values.get(name)! } : undefined),
        set: (name: string, value: string, options: Record<string, unknown> = {}) => {
          jar.values.set(name, value);
          jar.options.set(name, options);
        },
      };
    },
    headers: async () => currentContext().headers,
  };
});

beforeEach(async () => {
  // As rotas registram os erros 500 no console; os testes que provocam esses erros verificam a resposta.
  vi.spyOn(console, 'error').mockImplementation(() => {});
  await db.execute(sql`TRUNCATE game_actions, game_players, games, room_players, rooms RESTART IDENTITY CASCADE`);
});

afterAll(() => {
  vi.restoreAllMocks();
});
