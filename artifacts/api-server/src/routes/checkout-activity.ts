import { Router } from 'express';
import { pool } from '@workspace/db';
import { requireAdmin } from '../middlewares/requireAdmin';
import { clientEventSchema, describeSession, parseActivityFilters, uuid } from '../lib/checkout-activity';
import { insertActivity, listActivity, sessionActivity } from '../lib/checkout-activity-store';

const router = Router();
// Transient throttling keys are not persisted. Use a shared limiter for multiple instances.
const windows = new Map<string, { count: number; until: number }>();
function allow(key: string, max: number) {
  const now = Date.now();
  if (windows.size > 10000) for (const [id, value] of windows) if (value.until < now) windows.delete(id);
  const entry = windows.get(key);
  if (!entry || entry.until < now) {
    if (windows.size >= 12000) return false;
    windows.set(key, { count: 1, until: now + 60_000 }); return true;
  }
  return ++entry.count <= max;
}
router.post('/activity/events', async (req, res) => {
  const origin = req.get('origin');
  // Only our own browser origin; do not accept cross-site telemetry submissions.
  const expectedHost = process.env.ACTIVITY_PUBLIC_ORIGIN;
  let matchesOrigin = !origin;
  try { matchesOrigin = !origin || (expectedHost ? origin === expectedHost : new URL(origin).host === req.get('host')); } catch { matchesOrigin = false; }
  if (!matchesOrigin) {
    res.status(403).json({ error: 'Origin not allowed' }); return;
  }
  const parsed = clientEventSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: 'Invalid activity event' }); return; }
  if (!allow(`ip:${req.socket.remoteAddress || 'unknown'}`, 300) || !allow(`s:${parsed.data.sessionId}`, 40)) {
    res.set('Retry-After', '60').status(429).json({ error: 'Too many events' }); return;
  }
  const data = parsed.data;
  // Geolocation is unknown unless the deployment explicitly configures a header
  // that its trusted proxy OVERWRITES. Never infer country from browser language.
  const countryHeader = process.env.ACTIVITY_TRUSTED_COUNTRY_HEADER;
  const country = countryHeader ? req.get(countryHeader)?.toUpperCase() : null;
  await insertActivity({ ...data, occurredAt: new Date().toISOString(), source: 'client',
    vin: data.vin || null, code: data.code || null, reference: null,
    country: country && /^[A-Z]{2}$/.test(country) ? country : null,
    internal: Boolean(data.internal || /^(localhost|127\.0\.0\.1)(:|$)/.test(req.get('host') || '')),
    bot: /bot|crawler|spider|headless|lighthouse|preview/i.test(req.get('user-agent') || '') });
  res.status(202).json({ accepted: true });
});
router.get('/admin/checkout-activity', requireAdmin, async (req, res) => {
  res.set('Cache-Control', 'no-store');
  const parsed = parseActivityFilters(req.query);
  if (!parsed.success) { res.status(400).json({ error: 'Ungültige Filter. Maximal 93 Tage.' }); return; }
  res.json(await listActivity(parsed.data));
});
router.get('/admin/checkout-activity/sessions/:sessionId', requireAdmin, async (req, res) => {
  res.set('Cache-Control', 'no-store');
  const id = uuid.safeParse(req.params.sessionId);
  const cursor = req.query.after === undefined ? undefined : uuid.safeParse(req.query.after);
  if (!id.success || (cursor && !cursor.success)) { res.status(400).json({ error: 'Invalid session' }); return; }
  const events = await sessionActivity(id.data, cursor?.data);
  const hasMore = events.length > 500;
  const page = events.slice(0, 500);
  res.json({ timeline: page, hasMore, after: hasMore ? page.at(-1)?.id : null });
});
router.post('/admin/checkout-activity/internal', requireAdmin, async (req, res) => {
  const id = uuid.safeParse(req.body.sessionId);
  if (!id.success) { res.status(400).json({ error: 'Invalid session' }); return; }
  await pool.query('UPDATE checkout_activity_events SET internal=true WHERE session_id=$1', [id.data]);
  res.json({ updated: true });
});
export default router;
