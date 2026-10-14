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
const appointmentTimes = ["09:00", "10:00", "11:30", "14:00", "15:30"];

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

function isSunday(date: string): boolean {
  return new Date(`${date}T12:00:00Z`).getUTCDay() === 0;
}

function isUniqueViolation(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const value = error as { code?: string; cause?: { code?: string } };
  return value.code === "23505" || value.cause?.code === "23505";
}

router.get("/shop", (_req, res): void => {
  const details = {
    name: process.env.SHOP_NAME ?? "Auto Service & Detailing Hub",
    tagline: "Kujdes i besueshëm për çdo kilometër.",
    phone: process.env.SHOP_PHONE ?? "",
    whatsapp: process.env.SHOP_WHATSAPP ?? "",
    address: process.env.SHOP_ADDRESS ?? "",
    city: process.env.SHOP_CITY ?? "",
    emergencyPhone: process.env.SHOP_EMERGENCY_PHONE ?? "",
    openingHours: process.env.SHOP_OPENING_HOURS ?? "",
    mapUrl: process.env.SHOP_MAP_URL ?? "",
  };
  res.json(GetShopInfoResponse.parse(details));
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

  const today = tiranaToday();
  const days = Array.from({ length: dayCount }, (_, index) => {
    const date = `${parsed.data.month}-${String(index + 1).padStart(2, "0")}`;
    const unavailableDay =
      date < today ||
      isSunday(date) ||
      blocks.some((block) => block.date === date && block.time === null);
    return {
      date,
      open: !unavailableDay,
      slots: unavailableDay
        ? []
        : appointmentTimes.map((time) => ({
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
  if (!appointmentTimes.includes(data.appointmentTime)) {
    res.status(400).json({ error: "Ora e zgjedhur nuk është në dispozicion." });
    return;
  }

  const [service] = await db
    .select({ id: servicesTable.id })
    .from(servicesTable)
    .where(eq(servicesTable.id, data.serviceId));
  if (!service && !data.customService?.trim()) {
    res.status(400).json({ error: "Zgjidhni një shërbim ose përshkruani kërkesën." });
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

  if (blocked || existing || isSunday(date) || date < tiranaToday()) {
    res.status(409).json({ error: "Ky termin nuk është më në dispozicion." });
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
      res.status(409).json({ error: "Ky termin u rezervua nga dikush tjetër. Zgjidhni një orar tjetër." });
      return;
    }
    throw error;
  }

  res.status(201).json(
    CreateAppointmentResponse.parse({
      referenceCode,
      message: "Kërkesa për termin u pranua. Servisi do t’ju kontaktojë për konfirmim.",
    }),
  );
});

router.post("/reviews", async (req, res): Promise<void> => {
  const parsed = CreateReviewBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const values = insertReviewSchema.parse({ ...parsed.data, status: "pending" });
  await db.insert(reviewsTable).values(values);
  res.status(201).json(
    CreateReviewResponse.parse({
      message: "Dëshmia u dërgua dhe do të shfaqet pasi të shqyrtohet nga servisi.",
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
  res.status(201).json(
    CreateContactMessageResponse.parse({
      message: "Mesazhi u pranua. Faleminderit që na kontaktuat.",
    }),
  );
});

router.post("/portfolio", requireAdmin, async (req, res): Promise<void> => {
  const parsed = CreatePortfolioItemBody.safeParse(req.body);
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
