import { boolean, integer, pgTable, serial, timestamp, uniqueIndex, uuid, varchar } from 'drizzle-orm/pg-core';
import { rooms } from './rooms';

export const roomPlayers = pgTable('room_players', {
  id: serial('id').primaryKey(),
  room_id: integer('room_id').notNull().references(() => rooms.id),
  name: varchar('name', { length: 40 }).notNull(),
  seat: integer('seat').notNull(),
  session_token: uuid('session_token').notNull().unique(),
  is_host: boolean('is_host').notNull().default(false),
  connected_at: timestamp('connected_at'),
  created_at: timestamp('created_at'),
}, (table) => [
  uniqueIndex('room_players_room_id_seat_idx').on(table.room_id, table.seat),
]);

// Never include session_token in an API response — use this selection for every client-facing `db.select`/`.returning()`.
export const roomPlayerPublicColumns = {
  id: roomPlayers.id,
  room_id: roomPlayers.room_id,
  name: roomPlayers.name,
  seat: roomPlayers.seat,
  is_host: roomPlayers.is_host,
  connected_at: roomPlayers.connected_at,
  created_at: roomPlayers.created_at,
};
