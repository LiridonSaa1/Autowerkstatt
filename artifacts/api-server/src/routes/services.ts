import { Router } from 'express';
import { randomUUID } from 'node:crypto';
import { asc, eq } from 'drizzle-orm';
import { z } from 'zod/v4';
import { db, servicesTable, appointmentsTable } from '@workspace/db';
import { requireAdmin } from '../middlewares/requireAdmin';
const router = Router();
export const serviceInput = z.object({
  name: z.string().trim().min(2).max(120), category: z.string().trim().min(2).max(80),
  description: z.string().trim().min(5).max(2000), priceLabel: z.string().trim().min(1).max(120),
  durationMinutes: z.number().int().min(5).max(1440),
});
const idSchema = z.string().min(1).max(120);
router.use('/admin/services', requireAdmin);
router.get('/admin/services', async (_req, res) => {
  res.json(await db.select().from(servicesTable).orderBy(asc(servicesTable.name)));
});
router.post('/admin/services', async (req, res) => {
  const parsed = serviceInput.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: 'Prüfen Sie Name, Kategorie, Beschreibung, Preis und Dauer (5–1440 Minuten).' }); return; }
  const [entry] = await db.insert(servicesTable).values({ id: randomUUID(), ...parsed.data }).returning();
  res.status(201).json(entry);
});
router.put('/admin/services/:id', async (req, res) => {
  const id = idSchema.safeParse(req.params.id); const parsed = serviceInput.safeParse(req.body);
  if (!id.success || !parsed.success) { res.status(400).json({ error: 'Prüfen Sie die Angaben. Die Dauer muss zwischen 5 und 1440 Minuten liegen.' }); return; }
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
