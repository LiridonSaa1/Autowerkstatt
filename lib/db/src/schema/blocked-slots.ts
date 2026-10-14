import { createInsertSchema } from "drizzle-zod";
import { date, pgTable, serial, text, timestamp } from "drizzle-orm/pg-core";
import { z } from "zod/v4";

export const blockedSlotsTable = pgTable("blocked_slots", {
  id: serial("id").primaryKey(),
  date: date("date", { mode: "string" }).notNull(),
  time: text("time"),
  reason: text("reason").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const insertBlockedSlotSchema = createInsertSchema(
  blockedSlotsTable,
).omit({ id: true, createdAt: true });
export type InsertBlockedSlot = z.infer<typeof insertBlockedSlotSchema>;
export type BlockedSlot = typeof blockedSlotsTable.$inferSelect;
