import { pgTable, serial, text, timestamp } from 'drizzle-orm/pg-core';
export const quotesTable = pgTable('quote_requests', {
  id: serial('id').primaryKey(),
  name: text('name').notNull(), email: text('email').notNull(), phone: text('phone').notNull(),
  vehicle: text('vehicle').notNull(), parts: text('parts').notNull(), preferredDate: text('preferred_date').notNull().default(''),
  status: text('status').notNull().default('new'),
  sentAt: timestamp('sent_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});
