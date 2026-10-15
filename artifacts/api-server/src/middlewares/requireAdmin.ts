import type { RequestHandler } from 'express';

export const requireAdmin: RequestHandler = async (req, res, next) => {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_PUBLISHABLE_KEY;
  const adminEmail = process.env.ADMIN_EMAIL?.trim().toLowerCase();
  if (!url || !key || !adminEmail) {
    res.status(503).json({ error: 'Die Administrator-Anmeldung ist nicht konfiguriert.' });
    return;
  }
  const authorization = req.headers.authorization;
  if (!authorization?.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Eine Anmeldung als Administrator ist erforderlich.' }); return;
  }
  try {
    const response = await fetch(`${url}/auth/v1/user`, {
      headers: { apikey: key, Authorization: authorization },
      signal: AbortSignal.timeout(10000),
    });
    if (!response.ok) { res.status(response.status === 401 || response.status === 403 ? 401 : 503).json({ error: 'Das Konto konnte nicht überprüft werden.' }); return; }
    const user = await response.json() as { id?: string; email?: string; email_confirmed_at?: string };
    if (!user.id || !user.email_confirmed_at || user.email?.toLowerCase() !== adminEmail) {
      res.status(403).json({ error: 'Diese Seite ist ausschließlich für den Administrator der Werkstatt bestimmt.' }); return;
    }
    next();
  } catch {
    res.status(503).json({ error: 'Die Kontoüberprüfung ist derzeit nicht verfügbar. Bitte versuchen Sie es erneut.' });
  }
};
