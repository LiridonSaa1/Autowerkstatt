import { Router } from 'express';
import { randomUUID } from 'node:crypto';
import { asc, eq } from 'drizzle-orm';
import { z } from 'zod/v4';
import { db, servicesTable, appointmentsTable } from '@workspace/db';
import { requireAdmin } from '../middlewares/requireAdmin';
const router = Router();
export const DEFAULT_SERVICES = [
  {
    name: 'Technical Repairs',
    category: 'Mechanik & Instandsetzung',
    description: 'Fachgerechte Reparatur und Instandsetzung mechanischer Komponenten wie Bremsanlagen, Fahrwerk, Kupplung, Auspuff und Achsen mit geprüften Qualitäts-Ersatzteilen.',
    priceLabel: 'ab 120 €',
    durationMinutes: 90,
    icon: 'technical-repairs',
  },
  {
    name: 'Engine Diagnostics',
    category: 'Diagnose & Motormanagement',
    description: 'Präzise computergestützte Fehlerspeicher-Auslese, Live-Parameter-Prüfung und Lokalisierung elektronischer sowie mechanischer Störungen im Motor- und Abgassystem.',
    priceLabel: 'ab 69 €',
    durationMinutes: 45,
    icon: 'engine-diagnostics',
  },
  {
    name: 'System Service',
    category: 'Wartung & Inspektion',
    description: 'Vollständige Inspektion und Wartung nach Herstellervorgaben mit Erhalt der Garantie. Inklusive Funktionskontrolle aller Sicherheitssysteme und Serviceheft-Eintrag.',
    priceLabel: 'ab 149 €',
    durationMinutes: 60,
    icon: 'system-service',
  },
  {
    name: 'Oil and Filters',
    category: 'Flüssigkeiten & Filter',
    description: 'Professioneller Ölwechsel mit Premium-Markenölen nach Herstellernorm sowie Erneuerung von Öl-, Luft-, Innenraum- und Kraftstofffiltern für optimalen Motorschutz.',
    priceLabel: 'ab 89 €',
    durationMinutes: 40,
    icon: 'oil-filters',
  },
  {
    name: 'Tires and Wheels',
    category: 'Reifen & Fahrwerk',
    description: 'Montage, präzises Auswuchten, Reifendruck- und Profiltiefenprüfung, saisonaler Radwechsel sowie RDKS-Sensor-Kalibrierung für maximale Bodenhaftung und Sicherheit.',
    priceLabel: 'ab 49 €',
    durationMinutes: 30,
    icon: 'tires-wheels',
  },
  {
    name: 'Electrical System',
    category: 'Elektronik & Batterie',
    description: 'Umfassende Prüfung und Instandsetzung von Starterbatterie, Lichtmaschine, Anlasser, Beleuchtung und Bordelektronik zur Vermeidung von Liegenbleibern.',
    priceLabel: 'ab 79 €',
    durationMinutes: 45,
    icon: 'electrical-system',
  },
];

export async function seedDefaultServices(force = false) {
  const existing = await db.select({ id: servicesTable.id }).from(servicesTable).limit(1);
  if (!force && existing.length > 0) return [];
  const entries = DEFAULT_SERVICES.map((s) => ({
    id: randomUUID(),
    ...s,
  }));
  return await db.insert(servicesTable).values(entries).returning();
}

export const serviceInput = z.object({
  name: z.string().trim().min(2).max(120),
  category: z.string().trim().min(2).max(80),
  description: z.string().trim().min(5).max(2000),
  priceLabel: z.string().trim().max(120).optional().nullable(),
  durationMinutes: z.number().int().min(1).max(1440).optional().nullable(),
  icon: z.string().trim().max(80).optional().nullable(),
});
const idSchema = z.string().min(1).max(120);
router.use('/admin/services', requireAdmin);
router.get('/admin/services', async (_req, res) => {
  let list = await db.select().from(servicesTable).orderBy(asc(servicesTable.name));
  if (list.length === 0) {
    await seedDefaultServices();
    list = await db.select().from(servicesTable).orderBy(asc(servicesTable.name));
  }
  res.json(list);
});
router.post('/admin/services/seed-defaults', async (_req, res) => {
  const inserted = await seedDefaultServices(true);
  res.json(inserted);
});
router.post('/admin/services', async (req, res) => {
  const body = {
    ...req.body,
    priceLabel: req.body.priceLabel ? String(req.body.priceLabel).trim() : null,
    durationMinutes: req.body.durationMinutes !== null && req.body.durationMinutes !== undefined && req.body.durationMinutes !== '' && !isNaN(Number(req.body.durationMinutes)) ? Number(req.body.durationMinutes) : null,
  };
  const parsed = serviceInput.safeParse(body);
  if (!parsed.success) { res.status(400).json({ error: 'Prüfen Sie Name, Kategorie und Beschreibung.' }); return; }
  const [entry] = await db.insert(servicesTable).values({ id: randomUUID(), ...parsed.data }).returning();
  res.status(201).json(entry);
});
router.put('/admin/services/:id', async (req, res) => {
  const id = idSchema.safeParse(req.params.id);
  const body = {
    ...req.body,
    priceLabel: req.body.priceLabel ? String(req.body.priceLabel).trim() : null,
    durationMinutes: req.body.durationMinutes !== null && req.body.durationMinutes !== undefined && req.body.durationMinutes !== '' && !isNaN(Number(req.body.durationMinutes)) ? Number(req.body.durationMinutes) : null,
  };
  const parsed = serviceInput.safeParse(body);
  if (!id.success || !parsed.success) { res.status(400).json({ error: 'Prüfen Sie die Angaben.' }); return; }
  const [entry] = await db.update(servicesTable).set(parsed.data).where(eq(servicesTable.id, id.data)).returning();
  if (!entry) { res.status(404).json({ error: 'Die Leistung wurde nicht gefunden.' }); return; }
  res.json(entry);
});
router.delete('/admin/services/:id', async (req, res) => {
  const id = idSchema.safeParse(req.params.id);
  if (!id.success) { res.status(400).json({ error: 'Ungültige Leistung.' }); return; }
  const [appointment] = await db.select({ id: appointmentsTable.id }).from(appointmentsTable).where(eq(appointmentsTable.serviceId, id.data)).limit(1);
  if (appointment) { res.status(409).json({ error: 'Diese Leistung ist mit bestehenden Terminen verknüpft und kann nicht gelöscht werden. Sie können die Leistung bearbeiten.' }); return; }
  const [removed] = await db.delete(servicesTable).where(eq(servicesTable.id, id.data)).returning({ id: servicesTable.id });
  if (!removed) { res.status(404).json({ error: 'Die Leistung wurde nicht gefunden.' }); return; }
  res.sendStatus(204);
});
export default router;
