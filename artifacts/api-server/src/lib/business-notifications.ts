import { z } from 'zod/v4';
import { readSettings } from '../routes/settings';
import { sendEmail } from './send-email';
import { logger } from './logger';
import {
  appointmentEmail,
} from './appointment-email';
import {
  renderBusinessQuoteEmail,
  renderBusinessContactEmail,
} from './email-templates';

type Customer = { name: string; email: string };
type Notification =
  | { kind: 'appointment'; customer: Customer; phone: string; referenceCode: string; date: string; time: string; service: string; vehicle: string; licensePlate?: string | null; vin?: string | null; notes?: string | null }
  | { kind: 'quote'; customer: Customer; id: number; phone: string; vehicle: string; parts: string; preferredDate?: string }
  | { kind: 'contact'; customer: Customer; subject: string; message: string };

export async function notifyBusiness(input: Notification): Promise<boolean> {
  try {
    // Resolve the recipient for each submission so settings changes apply immediately.
    const shop = await readSettings();
    const recipient = z.email().safeParse(shop.email?.trim());
    if (!recipient.success) throw new Error('Business email is not configured');

    const contact = [`Name: ${input.customer.name}`, `E-Mail: ${input.customer.email}`];
    let subject: string;
    let details: string[];
    let htmlContent: string;

    if (input.kind === 'appointment') {
      subject = `Neue Terminanfrage · ${input.referenceCode}`;
      details = [
        ...contact,
        `Telefon: ${input.phone}`,
        '',
        `Referenz: ${input.referenceCode}`,
        `Wunschtermin: ${input.date} · ${input.time} Uhr`,
        `Leistung: ${input.service}`,
        `Fahrzeug: ${input.vehicle}`,
        `Kennzeichen: ${input.licensePlate || 'Nicht angegeben'}`,
        `FIN: ${input.vin || 'Nicht angegeben'}`,
        '',
        `Hinweise: ${input.notes || 'Keine'}`,
      ];
      htmlContent = appointmentEmail({ ...input, businessName: shop.name });
    } else if (input.kind === 'quote') {
      subject = `Neue Angebotsanfrage · #${input.id}`;
      details = [
        ...contact,
        `Telefon: ${input.phone}`,
        '',
        `Fahrzeug: ${input.vehicle}`,
        `Wunschdatum: ${input.preferredDate || 'Nicht angegeben'}`,
        '',
        'Gewünschte Teile / Arbeiten:',
        input.parts,
      ];
      htmlContent = renderBusinessQuoteEmail({
        businessName: shop.name,
        customer: input.customer,
        phone: input.phone,
        quoteId: input.id,
        vehicle: input.vehicle,
        parts: input.parts,
        preferredDate: input.preferredDate,
      });
    } else {
      subject = 'Neue Kontaktanfrage';
      details = [...contact, '', `Betreff: ${input.subject}`, '', input.message];
      htmlContent = renderBusinessContactEmail({
        businessName: shop.name,
        customer: input.customer,
        subject: input.subject,
        message: input.message,
      });
    }

    await sendEmail({
      name: shop.name,
      email: recipient.data,
      subject,
      message: [...details, '', 'Die Anfrage ist auch in der Verwaltung der Website gespeichert.'].join('\n'),
      html: htmlContent,
      senderName: shop.name,
      fallbackEmail: recipient.data,
      replyTo: input.customer,
    });
    return true;
  } catch {
    // The submission is already saved. A mail failure must not invite duplicate submissions.
    logger.error({ notificationType: input.kind }, 'Business notification could not be sent; the request remains saved in admin.');
    return false;
  }
}
