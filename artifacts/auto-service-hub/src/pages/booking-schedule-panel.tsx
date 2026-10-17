import { useState, type FormEvent } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { customFetch, getGetAvailabilityQueryKey } from '@workspace/api-client-react';
import { CalendarDays, Clock3, LoaderCircle, Plus, Save, Trash2 } from 'lucide-react';

type WorkingDay = { enabled: boolean; start: string; end: string; breakStart: string; breakEnd: string };
type Schedule = {
  weekly: WorkingDay[]; intervalMinutes: number; advanceDays: number; firstDate: string; lastDate: string;
  holidays: { from: string; to: string; label: string }[];
};
const weekdays = ['Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag', 'Sonntag'];
const field = 'h-11 w-full min-w-0 rounded-lg border border-border bg-background px-3 text-sm font-normal text-foreground outline-none focus:ring-2 focus:ring-ring disabled:opacity-40';

export default function BookingSchedulePanel() {
  const client = useQueryClient();
  const query = useQuery({ queryKey: ['booking-schedule'], queryFn: () => customFetch<Schedule>('/api/admin/booking-schedule', { responseType: 'json' }) });
  const [draft, setDraft] = useState<Schedule | null>(null);
  const [saved, setSaved] = useState(false);
  const mutation = useMutation({
    mutationFn: (values: Schedule) => customFetch<Schedule>('/api/admin/booking-schedule', { method: 'PUT', body: JSON.stringify(values), responseType: 'json' }),
    onSuccess: (values) => {
      client.setQueryData(['booking-schedule'], values);
      void client.invalidateQueries({ queryKey: getGetAvailabilityQueryKey() });
      try { localStorage.setItem('booking-schedule-updated', String(Date.now())); } catch {}
      window.dispatchEvent(new Event('booking-schedule-updated'));
      setDraft(null); setSaved(true);
    },
  });
  if (query.isPending) return <p role="status" className="p-6">Arbeitszeiten werden geladen…</p>;
  if (query.isError || !query.data) return <p role="alert" className="rounded-xl border border-destructive/30 p-6 text-sm">Arbeitszeiten konnten nicht geladen werden. <button onClick={() => void query.refetch()} className="underline">Erneut versuchen</button></p>;
  const values = draft ?? query.data;
  const update = (next: Schedule) => { setDraft(next); setSaved(false); };
  const updateDay = (index: number, patch: Partial<WorkingDay>) => update({ ...values, weekly: values.weekly.map((day, i) => i === index ? { ...day, ...patch } : day) });
  const updateHoliday = (index: number, patch: Partial<Schedule['holidays'][number]>) => update({ ...values, holidays: values.holidays.map((holiday, i) => i === index ? { ...holiday, ...patch } : holiday) });
  const submit = (event: FormEvent) => { event.preventDefault(); setSaved(false); mutation.mutate(values); };

  return <form onSubmit={submit} className="mb-6 space-y-5">
    <div className="flex flex-wrap items-end justify-between gap-4">
      <div><h2 className="font-display text-3xl font-bold uppercase">Arbeitszeiten & Buchungskalender</h2><p className="mt-2 max-w-2xl text-xs leading-6 text-muted-foreground">Diese Zeiten bestimmen die verfügbaren Termine auf der Website. Feiertage, Betriebsferien, einzelne Sperren und belegte Termine werden automatisch ausgeschlossen.</p></div>
      <button type="submit" disabled={mutation.isPending || !draft} className="inline-flex items-center gap-2 rounded-xl bg-accent px-5 py-3 text-xs font-bold text-white disabled:opacity-50">{mutation.isPending ? <LoaderCircle size={16} className="animate-spin" /> : <Save size={16} />}Kalender speichern</button>
    </div>
    {saved && <p role="status" className="rounded-lg border border-emerald-700/20 bg-emerald-700/5 p-4 text-sm text-emerald-800">Arbeitszeiten und freie Termine wurden aktualisiert.</p>}
    {mutation.isError && <p role="alert" className="rounded-lg border border-destructive/30 p-4 text-sm text-destructive">{(mutation.error as { data?: { error?: string } }).data?.error || 'Speichern fehlgeschlagen. Prüfen Sie die Angaben und versuchen Sie es erneut.'}</p>}
    <fieldset disabled={mutation.isPending} className="space-y-5">
      <section className="rounded-xl border border-border bg-card p-5 md:p-6">
        <h3 className="mb-5 flex items-center gap-2 text-sm font-bold"><Clock3 size={18} className="text-accent" />Wöchentliche Arbeitszeiten</h3>
        <div className="divide-y divide-border">{values.weekly.map((day, index) => <div key={weekdays[index]} className="grid items-end gap-3 py-4 sm:grid-cols-2 xl:grid-cols-[150px_1fr_1fr_1fr_1fr]">
          <label className="flex h-11 items-center gap-3 text-sm font-semibold"><input type="checkbox" checked={day.enabled} onChange={(event) => updateDay(index, { enabled: event.target.checked })} className="h-4 w-4 accent-orange-600" />{weekdays[index]}{!day.enabled && <span className="text-[10px] font-normal text-muted-foreground xl:hidden">Geschlossen</span>}</label>
          {([['start', 'Von'], ['end', 'Bis'], ['breakStart', 'Pause von'], ['breakEnd', 'Pause bis']] as const).map(([key, label]) => <label key={key} className="grid min-w-0 gap-2 text-[10px] font-semibold text-muted-foreground">{label}<input aria-label={`${weekdays[index]} ${label}`} type="time" required={day.enabled && (key === 'start' || key === 'end')} disabled={!day.enabled} value={day[key]} onChange={(event) => updateDay(index, { [key]: event.target.value })} className={field} /></label>)}
        </div>)}</div>
        <p className="mt-4 text-xs leading-5 text-muted-foreground">Zeitzone: Europe/Berlin. Pausen sind optional. Ein Terminfenster muss vollständig in der Arbeitszeit liegen.</p>
      </section>
      <section className="rounded-xl border border-border bg-card p-5 md:p-6">
        <h3 className="mb-5 flex items-center gap-2 text-sm font-bold"><CalendarDays size={18} className="text-accent" />Buchbare Daten & Zeitfenster</h3>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <label className="grid gap-2 text-xs font-semibold text-muted-foreground">Zeitfenster (Minuten)<input required type="number" min={15} max={240} value={values.intervalMinutes} onChange={(event) => update({ ...values, intervalMinutes: Number(event.target.value) })} className={field} /></label>
          <label className="grid gap-2 text-xs font-semibold text-muted-foreground">Vorausbuchung (Tage)<input required type="number" min={1} max={730} value={values.advanceDays} onChange={(event) => update({ ...values, advanceDays: Number(event.target.value) })} className={field} /></label>
          <label className="grid gap-2 text-xs font-semibold text-muted-foreground">Buchbar ab (optional)<input type="date" value={values.firstDate} onChange={(event) => update({ ...values, firstDate: event.target.value })} className={field} /></label>
          <label className="grid gap-2 text-xs font-semibold text-muted-foreground">Buchbar bis (optional)<input type="date" min={values.firstDate || undefined} value={values.lastDate} onChange={(event) => update({ ...values, lastDate: event.target.value })} className={field} /></label>
        </div>
      </section>
      <section className="rounded-xl border border-border bg-card p-5 md:p-6">
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3"><h3 className="text-sm font-bold">Feiertage & Betriebsferien</h3><button type="button" onClick={() => update({ ...values, holidays: [...values.holidays, { from: '', to: '', label: '' }] })} className="inline-flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-xs font-semibold"><Plus size={14} />Zeitraum hinzufügen</button></div>
        <p className="mb-4 text-xs leading-5 text-muted-foreground">Tragen Sie Feiertage für Ihren Standort und Betriebsferien ein. Für einen einzelnen Feiertag wählen Sie dasselbe Start- und Enddatum.</p>
        {values.holidays.length === 0 && <p className="rounded-lg bg-muted/50 p-4 text-xs text-muted-foreground">Noch keine Feiertage oder Betriebsferien eingetragen.</p>}
        <div className="space-y-4">{values.holidays.map((holiday, index) => <div key={index} className="grid items-end gap-3 rounded-lg border border-border p-4 sm:grid-cols-[1fr_1fr_auto] xl:grid-cols-[1.5fr_1fr_1fr_auto]">
          <label className="grid gap-2 text-xs font-semibold text-muted-foreground sm:col-span-3 xl:col-span-1">Bezeichnung<input required maxLength={120} value={holiday.label} placeholder="z. B. Weihnachten / Betriebsferien" onChange={(event) => updateHoliday(index, { label: event.target.value })} className={field} /></label>
          <label className="grid gap-2 text-xs font-semibold text-muted-foreground">Von<input required type="date" value={holiday.from} onChange={(event) => updateHoliday(index, { from: event.target.value })} className={field} /></label>
          <label className="grid gap-2 text-xs font-semibold text-muted-foreground">Bis<input required type="date" min={holiday.from || undefined} value={holiday.to} onChange={(event) => updateHoliday(index, { to: event.target.value })} className={field} /></label>
          <button type="button" aria-label={`Zeitraum entfernen ${holiday.label}`} onClick={() => update({ ...values, holidays: values.holidays.filter((_, i) => index !== i) })} className="grid h-11 w-11 place-items-center rounded-lg border border-border text-destructive"><Trash2 size={16} /></button>
        </div>)}</div>
      </section>
    </fieldset>
  </form>;
}
