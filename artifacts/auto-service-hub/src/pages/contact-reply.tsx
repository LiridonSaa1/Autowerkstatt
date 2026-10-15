import { useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { customFetch, getListAdminContactMessagesQueryKey, type AdminContactMessage } from '@workspace/api-client-react';
import { Dialog, DialogContent, DialogDescription, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { LoaderCircle, Reply, Sparkles } from 'lucide-react';

function errorText(error: unknown) {
  const data = (error as { data?: { error?: string } })?.data;
  return data?.error || 'Die Aktion ist fehlgeschlagen. Bitte versuchen Sie es erneut.';
}

export default function ContactReply({ contact }: { contact: AdminContactMessage }) {
  const client = useQueryClient();
  const [open, setOpen] = useState(false);
  const [subject, setSubject] = useState(`Re: ${contact.subject}`.slice(0, 240));
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState<'ai' | 'send' | null>(null);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const started = useRef(false);
  const pending = useRef(false);
  async function generate() {
    if (pending.current) return;
    pending.current = true; setBusy('ai'); setError('');
    try {
      const draft = await customFetch<{ subject: string; message: string }>(`/api/admin/contact-messages/${contact.id}/draft`, { method: 'POST', responseType: 'json' });
      setSubject(draft.subject); setMessage(draft.message);
    } catch (error) { setError(errorText(error)); }
    finally { pending.current = false; setBusy(null); }
  }
  async function send() {
    if (pending.current) return;
    pending.current = true; setBusy('send'); setError('');
    try {
      const result = await customFetch<{ sent: boolean; warning?: string }>(`/api/admin/contact-messages/${contact.id}/reply`, { method: 'POST', body: JSON.stringify({ subject, message }), responseType: 'json' });
      setNotice(result.warning || 'Die Antwort wurde erfolgreich gesendet.'); setOpen(false);
      setMessage(''); started.current = false;
      void client.invalidateQueries({ queryKey: getListAdminContactMessagesQueryKey() });
    } catch (error) { setError(errorText(error)); }
    finally { pending.current = false; setBusy(null); }
  }
  const inputClass = 'w-full rounded-xl border border-border bg-muted/25 px-4 py-3 text-sm font-normal text-foreground focus:outline-none focus:ring-2 focus:ring-ring';
  return <div className="shrink-0">
    {notice && <p role="status" className="mb-3 max-w-xs text-xs text-emerald-700">{notice}</p>}
    <Dialog open={open} onOpenChange={(value) => {
      if (pending.current) return;
      setOpen(value);
      if (value && !started.current) { started.current = true; setNotice(''); void generate(); }
    }}>
      <DialogTrigger asChild><button type="button" className="inline-flex h-9 items-center justify-center gap-2 rounded-lg border border-border px-4 text-xs font-bold hover:bg-muted" data-testid={`button-reply-${contact.id}`}><Reply size={15} />Antworten</button></DialogTrigger>
      <DialogContent className="max-w-2xl rounded-2xl p-6 sm:p-8" onEscapeKeyDown={event => { if (busy) event.preventDefault(); }} onPointerDownOutside={event => event.preventDefault()}>
        <DialogTitle className="pr-6 text-lg font-bold">Antworten: {contact.name}</DialogTitle>
        <DialogDescription>Die KI erstellt einen Entwurf anhand der Kundenanfrage. Prüfen und bearbeiten Sie ihn vor dem Versand.</DialogDescription>
        <details className="rounded-xl border border-border p-3 text-xs"><summary className="cursor-pointer font-semibold">Kundennachricht</summary><p className="mt-3 whitespace-pre-wrap break-words leading-6 text-muted-foreground">{contact.message}</p></details>
        <form onSubmit={event => { event.preventDefault(); void send(); }} className="grid gap-4">
          <label className="grid gap-2 text-xs font-semibold text-muted-foreground">Empfänger-E-Mail<input readOnly type="email" value={contact.email} className={inputClass} /></label>
          <label className="grid gap-2 text-xs font-semibold text-muted-foreground">Betreff<input required maxLength={240} value={subject} disabled={!!busy} onChange={event => setSubject(event.target.value)} className={inputClass} /></label>
          <label className="grid gap-2 text-xs font-semibold text-muted-foreground">Antwort<textarea required maxLength={12000} rows={9} value={message} disabled={!!busy} onChange={event => setMessage(event.target.value)} placeholder={busy === 'ai' ? 'Die KI erstellt die Antwort…' : 'Schreiben Sie hier Ihre Antwort…'} className={inputClass} /></label>
          {error && <p role="alert" className="text-xs leading-5 text-destructive">{error}</p>}
          <div className="flex flex-wrap items-center gap-2 border-t border-border pt-4">
            <button type="button" disabled={!!busy} onClick={() => { if (!message.trim() || window.confirm('Den aktuellen Entwurf durch eine neue KI-Antwort ersetzen?')) void generate(); }} className="inline-flex items-center gap-2 rounded-lg border border-border px-3 py-2.5 text-xs font-semibold disabled:opacity-50">{busy === 'ai' ? <LoaderCircle size={14} className="animate-spin" /> : <Sparkles size={14} />}Mit KI ausfüllen</button>
            <a aria-disabled={!!busy} onClick={event => { if (busy) event.preventDefault(); }} href={`mailto:${encodeURIComponent(contact.email)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(message)}`} className="rounded-lg border border-border px-3 py-2.5 text-xs font-semibold">Outlook / Gmail</a>
            <button type="button" disabled={!!busy} onClick={() => setOpen(false)} className="ml-auto rounded-lg bg-muted px-3 py-2.5 text-xs font-semibold disabled:opacity-50">Abbrechen</button>
            <button type="submit" disabled={!!busy || !message.trim() || !subject.trim()} className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2.5 text-xs font-bold text-white disabled:opacity-50">{busy === 'send' && <LoaderCircle size={14} className="animate-spin" />}Antwort senden</button>
          </div>
          <p className="text-[10px] text-muted-foreground">Outlook / Gmail öffnet Ihr E-Mail-Programm. Der Status wird nur beim Versand über dieses Panel aktualisiert.</p>
        </form>
      </DialogContent>
    </Dialog>
  </div>;
}
