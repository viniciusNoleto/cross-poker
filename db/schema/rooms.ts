import { pgTable, serial, timestamp, varchar } from 'drizzle-orm/pg-core';

export const rooms = pgTable('rooms', {
  id: serial('id').primaryKey(),
  code: varchar('code', { length: 8 }).notNull().unique(),
  status: varchar('status', { length: 20 }).notNull().default('waiting'),
  created_at: timestamp('created_at'),
});
