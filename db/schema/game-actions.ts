import { integer, jsonb, pgTable, serial, timestamp, varchar } from 'drizzle-orm/pg-core';
import { games } from './games';

export const gameActions = pgTable('game_actions', {
  id: serial('id').primaryKey(),
  game_id: integer('game_id').notNull().references(() => games.id),
  seat: integer('seat').notNull(),
  type: varchar('type', { length: 20 }).notNull(),
  payload: jsonb('payload').notNull(),
  created_at: timestamp('created_at'),
});
