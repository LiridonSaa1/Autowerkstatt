import { Router } from 'express';
import { and, eq } from 'drizzle-orm';
import { db, reviewsTable } from '@workspace/db';
import { resolveVehicle } from '../lib/vehicle-identity';
const router = Router();
router.get('/reviews/:id/vehicle', async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isSafeInteger(id) || id < 1) { res.status(400).json({ error: 'Ungültige Bewertung.' }); return; }
  const [review] = await db.select({ carModel: reviewsTable.carModel }).from(reviewsTable).where(and(eq(reviewsTable.id, id), eq(reviewsTable.status, 'approved')));
  if (!review) { res.status(404).json({ error: 'Die Bewertung wurde nicht gefunden.' }); return; }
  const visual = await resolveVehicle(review.carModel);
  res.set('Cache-Control', 'private, max-age=60'); res.json(visual);
});
export default router;
