import { createInsertSchema } from "drizzle-zod";
import { sql } from "drizzle-orm";
import {
  date,
  integer,
  pgTable,
  serial,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { z } from "zod/v4";

export const appointmentsTable = pgTable(
  "appointments",
  {
    id: serial("id").primaryKey(),
    referenceCode: text("reference_code").notNull().unique(),
    serviceId: text("service_id").notNull(),
    customService: text("custom_service"),
    vehicleMake: text("vehicle_make").notNull(),
    vehicleModel: text("vehicle_model").notNull(),
    vehicleYear: integer("vehicle_year").notNull(),
    licensePlate: text("license_plate"),
    vin: text("vin"),
    appointmentDate: date("appointment_date", { mode: "string" }).notNull(),
    appointmentTime: text("appointment_time").notNull(),
    customerName: text("customer_name").notNull(),
    phone: text("phone").notNull(),
    email: text("email").notNull(),
    notes: text("notes"),
    status: text("status").notNull().default("pending"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => ({
    occupiedSlot: uniqueIndex("appointments_active_slot_unique")
      .on(table.appointmentDate, table.appointmentTime)
      .where(sql`${table.status} <> 'cancelled'`),
  }),
);

export const insertAppointmentSchema = createInsertSchema(
  appointmentsTable,
).omit({ id: true, createdAt: true });
export type InsertAppointment = z.infer<typeof insertAppointmentSchema>;
export type Appointment = typeof appointmentsTable.$inferSelect;
