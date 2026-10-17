import { type FormEvent, useEffect, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { customFetch } from '@workspace/api-client-react';
import { Eye, Search, Send, X } from 'lucide-react';
type Quote = { id: number; name: string; email: string; phone: string; vehicle: string; parts: string; preferredDate: string; status: string; sentAt: string | null };
const statuses = { new: 'Neu', contacted: 'Kontaktiert', quoted: 'Angebot erstellt', accepted: 'Angenommen', rejected: 'Abgelehnt' };
const field = 'w-full rounded-xl border border-border bg-background px-3 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring';
const request = <T,>(url: string, method: string, data: unknown) => customFetch<T>(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) });
export function QuoteRequestForm() {
  const [success, setSuccess] = useState(false);
  const mutation = useMutation({ mutationFn: (data: Record<string, FormDataEntryValue>) => request('/api/quotes', 'POST', data) });
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); const form = event.currentTarget;
    setSuccess(false);
    mutation.mutate(Object.fromEntries(new FormData(form)), { onSuccess: () => { form.reset(); setSuccess(true); } });
  }
  return <section id="angebote" className="scroll-mt-20 px-5 py-20 md:px-10"><div className="mx-auto grid max-w-[1340px] gap-10 lg:grid-cols-2"><div><span className="eyebrow text-accent">Angebot anfragen</span><h2 className="mt-5 font-display text-5xl font-bold uppercase">Was kostet der Austausch?</h2><p className="mt-5 max-w-md text-sm leading-7 text-muted-foreground">Nennen Sie uns Ihr Fahrzeug und die Teile, die Sie austauschen lassen möchten. Sie erhalten Ihr Angebot per E-Mail.</p></div><form onSubmit={submit} className="grid gap-4 rounded-2xl border border-border bg-card p-6 sm:grid-cols-2">
    {[['name', 'Vor- und Nachname', 'text', 120], ['email', 'E-Mail', 'email', 254], ['phone', 'Telefon', 'tel', 40], ['vehicle', 'Fahrzeug / Modell / Baujahr / FIN', 'text', 240]].map(([name, label, type, max]) => <label key={name} className="grid gap-2 text-xs font-semibold">{label}<input required name={String(name)} type={String(type)} maxLength={Number(max)} minLength={name === 'phone' ? 5 : 2} className={field} /></label>)}
    <label className="grid gap-2 text-xs font-semibold sm:col-span-2">Gewünschte Teile und Arbeiten<textarea required minLength={5} maxLength={3000} name="parts" rows={4} placeholder="z. B. vordere Bremsscheiben und Bremsbeläge…" className={field} /></label>
    <label className="grid gap-2 text-xs font-semibold sm:col-span-2">Wunschtermin (optional)<input name="preferredDate" type="date" className={field} /></label>
    <button disabled={mutation.isPending} className="rounded-xl bg-emerald-600 px-5 py-3 text-sm font-bold text-white hover:bg-emerald-700 disabled:opacity-50 sm:col-span-2">{mutation.isPending ? 'Wird gesendet…' : 'Angebot anfragen'}</button>
    {success && <p className="text-sm text-emerald-700 sm:col-span-2" role="status">Ihre Anfrage wurde gespeichert. Wir antworten Ihnen per E-Mail.</p>}{mutation.isError && <p role="alert" className="text-sm text-destructive sm:col-span-2">Die Anfrage konnte nicht gesendet werden. Bitte versuchen Sie es erneut.</p>}
  </form></div></section>;
}
export function AdminQuotes() {
  const client = useQueryClient();
  const query = useQuery({ queryKey: ['admin-quotes'], queryFn: () => customFetch<Quote[]>('/api/admin/quotes') });
  const sender = useQuery({ queryKey: ['quote-sender'], queryFn: () => customFetch<{ name: string; email: string; configured: boolean }>('/api/admin/quotes/sender') });
  const [filter, setFilter] = useState(''); const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<Quote | null>(null); const [detail, setDetail] = useState<Quote | null>(null);
  const [email, setEmail] = useState(''); const [subject, setSubject] = useState(''); const [message, setMessage] = useState(''); const [price, setPrice] = useState(''); const [notice, setNotice] = useState('');
  const closeRef = useRef<HTMLButtonElement>(null);
  const mutation = useMutation({ mutationFn: ({ id, status }: { id: number; status: string }) => request(`/api/admin/quotes/${id}`, 'PATCH', { status }), onSuccess: () => client.invalidateQueries({ queryKey: ['admin-quotes'] }) });
  const send = useMutation({ mutationFn: () => request(`/api/admin/quotes/${selected!.id}/send`, 'POST', { email, subject, message }), onSuccess: () => { setSelected(null); setNotice('Ihr Angebot wurde vom E-Mail-Dienst zum Versand angenommen.'); void client.invalidateQueries({ queryKey: ['admin-quotes'] }); } });
  const modalOpen = Boolean(selected || detail);
  useEffect(() => {
    if (!modalOpen) return;
    const previous = document.activeElement as HTMLElement | null;
    closeRef.current?.focus();
    const handler = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !send.isPending) { setSelected(null); setDetail(null); }
      if (event.key === 'Tab') {
        const nodes = Array.from(document.querySelectorAll<HTMLElement>('[role="dialog"] button:not(:disabled), [role="dialog"] input, [role="dialog"] textarea, [role="dialog"] a'));
        const first = nodes[0], last = nodes[nodes.length - 1];
        if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
        else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
      }
    };
    document.addEventListener('keydown', handler); return () => { document.removeEventListener('keydown', handler); previous?.focus(); };
  }, [modalOpen, send.isPending]);
  function open(quote: Quote) {
    send.reset(); setSelected(quote); setEmail(quote.email); setPrice('');
    setSubject(`Ihr individuelles Angebot – ${sender.data?.name || 'KFZ-Service'}`);
    setMessage(`Guten Tag ${quote.name},\n\nvielen Dank für Ihre Anfrage!\n\nGerne bieten wir Ihnen folgende Arbeiten an:\n\nFAHRZEUG: ${quote.vehicle}\nTEILE / ARBEITEN: ${quote.parts}\nWUNSCHTERMIN: ${quote.preferredDate || 'Nach Vereinbarung'}\n\nGESAMTPREIS: [Bitte Preis ergänzen]\n\nBei Fragen stehen wir Ihnen gerne zur Verfügung.\n\nMit freundlichen Grüßen\n${sender.data?.name || 'KFZ-Service'}`);
  }
  const rows = (query.data ?? []).filter(q => (!filter || q.status === filter) && `${q.name} ${q.email} ${q.vehicle} ${q.parts}`.toLowerCase().includes(search.toLowerCase()));
  return <div className="space-y-6"><div><h2 className="font-display text-3xl font-bold">Angebote & Offerten-Anfragen</h2><p className="mt-2 text-xs text-muted-foreground">Preisanfragen für Ersatzteile und Werkstattleistungen.</p></div>
    {notice && <p role="status" className="rounded-xl bg-emerald-100 p-4 text-sm text-emerald-800">{notice}</p>}
    {mutation.isError && <p role="alert" className="text-sm text-destructive">Der Status konnte nicht gespeichert werden. Bitte versuchen Sie es erneut.</p>}
    <div className="flex flex-wrap justify-between gap-4"><div className="flex flex-wrap gap-2">{[['', 'Alle Anfragen'], ...Object.entries(statuses)].map(([value, label]) => <button key={value} onClick={() => setFilter(value)} aria-pressed={filter === value} className={`rounded-xl border px-4 py-2 text-xs font-semibold ${filter === value ? 'border-emerald-600 bg-emerald-600 text-white' : 'border-border bg-card'}`}>{label}</button>)}</div><label className="flex items-center gap-2 rounded-full border border-border bg-card px-4"><Search size={15} /><input value={search} onChange={e => setSearch(e.target.value)} aria-label="Angebote suchen" placeholder="Angebote suchen…" className="h-10 bg-transparent text-xs outline-none" /></label></div>
    {query.isLoading ? <p role="status">Anfragen werden geladen…</p> : query.isError ? <p role="alert">Die Anfragen konnten nicht geladen werden. <button className="underline" onClick={() => void query.refetch()}>Erneut versuchen</button></p> : <div className="overflow-x-auto rounded-2xl border border-border bg-card"><table className="w-full min-w-[900px] text-left text-xs"><thead className="border-b border-border bg-muted/30 text-[10px] uppercase tracking-wider text-muted-foreground"><tr>{['Kunde & Kontakt', 'Fahrzeug', 'Teile / Arbeiten', 'Wunschtermin', 'Status', 'Aktionen'].map(t => <th key={t} className="px-5 py-4">{t}</th>)}</tr></thead><tbody className="divide-y divide-border">{rows.map(q => <tr key={q.id}><td className="px-5 py-5"><p className="font-bold">{q.name}</p><a className="mt-1 block text-accent" href={`tel:${q.phone}`}>{q.phone}</a><p className="mt-1 text-muted-foreground">{q.email}</p></td><td className="px-5 py-5">{q.vehicle}</td><td className="max-w-xs whitespace-pre-wrap break-words px-5 py-5">{q.parts}</td><td className="px-5 py-5">{q.preferredDate || '—'}</td><td className="px-5 py-5"><select aria-label={`Status für ${q.name}`} value={q.status} disabled={mutation.isPending} onChange={e => mutation.mutate({ id: q.id, status: e.target.value })} className={`rounded-full px-3 py-2 text-[10px] font-bold ${q.status === 'rejected' ? 'bg-red-100 text-red-800' : q.status === 'new' ? 'bg-amber-100 text-amber-800' : 'bg-emerald-100 text-emerald-800'}`}>{Object.entries(statuses).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select>{q.sentAt && <p className="mt-2 text-[10px] text-muted-foreground">Gesendet: {new Date(q.sentAt).toLocaleDateString('de-DE')}</p>}</td><td className="px-5 py-5"><div className="flex gap-2"><button title="Details ansehen" aria-label={`Anfrage ansehen von ${q.name}`} onClick={() => setDetail(q)} className="rounded-full bg-primary/10 p-2.5 text-primary"><Eye size={15} /></button><button title="Angebot senden" aria-label={`Angebot vorbereiten für ${q.name}`} onClick={() => open(q)} className="rounded-full bg-emerald-100 p-2.5 text-emerald-700"><Send size={15} /></button></div></td></tr>)}{!rows.length && <tr><td colSpan={6} className="py-14 text-center text-muted-foreground">Es gibt keine Anfragen.</td></tr>}</tbody></table></div>}
    {modalOpen && <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-4"><div role="dialog" aria-modal="true" aria-labelledby="quote-dialog-title" className="max-h-[90dvh] w-full max-w-2xl overflow-y-auto rounded-3xl border border-border bg-card p-6 shadow-xl sm:p-8"><div className="flex items-center justify-between border-b border-border pb-4"><h3 id="quote-dialog-title" className="text-lg font-bold">{selected ? 'Angebot per E-Mail senden' : 'Anfragedetails'}</h3><button ref={closeRef} disabled={send.isPending} aria-label="Schließen" onClick={() => { setSelected(null); setDetail(null); }}><X size={18} /></button></div>
      {detail && <dl className="mt-5 grid gap-4">{[['Kunde', detail.name], ['E-Mail', detail.email], ['Telefon', detail.phone], ['Fahrzeug', detail.vehicle], ['Teile / Arbeiten', detail.parts], ['Datum', detail.preferredDate || '—']].map(([label, value]) => <div key={label}><dt className="text-xs text-muted-foreground">{label}</dt><dd className="mt-1 whitespace-pre-wrap break-words text-sm">{value}</dd></div>)}</dl>}
      {selected && <form onSubmit={e => { e.preventDefault(); if (price && !message.includes('[Bitte Preis ergänzen]')) send.mutate(); }} className="mt-5 grid gap-4">
        <label className="grid gap-2 text-xs font-semibold text-muted-foreground">EMPFÄNGER E-MAIL<input type="email" required maxLength={254} value={email} onChange={e => setEmail(e.target.value)} className={field} /></label>
        <label className="grid gap-2 text-xs font-semibold text-muted-foreground">E-MAIL-BETREFF<input required minLength={2} maxLength={200} value={subject} onChange={e => setSubject(e.target.value)} className={field} /></label>
        <label className="grid gap-2 text-xs font-semibold text-muted-foreground">GESAMTPREIS (€)<input type="number" required min="0.01" step="0.01" value={price} onChange={e => { const next = e.target.value; setMessage(current => current.replace(/GESAMTPREIS: [^\n]*/, `GESAMTPREIS: ${next ? `${Number(next).toFixed(2)} €` : '[Bitte Preis ergänzen]'}`)); setPrice(next); }} className={field} /></label>
        <label className="grid gap-2 text-xs font-semibold text-muted-foreground">NACHRICHT<textarea required minLength={10} maxLength={12000} rows={9} value={message} onChange={e => setMessage(e.target.value)} className={field} /></label>
        {sender.data && !sender.data.configured && <p role="status" className="text-xs text-destructive">Konfigurieren Sie Brevo unter API-Integrationen, um E-Mails zu senden.</p>}
        {send.isError && <p role="alert" className="text-xs text-destructive">{send.error.message}</p>}
        <div className="flex flex-wrap items-center justify-end gap-2 border-t border-border pt-4"><p className="mr-auto text-[10px] text-muted-foreground">Absender: {sender.data?.name}<br />{sender.data?.email}</p><a href={`mailto:${encodeURIComponent(email)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(message)}`} className="rounded-xl border border-border px-3 py-3 text-xs">Outlook / Gmail</a><button type="button" disabled={send.isPending} onClick={() => setSelected(null)} className="rounded-xl bg-muted px-3 py-3 text-xs">Abbrechen</button><button disabled={send.isPending || !price || !sender.data?.configured || message.includes('[Bitte Preis ergänzen]')} className="rounded-xl bg-emerald-600 px-4 py-3 text-xs font-bold text-white hover:bg-emerald-700 disabled:opacity-50">{send.isPending ? 'Wird gesendet…' : 'Angebot senden'}</button></div>
      </form>}
    </div></div>}
  </div>;
}
