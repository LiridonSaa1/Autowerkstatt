import { useEffect, useState } from 'react';
import { useInfiniteQuery, useQuery } from '@tanstack/react-query';
import { Link } from 'wouter';
import { customFetch } from '@workspace/api-client-react';
import { markActivityInternal } from '@/lib/checkout-activity';
import { ArrowLeft, ChevronDown, RefreshCw } from 'lucide-react';

type Event = { id: string; kind: string; occurredAt: string; source: 'client' | 'server'; vin: string | null; code: string | null };
type Session = { sessionId: string; firstAt: string; lastAt: string; eventCount: number; vins: string[]; countries: string[]; internal: boolean; bot: boolean; confirmed: boolean; failed: boolean; started: boolean; orderSaved: boolean };
type Result = { summary: { sessions: number; visits: number; vinSearches: number; paymentAttempts: number; purchases: number; orders: number; errors: number }; sessions: Session[]; page: number; pageSize: number };
const labels: Record<string, string> = {
  visit: 'Website besucht', vin_search_started: 'FIN-Suche gestartet', vin_search_succeeded: 'FIN-Suche erfolgreich',
  vin_search_failed: 'FIN-Suche fehlgeschlagen', checkout_started: 'Checkout geöffnet', checkout_error: 'Checkout-Fehler',
  payment_started: 'Zahlung gestartet', payment_failed: 'Zahlung fehlgeschlagen', payment_confirmed: 'Zahlung bestätigt', order_saved: 'Bestellung gespeichert',
};
const codes: Record<string, string> = { network_error: 'Netzwerkfehler', invalid_vin: 'Ungültige FIN', not_found: 'Keine Ergebnisse', provider_error: 'Anbieterfehler', validation_error: 'Validierungsfehler' };
const field = 'min-h-11 w-full min-w-0 border border-border bg-white px-3 text-sm';
function berlinDate(date: Date) { return new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Berlin', year: 'numeric', month: '2-digit', day: '2-digit' }).format(date); }
function time(value: string) { return new Intl.DateTimeFormat('de-DE', { timeZone: 'Europe/Berlin', dateStyle: 'short', timeStyle: 'medium' }).format(new Date(value)); }
function initialFilters() {
  const params = new URLSearchParams(window.location.search);
  return { from: params.get('from') || berlinDate(new Date(Date.now() - 6 * 86400_000)), to: params.get('to') || berlinDate(new Date()),
    country: params.get('country') || '', vin: params.get('vin') || '', hideInternal: params.get('hideInternal') !== 'false', hideBots: params.get('hideBots') !== 'false' };
}
type Filters = ReturnType<typeof initialFilters>;
function paramsFor(filters: Filters, page: number) {
  const params = new URLSearchParams({ from: filters.from, to: filters.to, hideInternal: String(filters.hideInternal), hideBots: String(filters.hideBots), page: String(page) });
  if (filters.country) params.set('country', filters.country);
  if (filters.vin) params.set('vin', filters.vin);
  return params.toString();
}
function Timeline({ sessionId }: { sessionId: string }) {
  const query = useInfiniteQuery({ queryKey: ['checkout-timeline', sessionId], initialPageParam: undefined as string | undefined,
    queryFn: ({ pageParam, signal }) => customFetch<{ timeline: Event[]; hasMore: boolean; after: string | null }>(`/api/admin/checkout-activity/sessions/${sessionId}${pageParam ? `?after=${pageParam}` : ''}`, { signal, responseType: 'json' }),
    getNextPageParam: last => last.hasMore ? last.after || undefined : undefined, staleTime: 10000,
  });
  if (query.isPending) return <p role="status" className="p-4 text-sm">Timeline wird geladen…</p>;
  if (query.isError) return <p role="alert" className="p-4 text-sm text-destructive">Timeline nicht verfügbar. <button onClick={() => void query.refetch()} className="underline">Erneut versuchen</button></p>;
  const events = query.data.pages.flatMap(page => page.timeline);
  return <div className="border-t border-border p-4 sm:p-6">
    <p className="mb-4 text-xs text-muted-foreground">Vollständiger aufgezeichneter Verlauf dieses Sitzungs-IDs, auch außerhalb der Filterzeit. Zeiten: Europe/Berlin.</p>
    <ol className="space-y-4 border-l-2 border-border pl-4">{events.map(event => <li key={event.id} className="relative text-sm">
      <span className={`absolute -left-[23px] top-1 h-3 w-3 ${event.kind.includes('failed') || event.kind === 'checkout_error' ? 'bg-destructive' : event.kind === 'payment_confirmed' ? 'bg-emerald-600' : 'bg-accent'}`} />
      <div className="flex flex-wrap items-center justify-between gap-2"><strong className="font-medium">{labels[event.kind] || event.kind}</strong><time className="text-xs text-muted-foreground" dateTime={event.occurredAt}>{time(event.occurredAt)}</time></div>
      <p className="mt-1 text-xs text-muted-foreground">{event.source === 'server' ? 'Serverbestätigtes Ereignis' : 'Browser-Beobachtung, kein Zahlungsnachweis'}{event.vin ? ` · FIN ${event.vin}` : ''}{event.code ? ` · ${codes[event.code] || 'Fehler'}` : ''}</p>
    </li>)}</ol>
    {query.hasNextPage && <button className="mt-5 min-h-11 border border-border px-4 text-sm" disabled={query.isFetchingNextPage} onClick={() => void query.fetchNextPage()}>Weitere Ereignisse laden</button>}
  </div>;
}
export default function CheckoutActivityPage() {
  const [filters, setFilters] = useState(initialFilters);
  const [draft, setDraft] = useState(filters);
  const [page, setPage] = useState(1);
  const [expanded, setExpanded] = useState<string | null>(null);
  const query = useQuery({ queryKey: ['checkout-activity', filters, page],
    queryFn: ({ signal }) => customFetch<Result>(`/api/admin/checkout-activity?${paramsFor(filters, page)}`, { signal, responseType: 'json' }),
    retry: false, refetchInterval: 30000,
  });
  useEffect(() => {
    if (!query.isSuccess) return;
    const sessionId = markActivityInternal();
    void customFetch('/api/admin/checkout-activity/internal', { method: 'POST', body: JSON.stringify({ sessionId }) }).catch(() => {});
  }, [query.isSuccess]);
  const status = (query.error as { status?: number } | null)?.status;
  const summary = query.data?.summary;
  return <main className="min-h-screen bg-background px-3 py-6 text-foreground sm:px-6 lg:px-10">
    <div className="mx-auto max-w-[1440px]">
      <Link href="/admin" className="inline-flex min-h-11 items-center gap-2 text-sm text-muted-foreground"><ArrowLeft size={17} />Zur Verwaltung</Link>
      <header className="my-6 flex flex-wrap items-end justify-between gap-4"><div><h1 className="font-display text-3xl uppercase sm:text-4xl">Checkout-Aktivität</h1><p className="mt-3 max-w-3xl text-sm leading-6 text-muted-foreground">Sitzungen von der FIN-Suche bis zur Zahlung. Browser-Beobachtungen und serverbestätigte Fakten werden getrennt.</p></div><button onClick={() => void query.refetch()} className="inline-flex min-h-11 items-center gap-2 border border-border bg-white px-4 text-sm"><RefreshCw size={16} />Aktualisieren</button></header>
      <div className="mb-6 border-l-2 border-accent bg-card p-4 text-sm leading-6">In diesem Projekt sind derzeit keine FIN-Suche und keine Stripe-Zahlung integriert. Deshalb werden dafür keine Ereignisse erfunden. „Bestellung gespeichert“ und „Zahlung bestätigt“ sind getrennte Fakten; eine Reservierung oder das Öffnen von Stripe ist keine bestätigte Zahlung.</div>
      {status === 401 || status === 403 ? <section role="alert" className="border border-border bg-white p-6"><h2 className="text-lg font-semibold">Nur für Administratoren</h2><p className="my-3 text-sm">Bitte mit dem autorisierten Administratorkonto anmelden.</p><Link href="/sign-in" className="inline-flex min-h-11 items-center bg-accent px-5 text-white">Anmelden</Link></section> : <>
        <form className="grid gap-4 border border-border bg-card p-4 sm:grid-cols-2 lg:grid-cols-4" onSubmit={event => { event.preventDefault(); setFilters(draft); setPage(1); setExpanded(null); window.history.replaceState(null, '', `${window.location.pathname}?${paramsFor(draft, 1)}`); }}>
          <label className="grid gap-2 text-xs">Von<input className={field} type="date" required value={draft.from} max={draft.to} onChange={e => setDraft({ ...draft, from: e.target.value })} /></label>
          <label className="grid gap-2 text-xs">Bis<input className={field} type="date" required min={draft.from} value={draft.to} onChange={e => setDraft({ ...draft, to: e.target.value })} /></label>
          <label className="grid gap-2 text-xs">Land (ISO-Code)<input className={field} placeholder="DE, XK …" pattern="[A-Z]{2}" maxLength={2} value={draft.country} onChange={e => setDraft({ ...draft, country: e.target.value.toUpperCase() })} /></label>
          <label className="grid gap-2 text-xs">FIN / VIN (auch Präfix)<input className={field} maxLength={17} pattern="[A-HJ-NPR-Z0-9]{1,17}" placeholder="FIN filtern" value={draft.vin} onChange={e => setDraft({ ...draft, vin: e.target.value.toUpperCase().trim() })} /></label>
          <label className="flex min-h-11 items-center gap-2 text-sm"><input type="checkbox" className="h-4 w-4 accent-orange-600" checked={draft.hideInternal} onChange={e => setDraft({ ...draft, hideInternal: e.target.checked })} />Internen Traffic ausblenden</label>
          <label className="flex min-h-11 items-center gap-2 text-sm"><input type="checkbox" className="h-4 w-4 accent-orange-600" checked={draft.hideBots} onChange={e => setDraft({ ...draft, hideBots: e.target.checked })} />Erkannte Bots ausblenden</label>
          <p className="text-xs leading-5 text-muted-foreground">Maximal 93 Tage. Zeitzone: Europe/Berlin. Ohne vertrauenswürdige Geodaten bleibt das Land unbekannt.</p>
          <button className="min-h-11 bg-accent px-5 text-sm text-white">Filter anwenden</button>
        </form>
        {query.isPending && <p role="status" className="py-8">Aktivität wird geladen…</p>}
        {query.isError && <p role="alert" className="my-5 border border-destructive/30 bg-card p-4 text-sm text-destructive">{status === 400 ? 'Ungültige Filter. Bitte Datumsbereich (max. 93 Tage), Land und FIN prüfen.' : 'Aktivität konnte nicht geladen werden. Verbindung und Datenbankmigration prüfen.'} <button className="underline" onClick={() => void query.refetch()}>Erneut versuchen</button></p>}
        {summary && <>
          <div className="my-6 grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-7">{([
            ['Sitzungen', summary.sessions], ['Besuche', summary.visits], ['FIN-Suchen', summary.vinSearches], ['Zahlungsversuche', summary.paymentAttempts], ['Bestätigte Käufe', summary.purchases], ['Gespeicherte Bestellungen', summary.orders], ['Fehler', summary.errors],
          ] as const).map(([label, value]) => <article key={label} className="min-w-0 border border-border bg-white p-4"><p className="text-xs leading-5 text-muted-foreground">{label}</p><p className="mt-3 text-3xl tabular-nums">{value}</p></article>)}</div>
          <p className="mb-4 text-xs leading-5 text-muted-foreground">Statistik über alle gefilterten Ereignisse, nicht nur diese Seite. Besuche zählen eindeutige Sitzungen; Käufe eindeutige serverbestätigte Zahlungsreferenzen. Fehlende Ereignisse belegen keinen Abbruch.</p>
          <div className="space-y-3">{query.data?.sessions.map(session => {
            const inactive = Date.now() - Date.parse(session.lastAt) > 30 * 60_000;
            return <article key={session.sessionId} className="min-w-0 border border-border bg-white">
              <button type="button" aria-expanded={expanded === session.sessionId} onClick={() => setExpanded(expanded === session.sessionId ? null : session.sessionId)} className="flex w-full min-w-0 flex-col gap-3 p-4 text-left sm:flex-row sm:justify-between sm:p-5">
                <div className="min-w-0"><p className="break-all font-mono text-xs">{session.sessionId}</p><p className="mt-2 text-xs text-muted-foreground">{time(session.firstAt)} – {time(session.lastAt)} · {session.eventCount} Ereignisse</p><p className="mt-2 break-all text-xs">FIN: {session.vins.join(', ') || '–'} · Land: {session.countries.join(', ') || 'Unbekannt'}{session.internal ? ' · Intern' : ''}{session.bot ? ' · Bot erkannt' : ''}</p></div>
                <div className="flex shrink-0 flex-wrap items-center gap-2 text-xs"><span className={`border px-2 py-1 ${session.confirmed ? 'border-emerald-600 text-emerald-700' : session.failed ? 'border-destructive text-destructive' : 'border-border'}`}>{session.confirmed ? 'Zahlung bestätigt' : session.failed ? 'Zahlung fehlgeschlagen' : session.started ? 'Zahlung gestartet, nicht bestätigt' : 'Keine Zahlung bestätigt'}</span>{session.orderSaved && <span className="border border-border px-2 py-1">Bestellung gespeichert</span>}<ChevronDown size={17} /></div>
              </button>
              {expanded === session.sessionId && <>
                <div className="border-t border-border px-4 py-3 text-xs leading-6 sm:px-6"><p className="font-semibold">Fakten: {session.confirmed ? 'Zahlung serverseitig bestätigt.' : session.failed ? 'Mindestens ein Zahlungsfehler aufgezeichnet. Keine bestätigte Zahlung aufgezeichnet.' : session.started ? 'Zahlungsversuch serverseitig gestartet. Keine Bestätigung aufgezeichnet.' : 'Keine serverbestätigte Zahlung aufgezeichnet.'} {session.orderSaved ? 'Bestellung wurde gespeichert.' : 'Keine gespeicherte Bestellung aufgezeichnet.'}</p><p className="mt-2 text-muted-foreground">{!session.confirmed && inactive ? 'Vermutung: möglicher Abbruch nach über 30 Minuten ohne weiteres Ereignis. Der tatsächliche Grund ist unbekannt.' : 'Kein Abbruchgrund bestätigt.'}</p>{session.confirmed && !session.orderSaved && <p className="mt-2 text-accent">Prüfen: Zahlung bestätigt, aber keine gespeicherte Bestellung aufgezeichnet.</p>}</div>
                <Timeline sessionId={session.sessionId} />
              </>}
            </article>;
          })}</div>
          {!query.data?.sessions.length && <p className="border border-dashed border-border p-8 text-center text-sm text-muted-foreground">Keine Ereignisse für diese Filter. Die Erfassung beginnt erst mit dieser Änderung; interne Besuche sind standardmäßig ausgeblendet.</p>}
          <nav aria-label="Sitzungsseiten" className="mt-6 flex items-center justify-between gap-3"><button className="min-h-11 border border-border px-4 text-sm disabled:opacity-40" disabled={page === 1} onClick={() => { setPage(page - 1); setExpanded(null); }}>Zurück</button><span className="text-xs">Seite {page} / {Math.max(1, Math.ceil(summary.sessions / 25))}</span><button className="min-h-11 border border-border px-4 text-sm disabled:opacity-40" disabled={page * 25 >= summary.sessions} onClick={() => { setPage(page + 1); setExpanded(null); }}>Weiter</button></nav>
        </>}
      </>}
    </div>
  </main>;
}
