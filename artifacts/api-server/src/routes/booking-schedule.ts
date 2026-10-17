import { Router } from 'express';
import { eq } from 'drizzle-orm';
import { db, siteSettingsTable } from '@workspace/db';
import { requireAdmin } from '../middlewares/requireAdmin';
import { bookingScheduleSchema, defaultBookingSchedule } from '../lib/booking-schedule';

export async function readBookingSchedule() {
  const [saved] = await db.select().from(siteSettingsTable).where(eq(siteSettingsTable.id, 2));
  if (!saved?.values.schedule) return defaultBookingSchedule;
  return bookingScheduleSchema.parse(JSON.parse(saved.values.schedule));
}

const router = Router();
router.get('/admin/booking-schedule', requireAdmin, async (_req, res) => {
  res.json(await readBookingSchedule());
});
router.put('/admin/booking-schedule', requireAdmin, async (req, res) => {
  const parsed = bookingScheduleSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Prüfen Sie Arbeitszeiten, Pausen und Datumsbereiche.', details: parsed.error.flatten() });
    return;
  }
  const values = { schedule: JSON.stringify(parsed.data) };
  await db.insert(siteSettingsTable).values({ id: 2, values })
    .onConflictDoUpdate({ target: siteSettingsTable.id, set: { values } });
  res.json(parsed.data);
});
export default router;
