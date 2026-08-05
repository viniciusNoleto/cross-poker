import { integer, jsonb, pgTable, serial, uniqueIndex } from 'drizzle-orm/pg-core';
import { games } from './games';

export const gamePlayers = pgTable('game_players', {
  id: serial('id').primaryKey(),
  game_id: integer('game_id').notNull().references(() => games.id),
  seat: integer('seat').notNull(),
  hand: jsonb('hand').notNull(),
  melds_remaining: integer('melds_remaining').notNull().default(5),
  discards_remaining: integer('discards_remaining').notNull().default(5),
  score: integer('score').notNull().default(0),
}, (table) => [
  uniqueIndex('game_players_game_id_seat_idx').on(table.game_id, table.seat),
]);
