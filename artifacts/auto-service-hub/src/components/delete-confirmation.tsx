import { type ReactElement, useState } from 'react';
import { LoaderCircle, Trash2 } from 'lucide-react';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from '@/components/ui/alert-dialog';

type DeleteConfirmationProps = {
  children: ReactElement;
  title: string;
  description: string;
  itemLabel: string;
  onConfirm: () => Promise<unknown>;
};

export default function DeleteConfirmation({ children, title, description, itemLabel, onConfirm }: DeleteConfirmationProps) {
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');
  async function confirm() {
    if (pending) return;
    setPending(true); setError('');
    try { await onConfirm(); setOpen(false); }
    catch (error) { setError((error as { data?: { error?: string } }).data?.error || 'Das Löschen ist fehlgeschlagen. Bitte versuchen Sie es erneut.'); }
    finally { setPending(false); }
  }
  return <AlertDialog open={open} onOpenChange={value => { if (!pending) { setOpen(value); setError(''); } }}>
    <AlertDialogTrigger asChild>{children}</AlertDialogTrigger>
    <AlertDialogContent className="w-[calc(100%-2rem)] max-w-md gap-0 overflow-hidden rounded-2xl border-border bg-card p-0 shadow-2xl" onEscapeKeyDown={event => { if (pending) event.preventDefault(); }}>
      <div className="p-6 sm:p-8">
        <div className="mb-5 flex h-14 w-14 items-center justify-center rounded-2xl border border-destructive/15 bg-destructive/10 text-destructive"><Trash2 size={24} strokeWidth={1.7} /></div>
        <AlertDialogHeader className="text-left">
          <AlertDialogTitle className="font-display text-3xl font-bold uppercase tracking-tight">{title}</AlertDialogTitle>
          <AlertDialogDescription className="pt-2 text-sm leading-6">{description}</AlertDialogDescription>
        </AlertDialogHeader>
        <div className="mt-5 break-words rounded-xl border border-border bg-muted/35 px-4 py-3 text-sm font-semibold">{itemLabel}</div>
        {error && <p role="alert" className="mt-4 text-xs leading-5 text-destructive">{error}</p>}
      </div>
      <AlertDialogFooter className="gap-2 border-t border-border bg-muted/20 px-6 py-4 sm:space-x-0 sm:px-8">
        <AlertDialogCancel disabled={pending} className="mt-0 h-11 rounded-xl px-5 text-xs font-semibold">Abbrechen</AlertDialogCancel>
        <AlertDialogAction disabled={pending} onClick={event => { event.preventDefault(); void confirm(); }} className="h-11 gap-2 rounded-xl bg-destructive px-5 text-xs font-bold text-white hover:bg-destructive/90 focus-visible:ring-destructive">
          {pending ? <LoaderCircle size={15} className="animate-spin" /> : <Trash2 size={15} />}<span>{pending ? 'Wird gelöscht…' : 'Löschen'}</span>
        </AlertDialogAction>
      </AlertDialogFooter>
    </AlertDialogContent>
  </AlertDialog>;
}
