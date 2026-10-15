import { integer, jsonb, pgTable } from 'drizzle-orm/pg-core';
export const siteSettingsTable = pgTable('site_settings', {
  id: integer('id').primaryKey(),
  values: jsonb('values').$type<Record<string, string>>().notNull(),
});
