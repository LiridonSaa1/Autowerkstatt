// Never echo provider payloads, which may contain credential or account details.
export function integrationTestError(provider: string, status: number, body: unknown): string {
  const label = provider === 'brevo' ? 'Brevo' : provider === 'supabase' ? 'Supabase' : 'Twilio';
  if (status === 429) return `${label}: Zu viele Anfragen. Bitte warten Sie kurz und prüfen Sie erneut.`;
  if (status >= 500) return `${label} ist vorübergehend nicht verfügbar. Bitte versuchen Sie es später erneut.`;
  if (provider === 'brevo') {
    if (status === 401) return 'Brevo: Der API-Schlüssel wurde nicht akzeptiert. Verwenden Sie einen aktiven API-v3-Schlüssel aus SMTP & API → API Keys, keinen SMTP-Schlüssel. Speichern Sie ihn vor der Prüfung.';
    if (status === 403) return 'Brevo: Der Zugriff wurde verweigert. Prüfen Sie API-Berechtigungen, Kontofreischaltung und die in Brevo zugelassenen IP-Adressen.';
  }
  if (provider === 'supabase' && (status === 400 || status === 401 || status === 403)) return 'Supabase: Projekt-URL und Publishable / Anon Key wurden nicht akzeptiert. Verwenden Sie die URL und den Schlüssel desselben Projekts und speichern Sie die Änderungen vor der Prüfung.';
  if (provider === 'twilio' && (status === 401 || status === 403)) return 'Twilio: Account SID und Auth Token wurden nicht akzeptiert. Prüfen Sie, ob beide zum selben aktiven Konto gehören.';
  return `${label}: Die Prüfung wurde vom Anbieter abgelehnt (HTTP ${status}). Prüfen Sie die gespeicherten Zugangsdaten und Berechtigungen.`;
}
