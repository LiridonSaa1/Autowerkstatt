import { type FormEvent, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { customFetch, useListServices, getListServicesQueryKey, type Service } from '@workspace/api-client-react';
import { Clock3, LoaderCircle, Pencil, Plus, RotateCcw, Search, Sparkles, Trash2, Wrench } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import DeleteConfirmation from '@/components/delete-confirmation';
import { ServiceIcon, AVAILABLE_SERVICE_ICONS, resolveServiceIconKey } from '@/components/service-icon';

const field = 'w-full rounded-xl border border-border bg-background px-3 py-3 text-sm font-normal outline-none focus:ring-2 focus:ring-ring';

type ServiceValues = Pick<Service, 'name' | 'category' | 'description' | 'priceLabel' | 'durationMinutes'> & {
  icon?: string | null;
};

export default function ServicesPanel() {
  const client = useQueryClient();
  const query = useListServices();
  const [search, setSearch] = useState('');
  const [editing, setEditing] = useState<Service | null>(null);
  const [selectedIcon, setSelectedIcon] = useState<string>('technical-repairs');
  const [open, setOpen] = useState(false);
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');

  function notify() {
    void client.invalidateQueries({ queryKey: getListServicesQueryKey() });
    try {
      localStorage.setItem('shop-services-updated', String(Date.now()));
    } catch {}
  }

  const save = useMutation({
    mutationFn: (values: ServiceValues) =>
      customFetch<Service>(editing ? `/api/admin/services/${encodeURIComponent(editing.id)}` : '/api/admin/services', {
        method: editing ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(values),
      }),
    onSuccess: () => {
      setOpen(false);
      setNotice(editing ? 'Die Leistung wurde aktualisiert.' : 'Die Leistung wurde hinzugefügt.');
      notify();
    },
  });

  const remove = useMutation({
    mutationFn: (id: string) => customFetch(`/api/admin/services/${encodeURIComponent(id)}`, { method: 'DELETE' }),
    onSuccess: () => {
      setNotice('Die Leistung wurde gelöscht.');
      notify();
    },
  });

  const seedDefaults = useMutation({
    mutationFn: () => customFetch('/api/admin/services/seed-defaults', { method: 'POST' }),
    onSuccess: () => {
      setNotice('Die 6 Standard-Leistungen wurden erfolgreich wiederhergestellt.');
      notify();
    },
    onError: () => {
      setError('Fehler beim Wiederherstellen der Standard-Leistungen.');
    },
  });

  function begin(service: Service | null) {
    setEditing(service);
    setSelectedIcon(resolveServiceIconKey(service?.icon, service?.name));
    setError('');
    save.reset();
    setOpen(true);
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (save.isPending) return;
    const data = new FormData(event.currentTarget);
    setError('');
    const priceLabelVal = String(data.get('priceLabel') || '').trim();
    const durationRaw = data.get('durationMinutes');
    const durationVal = durationRaw !== null && durationRaw !== '' && !isNaN(Number(durationRaw)) ? Number(durationRaw) : null;

    save.mutate(
      {
        name: String(data.get('name')).trim(),
        category: String(data.get('category')).trim(),
        description: String(data.get('description')).trim(),
        priceLabel: priceLabelVal || null,
        durationMinutes: durationVal,
        icon: selectedIcon,
      },
      {
        onError: (err) =>
          setError(
            (err as { data?: { error?: string } }).data?.error ||
              'Die Leistung konnte nicht gespeichert werden.',
          ),
      },
    );
  }

  const rows = (query.data ?? []).filter((service) =>
    `${service.name} ${service.category} ${service.description}`
      .toLocaleLowerCase('de-DE')
      .includes(search.toLocaleLowerCase('de-DE')),
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h2 className="font-display text-3xl font-bold uppercase">Leistungen</h2>
          <p className="mt-2 text-xs text-muted-foreground">
            Verwalten Sie die Leistungen, Icons, Preise und Dauer für Ihre Website und die Terminbuchung.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={() => seedDefaults.mutate()}
            disabled={seedDefaults.isPending}
            className="flex items-center gap-2 rounded-xl border border-border bg-card hover:bg-muted/50 px-4 py-3 text-xs font-semibold shadow-sm transition-all disabled:opacity-50"
          >
            {seedDefaults.isPending ? <LoaderCircle size={15} className="animate-spin text-accent" /> : <RotateCcw size={15} className="text-accent" />}
            <span>Standard-Leistungen laden</span>
          </button>
          <button
            onClick={() => begin(null)}
            className="flex items-center gap-2 rounded-xl bg-primary px-4 py-3 text-xs font-bold text-primary-foreground shadow-sm transition-all hover:opacity-90"
          >
            <Plus size={16} />
            <span>Neue Leistung hinzufügen</span>
          </button>
        </div>
      </div>

      {notice && (
        <p role="status" className="rounded-xl border border-emerald-700/20 bg-emerald-700/5 p-4 text-sm text-emerald-800">
          {notice}
        </p>
      )}

      <label className="flex max-w-sm items-center gap-2 rounded-full border border-border bg-card px-4">
        <Search size={16} className="text-muted-foreground" />
        <input
          type="search"
          aria-label="Leistungen suchen"
          placeholder="Leistungen suchen…"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          className="h-11 w-full bg-transparent text-xs outline-none"
        />
      </label>

      {query.isLoading ? (
        <p role="status">Leistungen werden geladen…</p>
      ) : query.isError ? (
        <p role="alert" className="text-sm text-destructive">
          Die Leistungen konnten nicht geladen werden.{' '}
          <button onClick={() => void query.refetch()} className="underline">
            Erneut versuchen
          </button>
        </p>
      ) : rows.length ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {rows.map((service) => (
            <article key={service.id} className="flex flex-col rounded-2xl border border-border bg-card p-6 shadow-sm hover:border-accent/40 transition-all">
              <div className="flex items-start gap-4">
                <ServiceIcon
                  icon={service.icon}
                  name={service.name}
                  size={52}
                />
                <div className="min-w-0 flex-1">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-accent">
                    {service.category}
                  </span>
                  <h3 className="mt-1 font-display text-xl font-bold uppercase leading-tight">
                    {service.name}
                  </h3>
                </div>
              </div>

              <p className="mt-4 whitespace-pre-wrap break-words text-xs leading-6 text-muted-foreground">
                {service.description}
              </p>

              {(service.priceLabel || service.durationMinutes) ? (
                <div className="mt-auto flex items-center justify-between gap-3 border-b border-border pb-4 pt-6 text-xs font-semibold">
                  <span className="font-bold text-accent">{service.priceLabel || 'Preis auf Anfrage'}</span>
                  {service.durationMinutes ? (
                    <span className="flex items-center gap-1 text-muted-foreground">
                      <Clock3 size={14} />
                      <span>{service.durationMinutes} Min.</span>
                    </span>
                  ) : null}
                </div>
              ) : (
                <div className="mt-auto border-b border-border pb-2 pt-6 text-xs text-muted-foreground italic">
                  Preis & Dauer auf Anfrage
                </div>
              )}

              <div className="mt-4 flex justify-end gap-2">
                <button
                  onClick={() => begin(service)}
                  aria-label={`Leistung bearbeiten: ${service.name}`}
                  className="flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-xs font-semibold hover:bg-muted/50 transition-colors"
                >
                  <Pencil size={14} />
                  <span>Bearbeiten</span>
                </button>
                <DeleteConfirmation
                  title="Leistung löschen?"
                  description="Die Leistung wird von der Website und aus der Auswahl für neue Terminbuchungen entfernt."
                  itemLabel={service.name}
                  onConfirm={() => remove.mutateAsync(service.id)}
                >
                  <button
                    disabled={remove.isPending}
                    aria-label={`Leistung löschen: ${service.name}`}
                    className="rounded-lg border border-destructive/20 p-2 text-destructive hover:bg-destructive/10 transition-colors"
                  >
                    <Trash2 size={15} />
                  </button>
                </DeleteConfirmation>
              </div>
            </article>
          ))}
        </div>
      ) : (
        <div className="rounded-2xl border border-dashed border-border bg-card p-12 text-center">
          <Wrench size={32} className="mx-auto text-accent" />
          <p className="mt-4 text-sm font-semibold">
            {query.data?.length ? 'Keine passenden Leistungen gefunden.' : 'Noch keine Leistungen vorhanden.'}
          </p>
          <p className="mt-2 text-xs text-muted-foreground">
            Laden Sie die Standard-Leistungen oder fügen Sie eine neue Leistung hinzu.
          </p>
          <button
            type="button"
            onClick={() => seedDefaults.mutate()}
            disabled={seedDefaults.isPending}
            className="mt-5 inline-flex items-center gap-2 rounded-xl bg-accent px-5 py-2.5 text-xs font-bold text-white shadow-md transition-all hover:opacity-90"
          >
            <Sparkles size={15} />
            <span>Standard-Leistungen einfügen</span>
          </button>
        </div>
      )}

      <Dialog
        open={open}
        onOpenChange={(value) => {
          if (!save.isPending) setOpen(value);
        }}
      >
        <DialogContent
          className="max-h-[90dvh] max-w-2xl overflow-y-auto rounded-2xl p-6 sm:p-8"
          onEscapeKeyDown={(event) => {
            if (save.isPending) event.preventDefault();
          }}
          onPointerDownOutside={(event) => event.preventDefault()}
        >
          <DialogTitle className="font-display text-3xl font-bold uppercase">
            {editing ? 'Leistung bearbeiten' : 'Neue Leistung hinzufügen'}
          </DialogTitle>
          <DialogDescription>
            Gespeicherte Änderungen werden auf der Website und in der Terminbuchung übernommen.
          </DialogDescription>

          <form key={editing?.id || 'new'} onSubmit={submit} className="grid gap-4 sm:grid-cols-2">
            <fieldset disabled={save.isPending} className="contents">
              <label className="grid gap-2 text-xs font-semibold">
                <span>Name</span>
                <input
                  autoFocus
                  required
                  minLength={2}
                  maxLength={120}
                  name="name"
                  defaultValue={editing?.name}
                  className={field}
                  placeholder="z. B. Technical Repairs"
                />
              </label>

              <label className="grid gap-2 text-xs font-semibold">
                <span>Kategorie</span>
                <input
                  required
                  minLength={2}
                  maxLength={80}
                  name="category"
                  defaultValue={editing?.category}
                  className={field}
                  placeholder="z. B. Mechanik & Instandsetzung"
                />
              </label>

              <label className="grid gap-2 text-xs font-semibold">
                <span>
                  Preisangabe <span className="font-normal text-muted-foreground">(Optional)</span>
                </span>
                <input
                  maxLength={120}
                  name="priceLabel"
                  defaultValue={editing?.priceLabel || ''}
                  className={field}
                  placeholder="z. B. ab 89 € oder auf Anfrage"
                />
              </label>

              <label className="grid gap-2 text-xs font-semibold">
                <span>
                  Dauer (Minuten) <span className="font-normal text-muted-foreground">(Optional)</span>
                </span>
                <input
                  type="number"
                  min={1}
                  max={1440}
                  step={1}
                  name="durationMinutes"
                  defaultValue={editing?.durationMinutes ?? ''}
                  className={field}
                  placeholder="z. B. 45"
                />
              </label>

              <div className="grid gap-2 text-xs font-semibold sm:col-span-2">
                <span>Icon auswählen (Passend zu Ihrem Design)</span>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 pt-1">
                  {AVAILABLE_SERVICE_ICONS.map((item) => {
                    const isSelected = selectedIcon === item.key;
                    return (
                      <button
                        key={item.key}
                        type="button"
                        onClick={() => setSelectedIcon(item.key)}
                        className={`flex items-center gap-3 p-2.5 rounded-xl border text-left transition-all ${
                          isSelected
                            ? 'border-accent bg-accent/10 ring-2 ring-accent/30'
                            : 'border-border bg-background hover:bg-muted/40'
                        }`}
                      >
                        <ServiceIcon
                          icon={item.key}
                          size={44}
                        />
                        <span className="text-[11px] font-bold leading-tight">
                          {item.key.replace('-', ' ').toUpperCase()}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              <label className="grid gap-2 text-xs font-semibold sm:col-span-2">
                <span>Beschreibung</span>
                <textarea
                  required
                  minLength={5}
                  maxLength={2000}
                  rows={4}
                  name="description"
                  defaultValue={editing?.description}
                  className={field}
                  placeholder="Geben Sie eine detaillierte, professionelle Beschreibung der Leistung an…"
                />
              </label>
            </fieldset>

            {error && (
              <p role="alert" className="text-xs text-destructive sm:col-span-2">
                {error}
              </p>
            )}

            <div className="flex justify-end gap-3 border-t border-border pt-4 sm:col-span-2">
              <button
                type="button"
                disabled={save.isPending}
                onClick={() => setOpen(false)}
                className="rounded-xl border border-border px-4 py-3 text-xs font-semibold hover:bg-muted/50 transition-colors"
              >
                Abbrechen
              </button>
              <button
                disabled={save.isPending}
                className="flex items-center gap-2 rounded-xl bg-accent px-5 py-3 text-xs font-bold text-white shadow-md disabled:opacity-50 hover:opacity-90 transition-opacity"
              >
                {save.isPending && <LoaderCircle size={14} className="animate-spin" />}
                <span>{save.isPending ? 'Wird gespeichert…' : 'Leistung speichern'}</span>
              </button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
