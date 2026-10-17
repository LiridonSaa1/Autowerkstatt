import { useEffect, useState, type FormEvent } from 'react';
import { customFetch } from '@workspace/api-client-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Eye, EyeOff, LockKeyhole, Plug, ShieldCheck } from 'lucide-react';
const inputClass = 'w-full rounded-xl border border-border bg-background px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-ring';
function errorMessage(error: unknown, fallback: string) {
  const data = (error as { data?: { error?: unknown } } | null)?.data;
  return typeof data?.error === 'string' ? data.error : error instanceof Error ? error.message : fallback;
}
export function IntegrationUnlock({ open, onClose, onUnlock }: { open: boolean; onClose: () => void; onUnlock: (token: string, expires: number) => void }) {
  const [password, setPassword] = useState(''); const [busy, setBusy] = useState(false); const [error, setError] = useState('');
  useEffect(() => { if (open) { setPassword(''); setError(''); } }, [open]);
  async function submit(event: FormEvent) {
    event.preventDefault(); setBusy(true); setError('');
    try {
      const result = await customFetch<{ token: string; expires: number }>('/api/admin/integrations/unlock', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ password }) });
      setPassword(''); onUnlock(result.token, result.expires);
    } catch (error) { setError(errorMessage(error, 'Die Überprüfung ist fehlgeschlagen.')); }
    finally { setBusy(false); }
  }
  return <Dialog open={open} onOpenChange={value => { if (!value && !busy) onClose(); }}><DialogContent className="max-w-md rounded-2xl"><DialogHeader><LockKeyhole className="mb-3 text-accent" size={28} /><DialogTitle>API-Integrationen</DialogTitle><DialogDescription>Geben Sie das Passwort für die API-Integrationen ein, um die Zugangsdaten zu verwalten.</DialogDescription></DialogHeader><form onSubmit={submit} className="grid gap-4"><label className="grid gap-2 text-xs font-semibold">Passwort<input autoFocus required type="password" autoComplete="current-password" maxLength={1024} value={password} onChange={event => setPassword(event.target.value)} className={inputClass} /></label>{error && <p role="alert" className="text-xs text-destructive">{error}</p>}<button disabled={busy} className="rounded-xl bg-primary px-4 py-3 text-sm font-bold text-primary-foreground disabled:opacity-50">{busy ? 'Wird überprüft…' : 'Integrationen öffnen'}</button></form></DialogContent></Dialog>;
}
type Config = { brevoKey: string; brevoFrom: string; supabaseUrl: string; supabaseKey: string; supabaseServiceKey: string; twilioSid: string; twilioToken: string; twilioFrom: string };
const empty: Config = { brevoKey: '', brevoFrom: '', supabaseUrl: '', supabaseKey: '', supabaseServiceKey: '', twilioSid: '', twilioToken: '', twilioFrom: '' };
const groups: { id: string; title: string; description: string; fields: { key: keyof Config; label: string; type?: string; secret?: boolean }[] }[] = [
  { id: 'brevo', title: 'Brevo · E-Mail', description: 'Versendet Angebote und Antworten über Brevo. Verwenden Sie einen API-v3-Schlüssel (keinen SMTP-Schlüssel) und eine in Brevo bestätigte Absenderadresse.', fields: [{ key: 'brevoKey', label: 'API Key', secret: true }, { key: 'brevoFrom', label: 'Absender-E-Mail', type: 'email' }] },
  { id: 'supabase', title: 'Supabase · API', description: 'Die Supabase-URL und Schlüssel werden in die Felder geladen und verschlüsselt in der Supabase-Datenbank gespeichert.', fields: [{ key: 'supabaseUrl', label: 'Projekt-URL', type: 'url' }, { key: 'supabaseKey', label: 'Publishable / Anon Key', secret: true }, { key: 'supabaseServiceKey', label: 'Service Role / Secret Key (optional, nur Server)', secret: true }] },
  { id: 'twilio', title: 'Twilio · SMS', description: 'Speichern und prüfen Sie die Twilio-Verbindung. Automatische SMS werden dadurch nicht aktiviert.', fields: [{ key: 'twilioSid', label: 'Account SID' }, { key: 'twilioToken', label: 'Auth Token', secret: true }, { key: 'twilioFrom', label: 'Absendernummer (+49…)', type: 'tel' }] },
];
export default function IntegrationsPanel({ token, onLock }: { token: string; onLock: () => void }) {
  const [visibleKeys, setVisibleKeys] = useState<Record<string, boolean>>({});
  const [config, setConfig] = useState<Config>(empty); const [configured, setConfigured] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(true); const [busy, setBusy] = useState(''); const [notice, setNotice] = useState(''); const [error, setError] = useState('');
  const headers = { 'Content-Type': 'application/json', 'X-Integrations-Token': token };
  async function load() {
    const result = await customFetch<Config & { configured: Record<string, boolean> }>('/api/admin/integrations', { headers });
    const { configured: flags, ...values } = result; setConfig(values); setConfigured(flags);
  }
  useEffect(() => { let active = true; load().catch(error => { if (active) setError(errorMessage(error, 'Die Konfiguration konnte nicht geladen werden.')); }).finally(() => { if (active) setLoading(false); }); return () => { active = false; }; }, [token]);
  async function save(event: FormEvent) {
    event.preventDefault(); setBusy('save'); setNotice(''); setError('');
    try { await customFetch('/api/admin/integrations', { method: 'PUT', headers, body: JSON.stringify(config) }); await load(); setNotice('Die Zugangsdaten wurden in Supabase gespeichert.'); }
    catch (error) { setError(errorMessage(error, 'Das Speichern ist fehlgeschlagen.')); }
    finally { setBusy(''); }
  }
  async function test(provider: string) {
    setBusy(provider); setNotice(''); setError('');
    try { const result = await customFetch<{ message: string }>(`/api/admin/integrations/test/${provider}`, { method: 'POST', headers }); setNotice(result.message); }
    catch (error) { setError(errorMessage(error, 'Die Prüfung ist fehlgeschlagen.')); }
    finally { setBusy(''); }
  }
  return <div className="space-y-6"><div className="flex flex-wrap items-center justify-between gap-4"><div><h2 className="flex items-center gap-3 text-2xl font-bold"><Plug size={24} />API-Verbindungen</h2><p className="mt-2 text-sm text-muted-foreground">Konfigurieren Sie Brevo, Supabase und Twilio.</p></div><button type="button" onClick={onLock} className="flex items-center gap-2 rounded-xl border border-border bg-card px-4 py-2 text-xs font-bold"><LockKeyhole size={15} />Integrationen sperren</button></div><p className="flex items-center gap-3 rounded-2xl border border-border bg-card p-4 text-xs text-muted-foreground"><ShieldCheck className="shrink-0 text-emerald-600" size={18} />Die Zugangsdaten werden in Supabase verschlüsselt gespeichert. Leere Schlüsselfelder behalten den vorhandenen Wert. Der Zugriff endet nach 10 Minuten.</p>
    {loading ? <p role="status">Konfiguration wird geladen…</p> : <form onSubmit={save} className="rounded-2xl border border-border bg-card p-6 shadow-sm md:p-8"><div className="divide-y divide-border">{groups.map(group => <section key={group.id} className="py-6 first:pt-0"><h3 className="border-b border-border pb-3 text-sm font-bold">{group.title}</h3><p className="my-4 text-xs leading-6 text-muted-foreground">{group.description}</p><div className="grid gap-4">{group.fields.map(field => <label key={field.key} className="grid gap-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{field.label}{configured[field.key] && <span className="text-[10px] normal-case text-emerald-700">Schlüssel gespeichert</span>}<div className="relative"><input disabled={Boolean(busy)} type={field.secret && !visibleKeys[field.key] ? 'password' : field.type || 'text'} autoComplete="off" spellCheck={false} maxLength={3000} value={config[field.key]} placeholder={field.secret && configured[field.key] ? '•••••••• (leer lassen, um den Schlüssel beizubehalten)' : ''} onChange={event => setConfig(current => ({ ...current, [field.key]: event.target.value }))} className={`${inputClass} ${field.secret ? 'pr-12' : ''}`} />{field.secret && <button type="button" onClick={() => setVisibleKeys(current => ({ ...current, [field.key]: !current[field.key] }))} aria-label={`${visibleKeys[field.key] ? 'Ausblenden' : 'Anzeigen'} ${field.label}`} aria-pressed={Boolean(visibleKeys[field.key])} className="absolute right-3 top-1/2 -translate-y-1/2 rounded p-1 text-muted-foreground">{visibleKeys[field.key] ? <EyeOff size={17} /> : <Eye size={17} />}</button>}</div></label>)}</div><button type="button" disabled={Boolean(busy)} onClick={() => void test(group.id)} className="mt-4 rounded-xl border border-border bg-muted/40 px-4 py-2.5 text-xs font-semibold disabled:opacity-50">{busy === group.id ? 'Wird geprüft…' : `Prüfen ${group.title.split(' · ')[0]} gespeichert`}</button></section>)}</div><div className="flex flex-wrap items-center gap-4 border-t border-border pt-5"><button disabled={Boolean(busy)} className="rounded-xl bg-primary px-5 py-3 text-xs font-bold text-primary-foreground disabled:opacity-50">{busy === 'save' ? 'Wird gespeichert…' : 'Zugangsdaten speichern'}</button><span className="text-xs text-muted-foreground">Speichern Sie die Änderungen vor der Prüfung.</span></div></form>}
    {notice && <p role="status" className="rounded-xl bg-emerald-100 p-4 text-sm text-emerald-800">{notice}</p>}{error && <p role="alert" className="rounded-xl border border-destructive/30 p-4 text-sm text-destructive">{error}</p>}
  </div>;
}
