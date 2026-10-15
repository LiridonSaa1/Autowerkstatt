import { Router } from 'express';
import { eq } from 'drizzle-orm';
import { z } from 'zod/v4';
import { db, siteSettingsTable } from '@workspace/db';
import { requireAdmin } from '../middlewares/requireAdmin';

const text = z.string().trim().max(500);
const optionalUrl = z.union([z.literal(''), z.url().refine((value) => /^https?:\/\//.test(value), 'Verwenden Sie einen HTTP- oder HTTPS-Link.')]);
export const settingsSchema = z.object({
  name: text.min(1), tagline: text, phone: text, whatsapp: text,
  email: z.union([z.literal(''), z.email()]), address: text, city: text,
  emergencyPhone: text, openingHours: text, mapUrl: optionalUrl,
});
export async function readSettings() {
  const [saved] = await db.select().from(siteSettingsTable).where(eq(siteSettingsTable.id, 1));
  const settings = {
    name: process.env.SHOP_NAME ?? 'Auto Service & Detailing Hub',
    tagline: 'Zuverlässiger Service für jeden Kilometer.',
    phone: process.env.SHOP_PHONE ?? '', whatsapp: process.env.SHOP_WHATSAPP ?? '',
    email: process.env.SHOP_EMAIL ?? '', address: process.env.SHOP_ADDRESS ?? '',
    city: process.env.SHOP_CITY ?? '', emergencyPhone: process.env.SHOP_EMERGENCY_PHONE ?? '',
    openingHours: process.env.SHOP_OPENING_HOURS ?? '', mapUrl: process.env.SHOP_MAP_URL ?? '',
    ...saved?.values,
  };
  // Translate the original default when it was saved before the German version.
  if (settings.tagline === 'Kujdes i besueshëm për çdo kilometër.') {
    settings.tagline = 'Zuverlässiger Service für jeden Kilometer.';
  }
  return settings;
}
const router = Router();
router.get('/admin/settings', requireAdmin, async (_req, res) => { res.json(await readSettings()); });
router.put('/admin/settings', requireAdmin, async (req, res) => {
  const result = settingsSchema.safeParse(req.body);
  if (!result.success) { res.status(400).json({ error: 'Prüfen Sie die Formularangaben.', details: result.error.flatten() }); return; }
  await db.insert(siteSettingsTable).values({ id: 1, values: result.data })
    .onConflictDoUpdate({ target: siteSettingsTable.id, set: { values: result.data } });
  res.json(result.data);
});
export default router;
