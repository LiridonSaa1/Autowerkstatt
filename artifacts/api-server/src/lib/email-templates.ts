type BusinessInfo = {
  name: string;
  tagline?: string;
  phone?: string;
  whatsapp?: string;
  email?: string;
  address?: string;
  city?: string;
  emergencyPhone?: string;
  openingHours?: string;
  mapUrl?: string;
};

const escape = (value: string | null | undefined): string => {
  if (!value) return '';
  return String(value).replace(/[&<>"']/g, (char) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  }[char]!));
};

function formatGermanDate(dateStr: string): string {
  try {
    const parts = dateStr.split('-');
    if (parts.length === 3) {
      const d = new Date(Date.UTC(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]), 12, 0, 0));
      return d.toLocaleDateString('de-DE', {
        weekday: 'long',
        day: '2-digit',
        month: 'long',
        year: 'numeric',
        timeZone: 'Europe/Berlin',
      });
    }
  } catch {
    // fallback
  }
  return dateStr;
}

function formatTextToHtml(text: string): string {
  const e = escape(text);
  return e
    .split(/\r?\n\r?\n/)
    .map((paragraph) => `<p style="margin:0 0 14px;line-height:1.65;color:#2a3b47">${paragraph.replace(/\r?\n/g, '<br>')}</p>`)
    .join('');
}

function renderHeader(title: string, subtitle: string, business: BusinessInfo): string {
  const e = escape;
  const businessName = e(business.name || 'Auto Service & Detailing Hub');
  const tagline = e(business.tagline || 'Kfz-Meisterbetrieb & Fahrzeugservice');
  return `
    <tr>
      <td style="padding:32px 32px 28px;background:linear-gradient(135deg, #152732 0%, #1d3543 100%);background-color:#1d3543;border-top:5px solid #ff601f">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
          <tr>
            <td>
              <div style="font-size:18px;font-weight:800;letter-spacing:-0.3px;color:#ffffff;line-height:1.2;margin:0 0 4px">
                ${businessName}
              </div>
              <div style="font-size:11px;font-weight:600;letter-spacing:1px;text-transform:uppercase;color:#ffb36b;margin:0 0 22px">
                ${tagline}
              </div>
              <h1 style="margin:0;color:#ffffff;font-size:26px;font-weight:700;line-height:1.25;letter-spacing:-0.5px">
                ${e(title)}
              </h1>
              ${subtitle ? `<p style="margin:8px 0 0;color:#c2d2dc;font-size:14px;line-height:1.5">${e(subtitle)}</p>` : ''}
            </td>
          </tr>
        </table>
      </td>
    </tr>
  `;
}

function renderFooter(business: BusinessInfo): string {
  const e = escape;
  const phone = business.phone ? `<a href="tel:${e(business.phone.replace(/[^+\d]/g, ''))}" style="color:#ff601f;text-decoration:none;font-weight:bold">${e(business.phone)}</a>` : '';
  const email = business.email ? `<a href="mailto:${e(business.email)}" style="color:#ff601f;text-decoration:none">${e(business.email)}</a>` : '';
  const emergency = business.emergencyPhone ? `<span style="color:#e05216;font-weight:bold">24h Notdienst: ${e(business.emergencyPhone)}</span>` : '';
  const fullAddress = [business.address, business.city].filter(Boolean).join(', ');

  return `
    <tr>
      <td style="padding:28px 32px;background-color:#edf2f4;border-top:1px solid #e1e7e9;border-bottom-left-radius:14px;border-bottom-right-radius:14px">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
          <tr>
            <td style="color:#4a5b66;font-size:13px;line-height:1.65">
              <strong style="color:#1d3543;font-size:14px">${e(business.name)}</strong><br>
              ${fullAddress ? `${e(fullAddress)}<br>` : ''}
              ${business.openingHours ? `Öffnungszeiten: ${e(business.openingHours)}<br>` : ''}
              ${phone ? `Telefon: ${phone}` : ''} ${phone && email ? '· ' : ''}${email ? `E-Mail: ${email}` : ''}
              ${emergency ? `<br>${emergency}` : ''}
            </td>
          </tr>
          <tr>
            <td style="padding-top:18px;border-top:1px solid #dbe2e6;margin-top:16px;color:#8899a6;font-size:11px;line-height:1.5">
              Diese Nachricht wurde automatisch generiert. Antworten auf diese E-Mail erreichen direkt unseren Kundenservice.
            </td>
          </tr>
        </table>
      </td>
    </tr>
  `;
}

function renderDetailRow(label: string, value: string, isLast = false): string {
  return `
    <tr>
      <td style="padding:10px 0;${isLast ? '' : 'border-bottom:1px solid #edf0f2;'}color:#70808a;font-size:13px;width:38%;vertical-align:top">
        ${label}
      </td>
      <td style="padding:10px 0 10px 14px;${isLast ? '' : 'border-bottom:1px solid #edf0f2;'}color:#1d3543;font-size:14px;font-weight:600;word-break:break-word">
        ${value}
      </td>
    </tr>
  `;
}

// ------------------------------------------------------------------------------------------------
// 1. CONTACT REPLY EMAIL (To Customer)
// ------------------------------------------------------------------------------------------------
export type ContactReplyEmailInput = {
  customerName: string;
  subject: string;
  replyMessage: string;
  originalMessage?: string | null;
  originalSubject?: string | null;
  originalDate?: string | null;
  business: BusinessInfo;
};

export function renderContactReplyEmail(input: ContactReplyEmailInput): string {
  const e = escape;
  const formattedReply = formatTextToHtml(input.replyMessage);
  const firstName = input.customerName.trim().split(' ')[0] || input.customerName;

  const phoneLink = input.business.phone
    ? `<table role="presentation" cellspacing="0" cellpadding="0" style="display:inline-table;margin-right:12px;margin-bottom:8px">
        <tr>
          <td bgcolor="#ff601f" style="border-radius:8px">
            <a href="tel:${e(input.business.phone.replace(/[^+\d]/g, ''))}" style="display:inline-block;padding:12px 20px;color:#ffffff;font-size:13px;font-weight:bold;text-decoration:none;letter-spacing:0.3px">
              📞 Jetzt anrufen (${e(input.business.phone)})
            </a>
          </td>
        </tr>
      </table>`
    : '';

  const emailReplyLink = input.business.email
    ? `<table role="presentation" cellspacing="0" cellpadding="0" style="display:inline-table;margin-bottom:8px">
        <tr>
          <td bgcolor="#1d3543" style="border-radius:8px">
            <a href="mailto:${e(input.business.email)}?subject=${encodeURIComponent(`Re: ${input.subject}`)}" style="display:inline-block;padding:12px 20px;color:#ffffff;font-size:13px;font-weight:bold;text-decoration:none">
              ✉️ Per E-Mail antworten
            </a>
          </td>
        </tr>
      </table>`
    : '';

  return `<!doctype html>
<html lang="de">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>${e(input.subject)}</title>
</head>
<body style="margin:0;padding:0;background-color:#f4f1eb;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#1d3543;-webkit-font-smoothing:antialiased">
  <div style="display:none;font-size:1px;line-height:1px;max-height:0;overflow:hidden;mso-hide:all">
    Antwort von ${e(input.business.name)}: ${e(input.replyMessage.slice(0, 120))}...
  </div>
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background-color:#f4f1eb">
    <tr>
      <td align="center" style="padding:32px 14px">
        <table role="presentation" width="600" cellspacing="0" cellpadding="0" border="0" style="width:100%;max-width:600px;background-color:#ffffff;border:1px solid #e3ded6;border-radius:14px;overflow:hidden;box-shadow:0 4px 18px rgba(0,0,0,0.04)">
          ${renderHeader('Antwort auf Ihre Anfrage', input.subject, input.business)}

          <!-- Body Content -->
          <tr>
            <td style="padding:32px 32px 16px">
              <div style="font-size:16px;color:#1d3543;font-weight:600;margin-bottom:18px">
                Hallo ${e(firstName)},
              </div>

              <!-- Reply message box -->
              <div style="font-size:15px;line-height:1.65;color:#24343f">
                ${formattedReply}
              </div>

              <!-- Signature -->
              <div style="margin:26px 0 0;padding-top:18px;border-top:1px solid #edf0f2;color:#5c6b73;font-size:13px;line-height:1.6">
                Beste Grüße,<br>
                <strong style="color:#1d3543;font-size:14px">${e(input.business.name)} Team</strong>
              </div>
            </td>
          </tr>

          <!-- Action buttons -->
          <tr>
            <td style="padding:10px 32px 24px">
              <p style="margin:0 0 12px;color:#70808a;font-size:12px;font-weight:600;text-transform:uppercase;letter-spacing:0.8px">
                Haben Sie Rückfragen?
              </p>
              ${phoneLink}
              ${emailReplyLink}
            </td>
          </tr>

          ${input.originalMessage ? `
          <!-- Original Message Accordion/Box -->
          <tr>
            <td style="padding:0 32px 28px">
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color:#f8f9fa;border:1px solid #e5e9ec;border-left:4px solid #ff601f;border-radius:8px">
                <tr>
                  <td style="padding:16px 20px">
                    <div style="font-size:11px;font-weight:700;color:#ff601f;letter-spacing:1px;text-transform:uppercase;margin-bottom:6px">
                      Ihre ursprüngliche Nachricht
                    </div>
                    ${input.originalSubject ? `<div style="font-size:13px;font-weight:bold;color:#1d3543;margin-bottom:6px">Betreff: ${e(input.originalSubject)}</div>` : ''}
                    <div style="font-size:13px;color:#50626d;line-height:1.6;white-space:pre-wrap;word-break:break-word">
                      ${e(input.originalMessage)}
                    </div>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          ` : ''}

          ${renderFooter(input.business)}
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

// ------------------------------------------------------------------------------------------------
// 2. CUSTOMER APPOINTMENT CONFIRMATION (To Customer on Booking)
// ------------------------------------------------------------------------------------------------
export type CustomerAppointmentEmailInput = {
  customerName: string;
  email: string;
  phone: string;
  referenceCode: string;
  date: string;
  time: string;
  service: string;
  vehicle: string;
  licensePlate?: string | null;
  vin?: string | null;
  notes?: string | null;
  business: BusinessInfo;
  isConfirmed?: boolean;
};

export function renderCustomerAppointmentEmail(input: CustomerAppointmentEmailInput): string {
  const e = escape;
  const dateFormatted = formatGermanDate(input.date);
  const firstName = input.customerName.trim().split(' ')[0] || input.customerName;
  const isConfirmed = Boolean(input.isConfirmed);

  const statusBadge = isConfirmed
    ? `<span style="display:inline-block;padding:5px 12px;background-color:#e6f8ed;border:1px solid #95deb3;color:#0d7a3e;font-size:12px;font-weight:bold;border-radius:20px">✓ Bestätigt</span>`
    : `<span style="display:inline-block;padding:5px 12px;background-color:#fff3e9;border:1px solid #ffd8bc;color:#b94d13;font-size:12px;font-weight:bold;border-radius:20px">⏳ Anfrage eingegangen · Prüfung läuft</span>`;

  return `<!doctype html>
<html lang="de">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>${isConfirmed ? 'Terminbestätigung' : 'Terminanfrage eingegangen'} · ${e(input.referenceCode)}</title>
</head>
<body style="margin:0;padding:0;background-color:#f4f1eb;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#1d3543;-webkit-font-smoothing:antialiased">
  <div style="display:none;font-size:1px;line-height:1px;max-height:0;overflow:hidden;mso-hide:all">
    ${isConfirmed ? 'Ihr Termin wurde bestätigt' : 'Wir haben Ihre Terminanfrage erhalten'}: ${e(dateFormatted)} um ${e(input.time)} Uhr für ${e(input.service)}.
  </div>
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background-color:#f4f1eb">
    <tr>
      <td align="center" style="padding:32px 14px">
        <table role="presentation" width="600" cellspacing="0" cellpadding="0" border="0" style="width:100%;max-width:600px;background-color:#ffffff;border:1px solid #e3ded6;border-radius:14px;overflow:hidden;box-shadow:0 4px 18px rgba(0,0,0,0.04)">
          ${renderHeader(
            isConfirmed ? 'Ihr Termin ist bestätigt! 🎉' : 'Terminanfrage eingegangen',
            isConfirmed ? 'Wir freuen uns auf Ihren Besuch in unserer Werkstatt.' : 'Vielen Dank für Ihre Buchung! Wir prüfen Ihren Terminwunsch.',
            input.business
          )}

          <!-- Welcome greeting & Highlight Card -->
          <tr>
            <td style="padding:28px 32px 0">
              <p style="margin:0 0 16px;font-size:15px;line-height:1.6;color:#24343f">
                Hallo <strong>${e(firstName)}</strong>,<br>
                ${isConfirmed
                  ? 'Ihr Werkstatt-Termin wurde von unserem Meisterbetrieb verbindlich bestätigt. Nachfolgend finden Sie alle Details:'
                  : 'wir haben Ihre Online-Terminanfrage erfolgreich erhalten. Unser Team prüft Ihre gewünschte Zeit und meldet sich in Kürze bei Ihnen.'}
              </p>

              <!-- Highlighted Date & Reference Box -->
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:linear-gradient(135deg, #fff6ee 0%, #ffeedd 100%);border:1px solid #ffd4b2;border-radius:12px;margin:12px 0 20px">
                <tr>
                  <td style="padding:22px">
                    <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
                      <tr>
                        <td>
                          <div style="font-size:11px;font-weight:700;color:#b94d13;letter-spacing:1.5px;text-transform:uppercase;margin-bottom:6px">
                            IHR WUNSCHTERMIN
                          </div>
                          <div style="font-size:19px;font-weight:bold;color:#1d3543;line-height:1.3">
                            ${e(dateFormatted)}
                          </div>
                          <div style="font-size:32px;font-weight:800;color:#e85317;line-height:1.2;margin:4px 0 10px">
                            ${e(input.time)} <span style="font-size:16px;font-weight:bold;color:#6d7981">Uhr</span>
                          </div>
                          <div style="margin-top:6px">
                            ${statusBadge}
                          </div>
                        </td>
                        <td align="right" style="vertical-align:top">
                          <div style="background-color:#ffffff;border:1px dashed #e85317;border-radius:8px;padding:8px 12px;text-align:center">
                            <div style="font-size:10px;font-weight:700;color:#70808a;letter-spacing:1px;text-transform:uppercase">Referenz</div>
                            <div style="font-size:14px;font-weight:800;color:#1d3543;font-family:monospace;letter-spacing:0.5px">${e(input.referenceCode)}</div>
                          </div>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Booking Details Table -->
          <tr>
            <td style="padding:10px 32px 0">
              <h2 style="margin:0 0 12px;color:#1d3543;font-size:16px;font-weight:700;letter-spacing:-0.2px">
                Buchungsdetails
              </h2>
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border:1px solid #edf0f2;border-radius:10px;padding:6px 16px;background-color:#fafbfc">
                ${renderDetailRow('Gewählte Leistung', e(input.service))}
                ${renderDetailRow('Fahrzeug', e(input.vehicle))}
                ${renderDetailRow('Amtliches Kennzeichen', e(input.licensePlate || 'Nicht angegeben'))}
                ${renderDetailRow('Fahrgestellnummer (FIN)', e(input.vin || 'Nicht angegeben'))}
                ${renderDetailRow('Kontakttelefon', `<a href="tel:${e(input.phone.replace(/[^+\d]/g, ''))}" style="color:#1d3543;text-decoration:none">${e(input.phone)}</a>`)}
                ${renderDetailRow('Ihre E-Mail', e(input.email), true)}
              </table>
            </td>
          </tr>

          ${input.notes ? `
          <!-- Notes -->
          <tr>
            <td style="padding:18px 32px 0">
              <h3 style="margin:0 0 8px;font-size:14px;font-weight:700;color:#1d3543">Ihre Anmerkungen:</h3>
              <div style="padding:12px 16px;background-color:#f6f8f9;border-left:3px solid #ff601f;border-radius:6px;font-size:13px;line-height:1.6;color:#4f606a">
                ${e(input.notes)}
              </div>
            </td>
          </tr>
          ` : ''}

          <!-- Next Steps Timeline -->
          <tr>
            <td style="padding:24px 32px 10px">
              <h3 style="margin:0 0 14px;font-size:14px;font-weight:700;color:#1d3543;letter-spacing:-0.2px">
                So geht es weiter:
              </h3>
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
                <tr>
                  <td style="width:30px;vertical-align:top;padding-bottom:12px">
                    <div style="width:24px;height:24px;border-radius:50%;background-color:#1d3543;color:#ffffff;font-size:12px;font-weight:bold;text-align:center;line-height:24px">1</div>
                  </td>
                  <td style="vertical-align:top;padding-left:8px;padding-bottom:12px">
                    <strong style="color:#1d3543;font-size:13px">Prüfung & Disposition</strong>
                    <div style="color:#63727c;font-size:12px;line-height:1.4">Unsere Werkstattleitung prüft Teileverfügbarkeit und Hebebühnen-Kapazitäten.</div>
                  </td>
                </tr>
                <tr>
                  <td style="width:30px;vertical-align:top;padding-bottom:12px">
                    <div style="width:24px;height:24px;border-radius:50%;background-color:#ff601f;color:#ffffff;font-size:12px;font-weight:bold;text-align:center;line-height:24px">2</div>
                  </td>
                  <td style="vertical-align:top;padding-left:8px;padding-bottom:12px">
                    <strong style="color:#1d3543;font-size:13px">Persönliche Rückmeldung</strong>
                    <div style="color:#63727c;font-size:12px;line-height:1.4">Sie erhalten zeitnah die verbindliche Bestätigung per E-Mail oder einen kurzen Anruf bei Rückfragen.</div>
                  </td>
                </tr>
                <tr>
                  <td style="width:30px;vertical-align:top">
                    <div style="width:24px;height:24px;border-radius:50%;background-color:#2a8555;color:#ffffff;font-size:12px;font-weight:bold;text-align:center;line-height:24px">3</div>
                  </td>
                  <td style="vertical-align:top;padding-left:8px">
                    <strong style="color:#1d3543;font-size:13px">Fahrzeugabgabe</strong>
                    <div style="color:#63727c;font-size:12px;line-height:1.4">Bringen Sie Ihr Fahrzeug zum vereinbarten Termin zu uns. Unser Meister nimmt das Auto direkt in Empfang.</div>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Contact box -->
          <tr>
            <td style="padding:16px 32px 28px">
              <div style="padding:16px;background-color:#f8f9fa;border-radius:10px;border:1px solid #e7ecf0">
                <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
                  <tr>
                    <td>
                      <div style="font-size:13px;font-weight:bold;color:#1d3543;margin-bottom:4px">
                        Haben Sie Fragen zur Buchung oder möchten Sie den Termin anpassen?
                      </div>
                      <div style="font-size:12px;color:#61727d;line-height:1.5">
                        Rufen Sie uns gerne an oder antworten Sie direkt auf diese E-Mail unter Angabe der Referenz <strong style="color:#1d3543">${e(input.referenceCode)}</strong>.
                      </div>
                    </td>
                    ${input.business.phone ? `
                    <td align="right" style="vertical-align:middle;padding-left:14px">
                      <table role="presentation" cellspacing="0" cellpadding="0">
                        <tr>
                          <td bgcolor="#ff601f" style="border-radius:6px">
                            <a href="tel:${e(input.business.phone.replace(/[^+\d]/g, ''))}" style="display:inline-block;padding:10px 16px;color:#ffffff;font-size:12px;font-weight:bold;text-decoration:none;white-space:nowrap">
                              Anrufen
                            </a>
                          </td>
                        </tr>
                      </table>
                    </td>
                    ` : ''}
                  </tr>
                </table>
              </div>
            </td>
          </tr>

          ${renderFooter(input.business)}
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

// ------------------------------------------------------------------------------------------------
// 3. QUOTE OFFER EMAIL (Admin to Customer)
// ------------------------------------------------------------------------------------------------
export type QuoteOfferEmailInput = {
  customerName: string;
  quoteId: number;
  subject: string;
  message: string;
  vehicle: string;
  parts?: string | null;
  business: BusinessInfo;
};

export function renderQuoteOfferEmail(input: QuoteOfferEmailInput): string {
  const e = escape;
  const formattedMessage = formatTextToHtml(input.message);
  const firstName = input.customerName.trim().split(' ')[0] || input.customerName;

  return `<!doctype html>
<html lang="de">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>${e(input.subject)}</title>
</head>
<body style="margin:0;padding:0;background-color:#f4f1eb;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#1d3543;-webkit-font-smoothing:antialiased">
  <div style="display:none;font-size:1px;line-height:1px;max-height:0;overflow:hidden;mso-hide:all">
    Ihr individuelles Angebot von ${e(input.business.name)} zu Ihrer Anfrage #${input.quoteId}.
  </div>
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background-color:#f4f1eb">
    <tr>
      <td align="center" style="padding:32px 14px">
        <table role="presentation" width="600" cellspacing="0" cellpadding="0" border="0" style="width:100%;max-width:600px;background-color:#ffffff;border:1px solid #e3ded6;border-radius:14px;overflow:hidden;box-shadow:0 4px 18px rgba(0,0,0,0.04)">
          ${renderHeader('Ihr individuelles Werkstatt-Angebot', `Angebots-Nr. #${input.quoteId} · ${input.vehicle}`, input.business)}

          <!-- Body Content -->
          <tr>
            <td style="padding:30px 32px 14px">
              <div style="font-size:16px;color:#1d3543;font-weight:600;margin-bottom:16px">
                Hallo ${e(firstName)},
              </div>

              <!-- Message Box -->
              <div style="font-size:15px;line-height:1.65;color:#24343f">
                ${formattedMessage}
              </div>

              <!-- Vehicle info badge -->
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color:#fafbfc;border:1px solid #edf0f2;border-radius:8px;padding:12px 16px;margin:22px 0 0">
                <tr>
                  <td style="font-size:12px;color:#70808a;width:35%">Fahrzeug:</td>
                  <td style="font-size:13px;font-weight:bold;color:#1d3543">${e(input.vehicle)}</td>
                </tr>
                ${input.parts ? `
                <tr>
                  <td style="font-size:12px;color:#70808a;padding-top:6px;vertical-align:top">Ihre Anfrage:</td>
                  <td style="font-size:13px;color:#4a5b66;padding-top:6px">${e(input.parts)}</td>
                </tr>
                ` : ''}
              </table>

              <!-- Signature -->
              <div style="margin:26px 0 0;padding-top:18px;border-top:1px solid #edf0f2;color:#5c6b73;font-size:13px;line-height:1.6">
                Gerne beraten wir Sie auch persönlich zu diesem Angebot.<br>
                Beste Grüße,<br>
                <strong style="color:#1d3543;font-size:14px">${e(input.business.name)}</strong>
              </div>
            </td>
          </tr>

          <!-- Action buttons -->
          <tr>
            <td style="padding:10px 32px 28px">
              ${input.business.phone ? `
              <table role="presentation" cellspacing="0" cellpadding="0" style="display:inline-table;margin-right:12px;margin-bottom:8px">
                <tr>
                  <td bgcolor="#ff601f" style="border-radius:8px">
                    <a href="tel:${e(input.business.phone.replace(/[^+\d]/g, ''))}" style="display:inline-block;padding:12px 20px;color:#ffffff;font-size:13px;font-weight:bold;text-decoration:none">
                      📞 Angebot telefonisch besprechen
                    </a>
                  </td>
                </tr>
              </table>
              ` : ''}
              ${input.business.email ? `
              <table role="presentation" cellspacing="0" cellpadding="0" style="display:inline-table;margin-bottom:8px">
                <tr>
                  <td bgcolor="#1d3543" style="border-radius:8px">
                    <a href="mailto:${e(input.business.email)}?subject=${encodeURIComponent(`Annahme Angebot #${input.quoteId}`)}" style="display:inline-block;padding:12px 20px;color:#ffffff;font-size:13px;font-weight:bold;text-decoration:none">
                      ✉️ Angebot annehmen
                    </a>
                  </td>
                </tr>
              </table>
              ` : ''}
            </td>
          </tr>

          ${renderFooter(input.business)}
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

// ------------------------------------------------------------------------------------------------
// 4. BUSINESS NOTIFICATIONS (Internal Alerts for Appointments, Quotes, Contact Messages)
// ------------------------------------------------------------------------------------------------
export type BusinessAppointmentInput = {
  businessName: string;
  customer: { name: string; email: string };
  phone: string;
  referenceCode: string;
  date: string;
  time: string;
  service: string;
  vehicle: string;
  licensePlate?: string | null;
  vin?: string | null;
  notes?: string | null;
};

export function renderBusinessAppointmentEmail(input: BusinessAppointmentInput): string {
  const e = escape;
  const dateFormatted = formatGermanDate(input.date);
  const emailLink = `mailto:${encodeURIComponent(input.customer.email)}?subject=${encodeURIComponent(`Ihre Terminanfrage ${input.referenceCode}`)}`;
  const phoneClean = input.phone.replace(/[^+\d]/g, '');

  return `<!doctype html>
<html lang="de">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>Neue Terminanfrage ${e(input.referenceCode)}</title>
</head>
<body style="margin:0;padding:0;background-color:#f4f1eb;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#1d3543">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background-color:#f4f1eb">
    <tr>
      <td align="center" style="padding:28px 12px">
        <table role="presentation" width="600" cellspacing="0" cellpadding="0" border="0" style="width:100%;max-width:600px;background-color:#ffffff;border:1px solid #e6e1d8;border-radius:14px;overflow:hidden">
          <tr>
            <td style="padding:28px 28px;background-color:#1d3543;border-top:5px solid #ff601f">
              <p style="margin:0 0 6px;font-size:10px;font-weight:bold;letter-spacing:1.5px;color:#ffb36b;text-transform:uppercase">Werkstatt Benachrichtigung</p>
              <h1 style="margin:0;color:#ffffff;font-size:26px;font-weight:700;line-height:1.2">Neue Terminanfrage eingegangen</h1>
              <p style="margin:8px 0 0;color:#c7d3db;font-size:13px">${e(input.customer.name)} möchte einen Termin vereinbaren.</p>
            </td>
          </tr>
          <tr>
            <td style="padding:24px 28px 0">
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color:#fff3e9;border:1px solid #ffdcc2;border-radius:10px;padding:18px">
                <tr>
                  <td>
                    <div style="color:#9a4a1a;font-size:10px;font-weight:bold;letter-spacing:1.5px;text-transform:uppercase;margin-bottom:4px">Gewünschter Termin</div>
                    <div style="color:#1d3543;font-size:18px;font-weight:bold">${e(dateFormatted)}</div>
                    <div style="color:#ef5a1f;font-size:28px;font-weight:bold;margin:4px 0">${e(input.time)} <span style="font-size:14px;color:#6d7981">Uhr</span></div>
                    <div style="color:#6c7276;font-size:12px">Referenz: <strong>${e(input.referenceCode)}</strong></div>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td style="padding:22px 28px 0">
              <h2 style="margin:0 0 10px;color:#1d3543;font-size:15px;font-weight:700">Kunde & Kontaktdaten</h2>
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border:1px solid #edf0f2;border-radius:8px;padding:6px 14px;background-color:#fafbfc">
                ${renderDetailRow('Kundenname', e(input.customer.name))}
                ${renderDetailRow('E-Mail', `<a href="${e(emailLink)}" style="color:#ff601f;text-decoration:none">${e(input.customer.email)}</a>`)}
                ${renderDetailRow('Telefon', `<a href="tel:${e(phoneClean)}" style="color:#1d3543;text-decoration:none">${e(input.phone)}</a>`, true)}
              </table>
            </td>
          </tr>
          <tr>
            <td style="padding:20px 28px 0">
              <h2 style="margin:0 0 10px;color:#1d3543;font-size:15px;font-weight:700">Leistung & Fahrzeug</h2>
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border:1px solid #edf0f2;border-radius:8px;padding:6px 14px;background-color:#fafbfc">
                ${renderDetailRow('Leistung', e(input.service))}
                ${renderDetailRow('Fahrzeug', e(input.vehicle))}
                ${renderDetailRow('Kennzeichen', e(input.licensePlate || 'Nicht angegeben'))}
                ${renderDetailRow('FIN (Fahrgestellnr.)', e(input.vin || 'Nicht angegeben'), true)}
              </table>
            </td>
          </tr>
          ${input.notes ? `
          <tr>
            <td style="padding:20px 28px 0">
              <h3 style="margin:0 0 8px;font-size:13px;font-weight:700">Kundenhinweise:</h3>
              <div style="padding:12px 14px;background-color:#f6f5f2;border-radius:6px;font-size:13px;color:#52616b;line-height:1.6">
                ${e(input.notes)}
              </div>
            </td>
          </tr>
          ` : ''}
          <tr>
            <td style="padding:24px 28px">
              <table role="presentation" cellspacing="0" cellpadding="0" style="display:inline-table;margin-right:10px;margin-bottom:8px">
                <tr>
                  <td bgcolor="#ff601f" style="border-radius:8px">
                    <a href="${e(emailLink)}" style="display:inline-block;padding:12px 20px;color:#ffffff;font-size:13px;font-weight:bold;text-decoration:none">
                      Kunden per E-Mail antworten &rarr;
                    </a>
                  </td>
                </tr>
              </table>
              <table role="presentation" cellspacing="0" cellpadding="0" style="display:inline-table;margin-bottom:8px">
                <tr>
                  <td bgcolor="#1d3543" style="border-radius:8px">
                    <a href="tel:${e(phoneClean)}" style="display:inline-block;padding:12px 20px;color:#ffffff;font-size:13px;font-weight:bold;text-decoration:none">
                      📞 Kunden anrufen
                    </a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td style="padding:16px 28px;background-color:#edf1f2;border-top:1px solid #e1e7e9;border-bottom-left-radius:14px;border-bottom-right-radius:14px">
              <p style="margin:0;font-size:11px;color:#61727d;line-height:1.5">
                REFERENZ <strong style="color:#1d3543">${e(input.referenceCode)}</strong> · ${e(input.businessName)} Verwaltung
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

export type BusinessQuoteInput = {
  businessName: string;
  customer: { name: string; email: string };
  phone: string;
  quoteId: number;
  vehicle: string;
  parts: string;
  preferredDate?: string | null;
};

export function renderBusinessQuoteEmail(input: BusinessQuoteInput): string {
  const e = escape;
  const emailLink = `mailto:${encodeURIComponent(input.customer.email)}?subject=${encodeURIComponent(`Ihr Angebot #${input.quoteId}`)}`;
  const phoneClean = input.phone.replace(/[^+\d]/g, '');

  return `<!doctype html>
<html lang="de">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>Neue Angebotsanfrage #${input.quoteId}</title>
</head>
<body style="margin:0;padding:0;background-color:#f4f1eb;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#1d3543">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background-color:#f4f1eb">
    <tr>
      <td align="center" style="padding:28px 12px">
        <table role="presentation" width="600" cellspacing="0" cellpadding="0" border="0" style="width:100%;max-width:600px;background-color:#ffffff;border:1px solid #e6e1d8;border-radius:14px;overflow:hidden">
          <tr>
            <td style="padding:28px 28px;background-color:#1d3543;border-top:5px solid #ff601f">
              <p style="margin:0 0 6px;font-size:10px;font-weight:bold;letter-spacing:1.5px;color:#ffb36b;text-transform:uppercase">Angebotsanfrage</p>
              <h1 style="margin:0;color:#ffffff;font-size:26px;font-weight:700">Neue Anfrage #${input.quoteId}</h1>
              <p style="margin:8px 0 0;color:#c7d3db;font-size:13px">${e(input.customer.name)} bittet um einen Kostenvoranschlag.</p>
            </td>
          </tr>
          <tr>
            <td style="padding:24px 28px 0">
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border:1px solid #edf0f2;border-radius:8px;padding:6px 14px;background-color:#fafbfc">
                ${renderDetailRow('Kundenname', e(input.customer.name))}
                ${renderDetailRow('E-Mail', `<a href="${e(emailLink)}" style="color:#ff601f;text-decoration:none">${e(input.customer.email)}</a>`)}
                ${renderDetailRow('Telefon', `<a href="tel:${e(phoneClean)}" style="color:#1d3543;text-decoration:none">${e(input.phone)}</a>`)}
                ${renderDetailRow('Fahrzeug', e(input.vehicle))}
                ${renderDetailRow('Wunschdatum', input.preferredDate ? formatGermanDate(input.preferredDate) : 'Flexibel / schnellstmöglich', true)}
              </table>
            </td>
          </tr>
          <tr>
            <td style="padding:20px 28px 0">
              <h3 style="margin:0 0 8px;font-size:14px;font-weight:700;color:#1d3543">Gewünschte Arbeiten / Teile:</h3>
              <div style="padding:14px 16px;background-color:#f6f8f9;border-left:3px solid #ff601f;border-radius:6px;font-size:13px;color:#24343f;line-height:1.6;white-space:pre-wrap">
                ${e(input.parts)}
              </div>
            </td>
          </tr>
          <tr>
            <td style="padding:24px 28px">
              <table role="presentation" cellspacing="0" cellpadding="0" style="display:inline-table;margin-right:10px;margin-bottom:8px">
                <tr>
                  <td bgcolor="#ff601f" style="border-radius:8px">
                    <a href="${e(emailLink)}" style="display:inline-block;padding:12px 20px;color:#ffffff;font-size:13px;font-weight:bold;text-decoration:none">
                      Angebot per E-Mail senden &rarr;
                    </a>
                  </td>
                </tr>
              </table>
              <table role="presentation" cellspacing="0" cellpadding="0" style="display:inline-table;margin-bottom:8px">
                <tr>
                  <td bgcolor="#1d3543" style="border-radius:8px">
                    <a href="tel:${e(phoneClean)}" style="display:inline-block;padding:12px 20px;color:#ffffff;font-size:13px;font-weight:bold;text-decoration:none">
                      📞 Kunden anrufen
                    </a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td style="padding:16px 28px;background-color:#edf1f2;border-top:1px solid #e1e7e9;border-bottom-left-radius:14px;border-bottom-right-radius:14px">
              <p style="margin:0;font-size:11px;color:#61727d">
                ANGEBOT #${input.quoteId} · ${e(input.businessName)} Verwaltung
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

export type BusinessContactInput = {
  businessName: string;
  customer: { name: string; email: string };
  subject: string;
  message: string;
};

export type CustomerContactAcknowledgmentInput = {
  customerName: string;
  subject: string;
  message: string;
  business: BusinessInfo;
};

export function renderCustomerContactAcknowledgmentEmail(input: CustomerContactAcknowledgmentInput): string {
  const e = escape;
  const firstName = input.customerName.trim().split(' ')[0] || input.customerName;

  return `<!doctype html>
<html lang="de">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>Ihre Nachricht an ${e(input.business.name)}</title>
</head>
<body style="margin:0;padding:0;background-color:#f4f1eb;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#1d3543;-webkit-font-smoothing:antialiased">
  <div style="display:none;font-size:1px;line-height:1px;max-height:0;overflow:hidden;mso-hide:all">
    Vielen Dank für Ihre Nachricht an ${e(input.business.name)}. Wir haben Ihre Anfrage erhalten.
  </div>
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background-color:#f4f1eb">
    <tr>
      <td align="center" style="padding:32px 14px">
        <table role="presentation" width="600" cellspacing="0" cellpadding="0" border="0" style="width:100%;max-width:600px;background-color:#ffffff;border:1px solid #e3ded6;border-radius:14px;overflow:hidden;box-shadow:0 4px 18px rgba(0,0,0,0.04)">
          ${renderHeader('Nachricht erhalten', 'Wir kümmern uns um Ihr Anliegen', input.business)}

          <!-- Content -->
          <tr>
            <td style="padding:32px 32px 14px">
              <div style="font-size:16px;color:#1d3543;font-weight:600;margin-bottom:16px">
                Hallo ${e(firstName)},
              </div>
              <p style="margin:0 0 18px;font-size:15px;line-height:1.6;color:#24343f">
                vielen Dank für Ihre Kontaktaufnahme. Wir haben Ihre Nachricht erfolgreich erhalten und werden Ihr Anliegen schnellstmöglich bearbeiten.
              </p>

              <!-- Recap Box -->
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color:#f8f9fa;border:1px solid #e5e9ec;border-left:4px solid #ff601f;border-radius:8px;margin-bottom:20px">
                <tr>
                  <td style="padding:16px 20px">
                    <div style="font-size:11px;font-weight:700;color:#ff601f;letter-spacing:1px;text-transform:uppercase;margin-bottom:6px">
                      Ihre übermittelte Nachricht
                    </div>
                    <div style="font-size:14px;font-weight:bold;color:#1d3543;margin-bottom:8px">
                      Betreff: ${e(input.subject)}
                    </div>
                    <div style="font-size:13px;color:#50626d;line-height:1.6;white-space:pre-wrap">
                      ${e(input.message)}
                    </div>
                  </td>
                </tr>
              </table>

              <p style="margin:0;font-size:14px;line-height:1.6;color:#50626d">
                Sollte es sich um einen dringenden Notfall oder eine Pannenhilfe handeln, erreichen Sie uns am schnellsten telefonisch.
              </p>
            </td>
          </tr>

          <!-- Contact action -->
          ${input.business.phone ? `
          <tr>
            <td style="padding:4px 32px 28px">
              <table role="presentation" cellspacing="0" cellpadding="0">
                <tr>
                  <td bgcolor="#ff601f" style="border-radius:8px">
                    <a href="tel:${e(input.business.phone.replace(/[^+\d]/g, ''))}" style="display:inline-block;padding:12px 20px;color:#ffffff;font-size:13px;font-weight:bold;text-decoration:none">
                      📞 Werkstatt anrufen (${e(input.business.phone)})
                    </a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          ` : ''}

          ${renderFooter(input.business)}
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}


export function renderBusinessContactEmail(input: BusinessContactInput): string {
  const e = escape;
  const emailLink = `mailto:${encodeURIComponent(input.customer.email)}?subject=${encodeURIComponent(`Re: ${input.subject}`)}`;

  return `<!doctype html>
<html lang="de">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>Neue Kontaktanfrage</title>
</head>
<body style="margin:0;padding:0;background-color:#f4f1eb;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#1d3543">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background-color:#f4f1eb">
    <tr>
      <td align="center" style="padding:28px 12px">
        <table role="presentation" width="600" cellspacing="0" cellpadding="0" border="0" style="width:100%;max-width:600px;background-color:#ffffff;border:1px solid #e6e1d8;border-radius:14px;overflow:hidden">
          <tr>
            <td style="padding:28px 28px;background-color:#1d3543;border-top:5px solid #ff601f">
              <p style="margin:0 0 6px;font-size:10px;font-weight:bold;letter-spacing:1.5px;color:#ffb36b;text-transform:uppercase">Kontaktformular</p>
              <h1 style="margin:0;color:#ffffff;font-size:26px;font-weight:700">Neue Nachricht eingegangen</h1>
              <p style="margin:8px 0 0;color:#c7d3db;font-size:13px">Von ${e(input.customer.name)} (${e(input.customer.email)})</p>
            </td>
          </tr>
          <tr>
            <td style="padding:24px 28px 0">
              <div style="font-size:13px;font-weight:bold;color:#70808a;text-transform:uppercase;letter-spacing:1px;margin-bottom:6px">Betreff:</div>
              <div style="font-size:17px;font-weight:bold;color:#1d3543;margin-bottom:18px">${e(input.subject)}</div>
              <div style="font-size:13px;font-weight:bold;color:#70808a;text-transform:uppercase;letter-spacing:1px;margin-bottom:6px">Nachricht:</div>
              <div style="padding:16px;background-color:#f6f8f9;border-left:3px solid #ff601f;border-radius:6px;font-size:14px;color:#24343f;line-height:1.65;white-space:pre-wrap">
                ${e(input.message)}
              </div>
            </td>
          </tr>
          <tr>
            <td style="padding:24px 28px">
              <table role="presentation" cellspacing="0" cellpadding="0">
                <tr>
                  <td bgcolor="#ff601f" style="border-radius:8px">
                    <a href="${e(emailLink)}" style="display:inline-block;padding:12px 22px;color:#ffffff;font-size:13px;font-weight:bold;text-decoration:none">
                      Antworten via E-Mail &rarr;
                    </a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td style="padding:16px 28px;background-color:#edf1f2;border-top:1px solid #e1e7e9;border-bottom-left-radius:14px;border-bottom-right-radius:14px">
              <p style="margin:0;font-size:11px;color:#61727d">
                ${e(input.businessName)} · Website Kontaktformular
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}
