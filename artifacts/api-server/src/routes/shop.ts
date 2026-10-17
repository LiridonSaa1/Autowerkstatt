import { z } from 'zod';
import { readSettings } from './settings';
import { mapEmbedUrl } from '../lib/map-embed';
import { readBookingSchedule } from './booking-schedule';
import { scheduleSlots, scheduleClosureReason } from '../lib/booking-schedule';
import { notifyBusiness } from '../lib/business-notifications';
import { sendEmail } from '../lib/send-email';
import { logger } from '../lib/logger';
import {
  renderCustomerAppointmentEmail,
  renderCustomerContactAcknowledgmentEmail,
} from '../lib/email-templates';
import { and, asc, count, desc, eq, gte, lt, ne, sql } from "drizzle-orm";
import { Router, type IRouter } from "express";
import {
  CreateAppointmentBody,
  CreateAppointmentResponse,
  CreateContactMessageBody,
  CreateContactMessageResponse,
  CreatePortfolioItemBody,
  CreatePortfolioItemResponse,
  CreateReviewBody,
  CreateReviewResponse,
  DeletePortfolioItemParams,
  GetAvailabilityQueryParams,
  GetAvailabilityResponse,
  GetShopInfoResponse,
  ListApprovedReviewsResponse,
  ListPortfolioResponse,
  ListServicesResponse,
} from "@workspace/api-zod";
import {
  appointmentsTable,
  blockedSlotsTable,
  contactMessagesTable,
  db,
  insertAppointmentSchema,
  insertContactMessageSchema,
  insertPortfolioSchema,
  insertReviewSchema,
  portfolioTable,
  reviewsTable,
  servicesTable,
} from "@workspace/db";
import { requireAdmin } from "../middlewares/requireAdmin";

const router: IRouter = Router();

function calendarDate(value: Date | string): string {
  return value instanceof Date ? value.toISOString().slice(0, 10) : value;
}

function isUniqueViolation(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const value = error as { code?: string; cause?: { code?: string } };
  return value.code === "23505" || value.cause?.code === "23505";
}

router.get("/shop", async (_req, res): Promise<void> => {
  const [settings, schedule] = await Promise.all([readSettings(), readBookingSchedule()]);
  res.json({ ...settings, weeklyHours: schedule.weekly, mapEmbedUrl: await mapEmbedUrl(settings.mapUrl) });
});

router.get("/services", async (_req, res): Promise<void> => {
  const services = await db
    .select()
    .from(servicesTable)
    .orderBy(asc(servicesTable.name));
  res.json(ListServicesResponse.parse(services));
});

router.get("/portfolio", async (_req, res): Promise<void> => {
  const entries = await db
    .select()
    .from(portfolioTable)
    .orderBy(desc(portfolioTable.createdAt));
  res.json(ListPortfolioResponse.parse(entries));
});

router.get("/reviews", async (_req, res): Promise<void> => {
  const reviews = await db
    .select()
    .from(reviewsTable)
    .where(eq(reviewsTable.status, "approved"))
    .orderBy(desc(reviewsTable.createdAt));
  res.json(ListApprovedReviewsResponse.parse(reviews));
});

router.get("/availability", async (req, res): Promise<void> => {
  const parsed = GetAvailabilityQueryParams.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [year, month] = parsed.data.month.split("-").map(Number);
  const firstDate = `${parsed.data.month}-01`;
  const nextMonth = new Date(Date.UTC(year, month, 1))
    .toISOString()
    .slice(0, 10);
  const dayCount = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const [appointments, blocks] = await Promise.all([
    db
      .select({
        date: appointmentsTable.appointmentDate,
        time: appointmentsTable.appointmentTime,
      })
      .from(appointmentsTable)
      .where(
        and(
          gte(appointmentsTable.appointmentDate, firstDate),
          lt(appointmentsTable.appointmentDate, nextMonth),
          ne(appointmentsTable.status, "cancelled"),
        ),
      ),
    db
      .select({
        date: blockedSlotsTable.date,
        time: blockedSlotsTable.time,
      })
      .from(blockedSlotsTable)
      .where(
        and(
          gte(blockedSlotsTable.date, firstDate),
          lt(blockedSlotsTable.date, nextMonth),
        ),
      ),
  ]);

  const schedule = await readBookingSchedule();
  const days = Array.from({ length: dayCount }, (_, index) => {
    const date = `${parsed.data.month}-${String(index + 1).padStart(2, "0")}`;
    const times = scheduleSlots(schedule, date);
    const unavailableDay =
      times.length === 0 ||
      blocks.some((block) => block.date === date && block.time === null);
    return {
      date,
      reason: scheduleClosureReason(schedule, date) || (blocks.some((block) => block.date === date && block.time === null) ? 'Geschlossen' : null) || (times.length > 0 && times.every((time) => appointments.some((appointment) => appointment.date === date && appointment.time === time) || blocks.some((block) => block.date === date && block.time === time)) ? 'Ausgebucht' : null),
      open: !unavailableDay,
      slots: unavailableDay
        ? []
        : times.map((time) => ({
            time,
            available:
              !appointments.some(
                (appointment) =>
                  appointment.date === date && appointment.time === time,
              ) &&
              !blocks.some(
                (block) =>
                  block.date === date &&
                  (block.time === null || block.time === time),
              ),
          })),
    };
  });

  res.json(GetAvailabilityResponse.parse(days));
});

router.post("/appointments", async (req, res): Promise<void> => {
  const parsed = CreateAppointmentBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const data = parsed.data;
  const date = calendarDate(data.appointmentDate);
  const schedule = await readBookingSchedule();
  if (!scheduleSlots(schedule, date).includes(data.appointmentTime)) {
    res.status(400).json({ error: "Die gewählte Uhrzeit ist nicht verfügbar." });
    return;
  }

  const [service] = await db
    .select({ id: servicesTable.id, name: servicesTable.name })
    .from(servicesTable)
    .where(eq(servicesTable.id, data.serviceId));
  if (!service && !data.customService?.trim()) {
    res.status(400).json({ error: "Wählen Sie eine Leistung oder beschreiben Sie Ihr Anliegen." });
    return;
  }

  const [blocked] = await db
    .select({ id: blockedSlotsTable.id })
    .from(blockedSlotsTable)
    .where(
      and(
        eq(blockedSlotsTable.date, date),
        sql`(${blockedSlotsTable.time} IS NULL OR ${blockedSlotsTable.time} = ${data.appointmentTime})`,
      ),
    )
    .limit(1);
  const [existing] = await db
    .select({ id: appointmentsTable.id })
    .from(appointmentsTable)
    .where(
      and(
        eq(appointmentsTable.appointmentDate, date),
        eq(appointmentsTable.appointmentTime, data.appointmentTime),
        ne(appointmentsTable.status, "cancelled"),
      ),
    )
    .limit(1);

  if (blocked || existing || !scheduleSlots(await readBookingSchedule(), date).includes(data.appointmentTime)) {
    res.status(409).json({ error: "Dieser Termin ist nicht mehr verfügbar." });
    return;
  }

  const referenceCode = `AS-${date.replaceAll("-", "")}-${Math.random()
    .toString(36)
    .slice(2, 7)
    .toUpperCase()}`;
  const values = insertAppointmentSchema.parse({
    referenceCode,
    serviceId: data.serviceId,
    customService: data.customService ?? null,
    vehicleMake: data.vehicleMake,
    vehicleModel: data.vehicleModel,
    vehicleYear: data.vehicleYear,
    licensePlate: data.licensePlate ?? null,
    vin: data.vin ?? null,
    appointmentDate: date,
    appointmentTime: data.appointmentTime,
    customerName: data.customerName,
    phone: data.phone,
    email: data.email,
    notes: data.notes ?? null,
    status: "pending",
  });

  try {
    await db.insert(appointmentsTable).values(values);
  } catch (error) {
    if (isUniqueViolation(error)) {
      res.status(409).json({ error: "Dieser Termin wurde inzwischen gebucht. Wählen Sie eine andere Uhrzeit." });
      return;
    }
    throw error;
  }

  const serviceName = data.customService || service?.name || 'Andere Leistung';
  const vehicleText = `${data.vehicleMake} ${data.vehicleModel}, ${data.vehicleYear}`;

  await notifyBusiness({
    kind: 'appointment', customer: { name: data.customerName, email: data.email }, phone: data.phone,
    referenceCode, date, time: data.appointmentTime, service: serviceName,
    vehicle: vehicleText, licensePlate: data.licensePlate, vin: data.vin, notes: data.notes,
  });

  // Send branded confirmation email to customer (best-effort, non-blocking)
  (async () => {
    try {
      const shop = await readSettings();
      const customerHtml = renderCustomerAppointmentEmail({
        customerName: data.customerName,
        email: data.email,
        phone: data.phone,
        referenceCode,
        date,
        time: data.appointmentTime,
        service: serviceName,
        vehicle: vehicleText,
        licensePlate: data.licensePlate,
        vin: data.vin,
        notes: data.notes,
        business: shop,
        isConfirmed: false,
      });

      await sendEmail({
        name: data.customerName,
        email: data.email,
        subject: `Ihre Terminanfrage ${referenceCode} · ${shop.name}`,
        message: `Hallo ${data.customerName},\n\nvielen Dank für Ihre Terminanfrage (${referenceCode}) am ${date} um ${data.appointmentTime} Uhr für ${serviceName}.\n\nFahrzeug: ${vehicleText}\n\nUnser Team prüft die Verfügbarkeit und meldet sich schnellstmöglich bei Ihnen.\n\n${shop.name}\n${shop.phone || ''}`,
        html: customerHtml,
        senderName: shop.name,
        fallbackEmail: shop.email,
        replyTo: shop.email ? { name: shop.name, email: shop.email } : undefined,
      });
    } catch (mailErr) {
      logger.error({ err: mailErr, referenceCode }, 'Could not dispatch customer appointment confirmation email');
    }
  })();

  res.status(201).json(
    CreateAppointmentResponse.parse({
      referenceCode,
      message: "Ihre Terminanfrage wurde angenommen. Die Werkstatt meldet sich zur Bestätigung.",
    }),
  );
});

router.post("/reviews", async (req, res): Promise<void> => {
  const parsed = CreateReviewBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  if (parsed.data.comment.length > 150) {
    res.status(400).json({ error: 'Ihre Erfahrung darf maximal 150 Zeichen enthalten.' });
    return;
  }
  const values = insertReviewSchema.parse({ ...parsed.data, status: "pending" });
  await db.insert(reviewsTable).values(values);
  res.status(201).json(
    CreateReviewResponse.parse({
      message: "Ihre Bewertung wurde eingereicht und erscheint nach Prüfung durch die Werkstatt.",
    }),
  );
});

router.post("/contact", async (req, res): Promise<void> => {
  const parsed = CreateContactMessageBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const values = insertContactMessageSchema.parse(parsed.data);
  await db.insert(contactMessagesTable).values(values);
  await notifyBusiness({ kind: 'contact', customer: { name: parsed.data.name, email: parsed.data.email }, subject: parsed.data.subject, message: parsed.data.message });

  // Send branded acknowledgment email to customer (best-effort, non-blocking)
  (async () => {
    try {
      const shop = await readSettings();
      const customerHtml = renderCustomerContactAcknowledgmentEmail({
        customerName: parsed.data.name,
        subject: parsed.data.subject,
        message: parsed.data.message,
        business: shop,
      });

      await sendEmail({
        name: parsed.data.name,
        email: parsed.data.email,
        subject: `Ihre Nachricht an ${shop.name} erhalten: ${parsed.data.subject}`,
        message: `Hallo ${parsed.data.name},\n\nvielen Dank für Ihre Kontaktaufnahme. Wir haben Ihre Nachricht erhalten und kümmern uns schnellstmöglich um Ihr Anliegen.\n\n${shop.name}\n${shop.phone || ''}`,
        html: customerHtml,
        senderName: shop.name,
        fallbackEmail: shop.email,
        replyTo: shop.email ? { name: shop.name, email: shop.email } : undefined,
      });
    } catch (mailErr) {
      logger.error({ err: mailErr }, 'Could not dispatch customer contact acknowledgment email');
    }
  })();

  res.status(201).json(
    CreateContactMessageResponse.parse({
      message: "Ihre Nachricht wurde empfangen. Vielen Dank für Ihre Kontaktaufnahme.",
    }),
  );
});

router.post("/portfolio", requireAdmin, async (req, res): Promise<void> => {
  const parsed = CreatePortfolioItemBody.extend({
    imageUrl: z.string().refine(value => /^\/api\/portfolio-images\/[a-f0-9-]+\.(jpg|png|webp)$/.test(value) || /^https?:\/\//.test(value) && z.string().url().safeParse(value).success, 'Bitte laden Sie ein Bild hoch oder verwenden Sie eine gültige Bild-URL.'),
  }).safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const values = insertPortfolioSchema.parse({
    ...parsed.data,
    completedAt: null,
  });
  const [entry] = await db
    .insert(portfolioTable)
    .values(values)
    .returning();
  res.status(201).json(CreatePortfolioItemResponse.parse(entry));
});

router.delete(
  "/portfolio/:id",
  requireAdmin,
  async (req, res): Promise<void> => {
    const parsed = DeletePortfolioItemParams.safeParse(req.params);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.message });
      return;
    }
    const [removed] = await db
      .delete(portfolioTable)
      .where(eq(portfolioTable.id, parsed.data.id))
      .returning({ id: portfolioTable.id });
    if (!removed) {
      res.status(404).json({ error: "Puna nuk u gjet." });
      return;
    }
    res.sendStatus(204);
  },
);

export default router;
