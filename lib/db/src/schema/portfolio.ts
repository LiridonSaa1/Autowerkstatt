import { createInsertSchema } from "drizzle-zod";
import { date, pgTable, serial, text, timestamp } from "drizzle-orm/pg-core";
import { z } from "zod/v4";

export const portfolioTable = pgTable("portfolio", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  category: text("category").notNull(),
  description: text("description").notNull(),
  imageUrl: text("image_url").notNull(),
  vehicleLabel: text("vehicle_label").notNull(),
  completedAt: date("completed_at", { mode: "string" }),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const insertPortfolioSchema = createInsertSchema(portfolioTable).omit({
  id: true,
  createdAt: true,
});
export type InsertPortfolio = z.infer<typeof insertPortfolioSchema>;
export type PortfolioItem = typeof portfolioTable.$inferSelect;
