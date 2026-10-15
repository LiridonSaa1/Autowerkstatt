import { resendConfig } from './integrations';
export async function sendEmail(input: { name: string; email: string; subject: string; message: string; senderName: string; fallbackEmail: string }) {
  const resend = await resendConfig();
  const usingResend = Boolean(resend.key);
  const key = usingResend ? resend.key : process.env.BREVO_API_KEY;
  const from = usingResend ? resend.from : process.env.BREVO_SENDER_EMAIL || input.fallbackEmail;
  if (!key || !from) throw new Error('Konfigurieren Sie den Resend API Key und die Absenderadresse unter API-Integrationen.');
  const response = await fetch(usingResend ? 'https://api.resend.com/emails' : 'https://api.brevo.com/v3/smtp/email', {
    method: 'POST', headers: usingResend ? { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' } : { 'api-key': key, 'Content-Type': 'application/json' },
    body: JSON.stringify(usingResend ? { from, to: [input.email], subject: input.subject, text: input.message } : { sender: { name: input.senderName, email: from }, to: [{ name: input.name, email: input.email }], subject: input.subject, textContent: input.message }),
    signal: AbortSignal.timeout(20000),
  });
  if (!response.ok) throw new Error('Der E-Mail-Dienst hat den Versand abgelehnt. Prüfen Sie den Schlüssel und die verifizierte Absenderadresse.');
}
