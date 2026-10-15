import { useEffect, useRef, useState, type FormEvent } from 'react';
import { useMutation } from '@tanstack/react-query';
import { createPortfolioItem, customFetch, type PortfolioInput } from '@workspace/api-client-react';
import { ImagePlus, LoaderCircle, Plus, Upload, X } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogTitle, DialogTrigger } from '@/components/ui/dialog';

const inputClass = 'w-full rounded-xl border border-border bg-background px-3 py-3 text-sm font-normal outline-none focus:ring-2 focus:ring-ring';
export default function PortfolioCreate({ onCreated }: { onCreated: () => void }) {
  const [open, setOpen] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState('');
  const [error, setError] = useState('');
  const [uploaded, setUploaded] = useState<{ file: File; url: string } | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const busy = useRef(false);
  useEffect(() => {
    if (!file) { setPreview(''); return; }
    const url = URL.createObjectURL(file); setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);
  const mutation = useMutation({ mutationFn: async (data: Omit<PortfolioInput, 'imageUrl'>) => {
    if (!file) throw new Error('Bitte wählen Sie ein Bild aus.');
    let imageUrl = uploaded?.file === file ? uploaded.url : '';
    if (!imageUrl) {
      const result = await customFetch<{ imageUrl: string }>('/api/admin/portfolio-image', { method: 'POST', headers: { 'Content-Type': file.type }, body: file });
      imageUrl = result.imageUrl; setUploaded({ file, url: imageUrl });
    }
    return createPortfolioItem({ ...data, imageUrl });
  } });
  function chooseFile(selected?: File) {
    setError(''); setUploaded(null);
    if (!selected) { setFile(null); return; }
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(selected.type)) { setFile(null); setError('Bitte wählen Sie ein JPG-, PNG- oder WebP-Bild.'); return; }
    if (selected.size > 8 * 1024 * 1024) { setFile(null); setError('Das Bild darf höchstens 8 MB groß sein.'); return; }
    setFile(selected);
  }
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (busy.current) return;
    if (!file) { setError('Bitte wählen Sie ein Bild aus.'); return; }
    const form = new FormData(event.currentTarget);
    busy.current = true; setError('');
    try {
      await mutation.mutateAsync({ title: String(form.get('title')).trim(), category: String(form.get('category')), vehicleLabel: String(form.get('vehicleLabel')).trim(), description: String(form.get('description')).trim() });
      setOpen(false); setFile(null); setUploaded(null); onCreated();
    } catch (error) {
      setError((error as { data?: { error?: string } }).data?.error || 'Die Arbeit konnte nicht gespeichert werden. Bitte versuchen Sie es erneut.');
    } finally { busy.current = false; }
  }
  return <Dialog open={open} onOpenChange={value => { if (!busy.current) { setOpen(value); if (value) { setError(''); mutation.reset(); } else { setFile(null); setUploaded(null); } } }}>
    <DialogTrigger asChild><button type="button" className="inline-flex h-10 items-center justify-center gap-2 bg-primary px-4 text-[10px] font-bold uppercase tracking-wider text-primary-foreground" data-testid="button-toggle-portfolio-form"><Plus size={14} /><span>Neue Arbeit hinzufügen</span></button></DialogTrigger>
    <DialogContent className="max-h-[90dvh] max-w-2xl overflow-y-auto rounded-2xl p-6 sm:p-8" onEscapeKeyDown={event => { if (busy.current) event.preventDefault(); }} onPointerDownOutside={event => event.preventDefault()}>
      <DialogTitle className="flex items-center gap-3 font-display text-3xl font-bold uppercase"><ImagePlus className="text-accent" size={25} /><span>Neue Arbeit hinzufügen</span></DialogTitle>
      <DialogDescription>Fügen Sie eine abgeschlossene Arbeit mit Foto hinzu. Sie wird anschließend in der Galerie auf der Website angezeigt.</DialogDescription>
      <form onSubmit={submit} className="grid gap-5 sm:grid-cols-2">
        <fieldset disabled={mutation.isPending} className="contents">
          <label className="grid gap-2 text-xs font-semibold"><span>Titel</span><input autoFocus required minLength={2} maxLength={120} name="title" className={inputClass} placeholder="z. B. Bremsenservice" /></label>
          <label className="grid gap-2 text-xs font-semibold"><span>Kategorie</span><select required name="category" className={inputClass}><option value="Motor">Motor</option><option value="Bremsen & Teile">Bremsen & Teile</option><option value="Pflege & Aufbereitung">Pflege & Aufbereitung</option></select></label>
          <label className="grid gap-2 text-xs font-semibold sm:col-span-2"><span>Fahrzeug (optional)</span><input maxLength={120} name="vehicleLabel" className={inputClass} placeholder="z. B. BMW 320d" /></label>
          <div className="grid gap-2 sm:col-span-2"><span className="text-xs font-semibold">Foto</span><input ref={fileInput} type="file" accept="image/jpeg,image/png,image/webp" aria-label="Foto auswählen" onChange={event => chooseFile(event.target.files?.[0])} className="sr-only" data-testid="input-portfolio-image" />
            {preview ? <div className="relative overflow-hidden rounded-xl border border-border bg-muted/30"><img src={preview} alt="Vorschau des ausgewählten Fotos" className="h-52 w-full object-contain" /><button type="button" aria-label="Foto entfernen" onClick={() => { chooseFile(); if (fileInput.current) fileInput.current.value = ''; }} className="absolute right-3 top-3 rounded-full bg-card p-2 text-destructive shadow-sm"><X size={16} /></button><div className="flex items-center justify-between gap-3 border-t border-border bg-card px-4 py-3"><span className="truncate text-xs text-muted-foreground">{file?.name}</span><button type="button" onClick={() => fileInput.current?.click()} className="shrink-0 text-xs font-semibold text-accent">Foto ändern</button></div></div> : <button type="button" onClick={() => fileInput.current?.click()} className="flex min-h-36 flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed border-border bg-muted/20 p-5 transition-colors hover:border-accent hover:bg-accent/5" data-testid="button-select-portfolio-image"><Upload size={26} className="text-accent" /><span className="text-sm font-semibold">Foto vom Computer hochladen</span><span className="text-xs text-muted-foreground">JPG, PNG oder WebP · maximal 8 MB</span></button>}
          </div>
          <label className="grid gap-2 text-xs font-semibold sm:col-span-2"><span>Beschreibung</span><textarea required minLength={2} maxLength={1000} rows={3} name="description" className={inputClass} placeholder="Beschreiben Sie die durchgeführten Arbeiten…" /></label>
        </fieldset>
        {error && <p role="alert" className="rounded-xl border border-destructive/25 bg-destructive/5 p-3 text-xs leading-5 text-destructive sm:col-span-2">{error}</p>}
        <div className="flex justify-end gap-3 border-t border-border pt-5 sm:col-span-2"><button type="button" disabled={mutation.isPending} onClick={() => { setOpen(false); setFile(null); setUploaded(null); }} className="rounded-xl border border-border px-5 py-3 text-xs font-semibold disabled:opacity-50">Abbrechen</button><button type="submit" disabled={mutation.isPending || !file} className="inline-flex items-center gap-2 rounded-xl bg-accent px-5 py-3 text-xs font-bold text-white disabled:opacity-50">{mutation.isPending ? <LoaderCircle size={15} className="animate-spin" /> : <ImagePlus size={15} />}<span>{mutation.isPending ? 'Wird hochgeladen und gespeichert…' : 'Arbeit veröffentlichen'}</span></button></div>
      </form>
    </DialogContent>
  </Dialog>;
}
