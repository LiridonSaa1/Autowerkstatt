import { and, asc, count, desc, eq, gte, ne } from "drizzle-orm";
import { Router, type IRouter } from "express";
import {
  CreateBlockedSlotBody,
  CreateBlockedSlotResponse,
  DeleteBlockedSlotParams,
  GetAdminSummaryResponse,
  ListAdminContactMessagesResponse,
  ListAdminAppointmentsQueryParams,
  ListAdminAppointmentsResponse,
  ListAdminReviewsQueryParams,
  ListAdminReviewsResponse,
  ListBlockedSlotsResponse,
  ModerateReviewBody,
  ModerateReviewParams,
  ModerateReviewResponse,
  UpdateAppointmentBody,
  UpdateAppointmentParams,
  UpdateAppointmentResponse,
} from "@workspace/api-zod";
import {
  appointmentsTable,
  blockedSlotsTable,
  contactMessagesTable,
  db,
  reviewsTable,
  servicesTable,
} from "@workspace/db";
import { requireAdmin } from "../middlewares/requireAdmin";
import { readSettings } from "./settings";
import { sendEmail } from "../lib/send-email";
import { renderCustomerAppointmentEmail } from "../lib/email-templates";
import { logger } from "../lib/logger";

const router: IRouter = Router();

function calendarDate(value: Date | string): string {
  return value instanceof Date ? value.toISOString().slice(0, 10) : value;
}

function tiranaToday(): string {
  const parts = new Intl.DateTimeFormat("en", {
    timeZone: "Europe/Tirane",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const value = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${value.year}-${value.month}-${value.day}`;
}

function isUniqueViolation(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const value = error as { code?: string; cause?: { code?: string } };
  return value.code === "23505" || value.cause?.code === "23505";
}

router.get("/admin/summary", requireAdmin, async (_req, res): Promise<void> => {
  const today = tiranaToday();
  const [pendingAppointments, totalAppointments, upcomingAppointments, pendingReviews, blockedSlots] =
    await Promise.all([
      db
        .select({ value: count() })
        .from(appointmentsTable)
        .where(eq(appointmentsTable.status, "pending")),
      db.select({ value: count() }).from(appointmentsTable),
      db
        .select({ value: count() })
        .from(appointmentsTable)
        .where(
          and(
            gte(appointmentsTable.appointmentDate, today),
            ne(appointmentsTable.status, "cancelled"),
          ),
        ),
      db
        .select({ value: count() })
        .from(reviewsTable)
        .where(eq(reviewsTable.status, "pending")),
      db.select({ value: count() }).from(blockedSlotsTable),
    ]);
  res.json(
    GetAdminSummaryResponse.parse({
      pendingAppointments: pendingAppointments[0]?.value ?? 0,
      totalAppointments: totalAppointments[0]?.value ?? 0,
      upcomingAppointments: upcomingAppointments[0]?.value ?? 0,
      pendingReviews: pendingReviews[0]?.value ?? 0,
      blockedSlots: blockedSlots[0]?.value ?? 0,
    }),
  );
});

router.get(
  "/admin/contact-messages",
  requireAdmin,
  async (_req, res): Promise<void> => {
    const messages = await db
      .select()
      .from(contactMessagesTable)
      .orderBy(desc(contactMessagesTable.createdAt));
    res.json(ListAdminContactMessagesResponse.parse(messages));
  },
);

router.get(
  "/admin/appointments",
  requireAdmin,
  async (req, res): Promise<void> => {
    const parsed = ListAdminAppointmentsQueryParams.safeParse(req.query);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.message });
      return;
    }
    const rows = parsed.data.status
      ? await db
          .select({
            appointment: appointmentsTable,
            serviceName: servicesTable.name,
          })
          .from(appointmentsTable)
          .leftJoin(
            servicesTable,
            eq(appointmentsTable.serviceId, servicesTable.id),
          )
          .where(eq(appointmentsTable.status, parsed.data.status))
          .orderBy(asc(appointmentsTable.appointmentDate), asc(appointmentsTable.appointmentTime))
      : await db
          .select({
            appointment: appointmentsTable,
            serviceName: servicesTable.name,
          })
          .from(appointmentsTable)
          .leftJoin(
            servicesTable,
            eq(appointmentsTable.serviceId, servicesTable.id),
          )
          .orderBy(asc(appointmentsTable.appointmentDate), asc(appointmentsTable.appointmentTime));
    const appointments = rows.map(({ appointment, serviceName }) => ({
      ...appointment,
      serviceName: appointment.customService ?? serviceName ?? "Andere Leistung",
    }));
    res.json(ListAdminAppointmentsResponse.parse(appointments));
  },
);

router.patch(
  "/admin/appointments/:id",
  requireAdmin,
  async (req, res): Promise<void> => {
    const params = UpdateAppointmentParams.safeParse(req.params);
    const body = UpdateAppointmentBody.safeParse(req.body);
    if (!params.success) {
      res.status(400).json({ error: params.error.message });
      return;
    }
    if (!body.success) {
      res.status(400).json({ error: body.error.message });
      return;
    }
    if (Object.keys(body.data).length === 0) {
      res.status(400).json({ error: "Wählen Sie mindestens eine Änderung aus." });
      return;
    }

    const update = {
      ...(body.data.status !== undefined ? { status: body.data.status } : {}),
      ...(body.data.appointmentDate !== undefined
        ? { appointmentDate: calendarDate(body.data.appointmentDate) }
        : {}),
      ...(body.data.appointmentTime !== undefined
        ? { appointmentTime: body.data.appointmentTime }
        : {}),
    };
    try {
      const [updated] = await db
        .update(appointmentsTable)
        .set(update)
        .where(eq(appointmentsTable.id, params.data.id))
        .returning();
      if (!updated) {
        res.status(404).json({ error: "Termin nuk u gjet." });
        return;
      }
      const [joined] = await db
        .select({
          appointment: appointmentsTable,
          serviceName: servicesTable.name,
        })
        .from(appointmentsTable)
        .leftJoin(
          servicesTable,
          eq(appointmentsTable.serviceId, servicesTable.id),
        )
        .where(eq(appointmentsTable.id, updated.id));
      if (!joined) {
        res.status(404).json({ error: "Termin nuk u gjet." });
        return;
      }

      if (body.data.status === "approved") {
        (async () => {
          try {
            const shop = await readSettings();
            const serviceName =
              joined.serviceName ??
              joined.appointment.customService ??
              "Werkstattservice";
            const vehicleText = `${joined.appointment.vehicleMake} ${joined.appointment.vehicleModel}, ${joined.appointment.vehicleYear}`;
            const customerHtml = renderCustomerAppointmentEmail({
              customerName: joined.appointment.customerName,
              email: joined.appointment.email,
              phone: joined.appointment.phone,
              referenceCode: joined.appointment.referenceCode,
              date: joined.appointment.appointmentDate,
              time: joined.appointment.appointmentTime,
              service: serviceName,
              vehicle: vehicleText,
              licensePlate: joined.appointment.licensePlate,
              vin: joined.appointment.vin,
              notes: joined.appointment.notes,
              business: shop,
              isConfirmed: true,
            });

            await sendEmail({
              name: joined.appointment.customerName,
              email: joined.appointment.email,
              subject: `Ihr Termin ist bestätigt! · ${joined.appointment.referenceCode} · ${shop.name}`,
              message: `Hallo ${joined.appointment.customerName},\n\nIhr Termin (${joined.appointment.referenceCode}) am ${joined.appointment.appointmentDate} um ${joined.appointment.appointmentTime} Uhr wurde verbindlich bestätigt.\n\nFahrzeug: ${vehicleText}\nLeistung: ${serviceName}\n\nWir freuen uns auf Ihren Besuch!\n\n${shop.name}\n${shop.phone || ""}`,
              html: customerHtml,
              senderName: shop.name,
              fallbackEmail: shop.email,
              replyTo: shop.email ? { name: shop.name, email: shop.email } : undefined,
            });
          } catch (mailErr) {
            logger.error({ err: mailErr, id: joined.appointment.id }, "Could not send appointment confirmation update email");
          }
        })();
      }

      res.json(
        UpdateAppointmentResponse.parse({
          ...joined.appointment,
          serviceName:
            joined.serviceName ??
            joined.appointment.customService ??
            "Andere Leistung",
        }),
      );
    } catch (error) {
      if (isUniqueViolation(error)) {
        res.status(409).json({ error: "Diese Uhrzeit ist bereits belegt." });
        return;
      }
      throw error;
    }
  },
);

router.get(
  "/admin/reviews",
  requireAdmin,
  async (req, res): Promise<void> => {
    const parsed = ListAdminReviewsQueryParams.safeParse(req.query);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.message });
      return;
    }
    const status = parsed.data.status;
    const reviews = await db
      .select()
      .from(reviewsTable)
      .where(status ? eq(reviewsTable.status, status) : undefined)
      .orderBy(desc(reviewsTable.createdAt));
    res.json(ListAdminReviewsResponse.parse(reviews));
  },
);

router.patch(
  "/admin/reviews/:id",
  requireAdmin,
  async (req, res): Promise<void> => {
    const params = ModerateReviewParams.safeParse(req.params);
    const body = ModerateReviewBody.safeParse(req.body);
    if (!params.success) {
      res.status(400).json({ error: params.error.message });
      return;
    }
    if (!body.success) {
      res.status(400).json({ error: body.error.message });
      return;
    }
    const [review] = await db
      .update(reviewsTable)
      .set({ status: body.data.status })
      .where(eq(reviewsTable.id, params.data.id))
      .returning();
    if (!review) {
      res.status(404).json({ error: "Die Bewertung wurde nicht gefunden." });
      return;
    }
    res.json(ModerateReviewResponse.parse(review));
  },
);

router.delete('/admin/reviews/:id', requireAdmin, async (req, res): Promise<void> => {
  const params = ModerateReviewParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: 'Ungültige Bewertung.' });
    return;
  }
  const [deleted] = await db.delete(reviewsTable)
    .where(eq(reviewsTable.id, params.data.id))
    .returning({ id: reviewsTable.id });
  if (!deleted) {
    res.status(404).json({ error: 'Die Bewertung wurde nicht gefunden.' });
    return;
  }
  res.sendStatus(204);
});

router.get(
  "/admin/blocked-slots",
  requireAdmin,
  async (_req, res): Promise<void> => {
    const blocks = await db
      .select()
      .from(blockedSlotsTable)
      .orderBy(asc(blockedSlotsTable.date), asc(blockedSlotsTable.time));
    res.json(ListBlockedSlotsResponse.parse(blocks));
  },
);

router.post(
  "/admin/blocked-slots",
  requireAdmin,
  async (req, res): Promise<void> => {
    const parsed = CreateBlockedSlotBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.message });
      return;
    }
    const [block] = await db
      .insert(blockedSlotsTable)
      .values({
        date: calendarDate(parsed.data.date),
        time: parsed.data.time ?? null,
        reason: parsed.data.reason,
      })
      .returning();
    res.status(201).json(CreateBlockedSlotResponse.parse(block));
  },
);

router.delete(
  "/admin/blocked-slots/:id",
  requireAdmin,
  async (req, res): Promise<void> => {
    const parsed = DeleteBlockedSlotParams.safeParse(req.params);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.message });
      return;
    }
    const [removed] = await db
      .delete(blockedSlotsTable)
      .where(eq(blockedSlotsTable.id, parsed.data.id))
      .returning({ id: blockedSlotsTable.id });
    if (!removed) {
      res.status(404).json({ error: "Bllokimi nuk u gjet." });
      return;
    }
    res.sendStatus(204);
  },
);

export default router;
