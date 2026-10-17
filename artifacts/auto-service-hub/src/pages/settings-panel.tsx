import { useState, type FormEvent } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { getGetShopInfoQueryKey, customFetch } from '@workspace/api-client-react';
import { Save, Settings, LoaderCircle } from 'lucide-react';

type SettingsValues = Record<'name' | 'tagline' | 'phone' | 'whatsapp' | 'email' | 'address' | 'city' | 'emergencyPhone' | 'openingHours' | 'mapUrl' | 'facebookUrl' | 'instagramUrl' | 'tiktokUrl', string>;
const groups = [
  { title: 'Social Media', fields: [['facebookUrl', 'Facebook URL'], ['instagramUrl', 'Instagram URL'], ['tiktokUrl', 'TikTok URL']] },
  { title: 'Unternehmensdaten', fields: [['name', 'Unternehmensname'], ['tagline', 'Kurzbeschreibung']] },
  { title: 'Kontaktmöglichkeiten', fields: [['phone', 'Telefonnummer'], ['whatsapp', 'WhatsApp (mit Landesvorwahl)'], ['email', 'Geschäftliche E-Mail-Adresse'], ['emergencyPhone', 'Notfallnummer']] },
  { title: 'Adresse und Öffnungszeiten', fields: [['address', 'Straße und Hausnummer'], ['city', 'Ort und Postleitzahl'], ['openingHours', 'Öffnungszeiten'], ['mapUrl', 'Kartenlink (Google Maps Embed URL)']] },
] as const;
export default function SettingsPanel() {
  const client = useQueryClient();
  const query = useQuery({ queryKey: ['admin-settings'], queryFn: () => customFetch<SettingsValues>('/api/admin/settings', { responseType: 'json' }) });
  const [draft, setDraft] = useState<SettingsValues | null>(null);
  const [saved, setSaved] = useState(false);
  const mutation = useMutation({
    mutationFn: (values: SettingsValues) => customFetch<SettingsValues>('/api/admin/settings', { method: 'PUT', body: JSON.stringify(values), responseType: 'json' }),
    onSuccess: (values) => {
      client.setQueryData(['admin-settings'], values);
      client.setQueryData(getGetShopInfoQueryKey(), values);
      void client.invalidateQueries({ queryKey: getGetShopInfoQueryKey() });
      void client.invalidateQueries({ queryKey: ['quote-sender'] });
      // Notify a public page open in another tab without storing business data locally.
      try { localStorage.setItem('shop-settings-updated', String(Date.now())); } catch { /* Polling remains available. */ }
      setDraft(null); setSaved(true);
    },
  });
  if (query.isPending) return <p role="status" className="p-8">Einstellungen werden geladen…</p>;
  if (query.isError || !query.data) return <div role="alert" className="rounded-none border border-border bg-card p-8">Die Einstellungen konnten nicht geladen werden. <button onClick={() => void query.refetch()} className="text-accent underline">Erneut versuchen</button></div>;
  const values = draft ?? query.data;
  function submit(event: FormEvent) { event.preventDefault(); setSaved(false); mutation.mutate(values); }
  const saveButton = <button type="submit" disabled={mutation.isPending || !draft} className="inline-flex items-center justify-center gap-2 rounded-none bg-accent px-5 py-3 text-xs font-bold text-white disabled:opacity-50">{mutation.isPending ? <LoaderCircle size={16} className="animate-spin" /> : <Save size={16} />}Änderungen speichern</button>;
  return <form onSubmit={submit} className="grid gap-5">
    <div className="flex flex-wrap items-center justify-between gap-4 rounded-none border border-border bg-card p-6">
      <div><h2 className="flex items-center gap-2 font-display text-3xl font-bold uppercase"><Settings size={23} />Website-Einstellungen</h2><p className="mt-2 text-xs text-muted-foreground">Verwalten Sie die Unternehmens- und Kontaktdaten für die gesamte Website.</p></div>{saveButton}
    </div>
    {saved && <p role="status" className="rounded-none border border-emerald-700/20 bg-emerald-700/5 p-4 text-sm text-emerald-800">Die Änderungen wurden gespeichert und auf der Website übernommen.</p>}
    {mutation.isError && <p role="alert" className="rounded-none border border-destructive/30 p-4 text-sm text-destructive">Das Speichern ist fehlgeschlagen. Prüfen Sie die Angaben und Ihre Verbindung und versuchen Sie es erneut.</p>}
    {groups.map((group) => <section key={group.title} className="rounded-none border border-border bg-card p-6">
      <h3 className="mb-5 border-b border-border pb-4 text-sm font-bold">{group.title}</h3>
      <div className="grid gap-5 sm:grid-cols-2">{group.fields.map(([key, label]) => <label key={key} className="grid gap-2 text-[10px] font-bold uppercase tracking-wide text-muted-foreground">{label}<input name={key} type={key === 'email' ? 'email' : key === 'mapUrl' ? 'url' : key === 'phone' || key === 'emergencyPhone' ? 'tel' : 'text'} value={values[key]} required={key === 'name'} maxLength={500} disabled={mutation.isPending} onChange={(event) => { setDraft({ ...values, [key]: event.target.value }); setSaved(false); }} className="h-11 w-full rounded-none border border-border bg-background px-3 text-sm font-normal normal-case tracking-normal text-foreground focus:outline-none focus:ring-2 focus:ring-ring" /></label>)}</div>
    </section>)}
    <div className="flex justify-end">{saveButton}</div>
  </form>;
}
