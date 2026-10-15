import { integer, pgTable, text, timestamp } from 'drizzle-orm/pg-core';

export const apiIntegrationsTable = pgTable('api_integrations', {
  id: integer('id').primaryKey(),
  encryptedConfig: text('encrypted_config').notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});
