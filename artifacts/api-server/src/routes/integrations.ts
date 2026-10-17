import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';
import { Router, type RequestHandler, type ErrorRequestHandler } from 'express';
import { z } from 'zod/v4';
import { requireAdmin } from '../middlewares/requireAdmin';
import { readIntegrations, saveIntegrations, IntegrationDecryptionError } from '../lib/integrations';
import { integrationTestError } from '../lib/integration-test-error';
const router = Router();
const grants = new Map<string, { session: string; expires: number }>();
const attempts = new Map<string, { count: number; until: number }>();
const fingerprint = (authorization: string) => createHash('sha256').update(authorization).digest('hex');
router.use('/admin/integrations', requireAdmin, (_req, res, next) => { res.set('Cache-Control', 'no-store'); next(); });
router.post('/admin/integrations/unlock', async (req, res) => {
  const parsed = z.object({ password: z.string().min(1).max(1024) }).safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: 'Geben Sie das Passwort ein.' }); return; }
  const session = fingerprint(req.headers.authorization || ''); const now = Date.now();
  for (const [key, value] of attempts) if (value.until < now) attempts.delete(key);
  for (const [key, value] of grants) if (value.expires < now) grants.delete(key);
  const attempt = attempts.get(session) || { count: 0, until: now + 60000 };
  if (attempt.count >= 5) { res.status(429).json({ error: 'Zu viele Versuche. Versuchen Sie es in einer Minute erneut.' }); return; }
  attempt.count++; attempts.set(session, attempt);
  const expected = createHash('sha256').update(process.env.INTEGRATIONS_PASSWORD || '123678').digest();
  const supplied = createHash('sha256').update(parsed.data.password).digest();
  if (!timingSafeEqual(expected, supplied)) { res.status(401).json({ error: 'Das Passwort ist nicht korrekt.' }); return; }
  const token = randomBytes(32).toString('hex'); const expires = now + 10 * 60000;
  grants.set(token, { session, expires }); attempts.delete(session);
  res.json({ token, expires });
});
const requireUnlock: RequestHandler = (req, res, next) => {
  const grant = grants.get(String(req.headers['x-integrations-token'] || ''));
  if (!grant || grant.expires <= Date.now() || grant.session !== fingerprint(req.headers.authorization || '')) { res.status(403).json({ error: 'Entsperren Sie die Integrationen erneut mit Ihrem Passwort.' }); return; }
  next();
};
router.use('/admin/integrations', requireUnlock);
router.post('/admin/integrations/lock', (req, res) => { grants.delete(String(req.headers['x-integrations-token'] || '')); res.json({ locked: true }); });
const secretFields = ['brevoKey', 'supabaseKey', 'supabaseServiceKey', 'twilioToken'] as const;
const schema = z.object({
  brevoKey: z.string().trim().max(1000), brevoFrom: z.union([z.literal(''), z.email()]),
  supabaseUrl: z.union([z.literal(''), z.url().refine(value => /^https:\/\/[a-z0-9-]+\.supabase\.co\/?$/.test(value), 'Verwenden Sie die HTTPS-URL Ihres Supabase-Projekts.')]),
  supabaseKey: z.string().trim().max(3000), supabaseServiceKey: z.string().trim().max(3000),
  twilioSid: z.union([z.literal(''), z.string().regex(/^AC[a-fA-F0-9]{32}$/)]), twilioToken: z.string().trim().max(1000),
  twilioFrom: z.union([z.literal(''), z.string().regex(/^\+[1-9]\d{6,14}$/)]),
});
router.get('/admin/integrations', async (_req, res) => {
  const config = await readIntegrations();
  res.json({ ...config, brevoKey: '', twilioToken: '', configured: Object.fromEntries(secretFields.map(field => [field, Boolean(config[field])])) });
});
router.put('/admin/integrations', async (req, res) => {
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: 'Prüfen Sie URL, E-Mail-Adresse, SID und Telefonnummer.' }); return; }
  const previous = await readIntegrations();
  for (const field of secretFields) if (!parsed.data[field]) parsed.data[field] = previous[field];
  await saveIntegrations(parsed.data); res.json({ saved: true });
});
router.post('/admin/integrations/test/:provider', async (req, res) => {
  const config = await readIntegrations(); let url: string; let headers: Record<string, string>;
  if (req.params.provider === 'brevo') {
    if (!config.brevoKey) { res.status(400).json({ error: 'Speichern Sie den Brevo-Schlüssel.' }); return; }
    // Account lookup verifies authentication without sending an email.
    url = 'https://api.brevo.com/v3/account'; headers = { 'api-key': config.brevoKey };
  } else if (req.params.provider === 'supabase') {
    if (!config.supabaseUrl || !config.supabaseKey) { res.status(400).json({ error: 'Speichern Sie die URL und den Publishable / Anon Key.' }); return; }
    url = `${config.supabaseUrl.replace(/\/$/, '')}/auth/v1/settings`; headers = { apikey: config.supabaseKey };
  } else if (req.params.provider === 'twilio') {
    if (!config.twilioSid || !config.twilioToken) { res.status(400).json({ error: 'Speichern Sie Account SID und Auth Token.' }); return; }
    url = `https://api.twilio.com/2010-04-01/Accounts/${config.twilioSid}.json`;
    headers = { Authorization: `Basic ${Buffer.from(`${config.twilioSid}:${config.twilioToken}`).toString('base64')}` };
  } else { res.status(400).json({ error: 'Unbekannte Integration.' }); return; }
  try {
    const response = await fetch(url, { headers, signal: AbortSignal.timeout(10000), redirect: 'error' });
    if (!response.ok) {
      const body: unknown = await response.json().catch(() => null);
      res.status(response.status === 429 ? 429 : response.status >= 500 ? 502 : 400).json({
        error: integrationTestError(String(req.params.provider), response.status, body),
        provider: req.params.provider, providerStatus: response.status,
      });
      return;
    }
    res.json({ message: 'Die Verbindung wurde erfolgreich geprüft. Es wurde keine E-Mail oder SMS gesendet.' });
  } catch { res.status(502).json({ error: 'Der Dienst ist nicht erreichbar. Bitte versuchen Sie es erneut.' }); }
});
const handleStorageError: ErrorRequestHandler = (error, _req, res, next) => {
  if (!(error instanceof IntegrationDecryptionError)) { next(error); return; }
  res.status(503).json({ error: error.message, code: 'INTEGRATION_DECRYPTION_FAILED' });
};
router.use('/admin/integrations', handleStorageError);
export default router;
