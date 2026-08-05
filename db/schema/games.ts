import { integer, jsonb, pgTable, serial, timestamp, varchar } from 'drizzle-orm/pg-core';
import { rooms } from './rooms';

export const games = pgTable('games', {
  id: serial('id').primaryKey(),
  room_id: integer('room_id').notNull().references(() => rooms.id),
  status: varchar('status', { length: 20 }).notNull().default('playing'),
  current_seat: integer('current_seat').notNull(),
  deck: jsonb('deck').notNull(),
  discard: jsonb('discard').notNull(),
  // null when there is no Swap in progress. See .claude/rules/game-concept.md ("Troca").
  pending_swap: jsonb('pending_swap'),
  // null when there is no Meld/Discard awaiting a draw-source choice. See
  // .claude/rules/game-concept.md ("Compra após a ação").
  pending_draw: jsonb('pending_draw'),
  winning_team: varchar('winning_team', { length: 1 }),
  created_at: timestamp('created_at'),
  finished_at: timestamp('finished_at'),
});
