import { resendConfig } from '../lib/integrations';
import { sendEmail } from '../lib/send-email';
import { Router } from 'express';
import { desc, eq } from 'drizzle-orm';
import { z } from 'zod/v4';
import { db, quotesTable } from '@workspace/db';
import { requireAdmin } from '../middlewares/requireAdmin';
import { readSettings } from './settings';
const router = Router();
const input = z.object({
  name: z.string().trim().min(2).max(120), email: z.email().max(254), phone: z.string().trim().min(5).max(40),
  vehicle: z.string().trim().min(2).max(240), parts: z.string().trim().min(5).max(3000),
  preferredDate: z.string().regex(/^(|\d{4}-\d{2}-\d{2})$/).default(''),
});
const status = z.enum(['new', 'contacted', 'quoted', 'accepted', 'rejected']);
router.post('/quotes', async (req, res) => {
  const parsed = input.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: 'Prüfen Sie die Angaben Ihrer Anfrage.' }); return; }
  const [row] = await db.insert(quotesTable).values(parsed.data).returning({ id: quotesTable.id });
  res.status(201).json(row);
});
router.get('/admin/quotes', requireAdmin, async (_req, res) => {
  res.json(await db.select().from(quotesTable).orderBy(desc(quotesTable.createdAt)));
});
router.get('/admin/quotes/sender', requireAdmin, async (_req, res) => {
  const shop = await readSettings();
  const resend = await resendConfig();
  res.json({ name: shop.name, email: resend.key ? resend.from : process.env.BREVO_SENDER_EMAIL || shop.email, configured: Boolean(resend.key ? resend.from : process.env.BREVO_API_KEY && (process.env.BREVO_SENDER_EMAIL || shop.email)) });
});
router.patch('/admin/quotes/:id', requireAdmin, async (req, res) => {
  const id = z.coerce.number().int().positive().safeParse(req.params.id);
  const parsed = z.object({ status }).safeParse(req.body);
  if (!id.success || !parsed.success) { res.status(400).json({ error: 'Ungültiger Status.' }); return; }
  const [row] = await db.update(quotesTable).set(parsed.data).where(eq(quotesTable.id, id.data)).returning();
  if (!row) { res.status(404).json({ error: 'Die Anfrage wurde nicht gefunden.' }); return; }
  res.json(row);
});
const sending = new Set<number>();
router.post('/admin/quotes/:id/send', requireAdmin, async (req, res) => {
  const id = z.coerce.number().int().positive().safeParse(req.params.id);
  const parsed = z.object({ email: z.email().max(254), subject: z.string().trim().min(2).max(200).refine(v => !/[\r\n]/.test(v)), message: z.string().trim().min(10).max(12000) }).safeParse(req.body);
  if (!id.success || !parsed.success) { res.status(400).json({ error: 'Prüfen Sie E-Mail-Adresse, Betreff und Nachricht.' }); return; }
  if (sending.has(id.data)) { res.status(409).json({ error: 'Das Angebot wird bereits gesendet.' }); return; }
  const [quote] = await db.select().from(quotesTable).where(eq(quotesTable.id, id.data));
  if (!quote) { res.status(404).json({ error: 'Die Anfrage wurde nicht gefunden.' }); return; }
  const shop = await readSettings();
  sending.add(id.data);
  try {
    await sendEmail({ name: quote.name, email: parsed.data.email, subject: parsed.data.subject, message: parsed.data.message, senderName: shop.name, fallbackEmail: shop.email });
    await db.update(quotesTable).set({ status: 'quoted', sentAt: new Date() }).where(eq(quotesTable.id, id.data));
    res.json({ sent: true });
  } catch { res.status(502).json({ error: 'Der Versand wurde nicht bestätigt. Prüfen Sie den E-Mail-Verlauf vor einem erneuten Versuch.' }); }
  finally { sending.delete(id.data); }
});
export default router;
