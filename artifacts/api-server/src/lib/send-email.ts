import { brevoConfig } from './integrations';
export async function sendEmail(input: { name: string; email: string; subject: string; message: string; html?: string; senderName: string; fallbackEmail: string; replyTo?: { name: string; email: string } }) {
  const config = await brevoConfig();
  const from = config.from || input.fallbackEmail;
  if (!config.key || !from) throw new Error('Konfigurieren Sie den Brevo API Key und die verifizierte Absenderadresse unter API-Integrationen.');
  const response = await fetch('https://api.brevo.com/v3/smtp/email', {
    method: 'POST', headers: { 'api-key': config.key, 'Content-Type': 'application/json' },
    body: JSON.stringify({ sender: { name: input.senderName, email: from }, to: [{ name: input.name, email: input.email }], subject: input.subject, textContent: input.message, ...(input.html ? { htmlContent: input.html } : {}), ...(input.replyTo ? { replyTo: input.replyTo } : {}) }),
    signal: AbortSignal.timeout(20000),
  });
  if (!response.ok) throw new Error('Brevo hat den Versand abgelehnt. Prüfen Sie den API-Schlüssel, die verifizierte Absenderadresse und die Freischaltung für Transaktions-E-Mails.');
}
