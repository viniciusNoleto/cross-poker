import { integer, jsonb, pgTable, serial, timestamp, varchar } from 'drizzle-orm/pg-core';
import { rooms } from './rooms';

export const games = pgTable('games', {
  id: serial('id').primaryKey(),
  room_id: integer('room_id').notNull().references(() => rooms.id),
  status: varchar('status', { length: 20 }).notNull().default('playing'),
  current_seat: integer('current_seat').notNull(),
  // Monte: card ids, order = bottom→top (top = last element).
  deck: jsonb('deck').notNull(),
  // Descarte: card ids discarded face down, order = bottom→top. Drawable (LIFO).
  discard: jsonb('discard').notNull(),
  // Bolo: card ids of every Jogada (Meld), face up, order = bottom→top. Never drawable — it only
  // goes back into play when the Monte runs out (see game-concept.md, "Esgotamento do Monte").
  meld_pile: jsonb('meld_pile').notNull().default([]),
  // null when there is no Swap in progress. See .claude/rules/game-concept.md ("Troca").
  pending_swap: jsonb('pending_swap'),
  winning_team: varchar('winning_team', { length: 1 }),
  // Why the game finished (`EFinishReason`) — null while it's still being played.
  finish_reason: varchar('finish_reason', { length: 20 }),
  // Last time any player acted (Jogada, Descarte or Troca). Used by the inactivity sweeper.
  last_action_at: timestamp('last_action_at'),
  created_at: timestamp('created_at'),
  finished_at: timestamp('finished_at'),
});
