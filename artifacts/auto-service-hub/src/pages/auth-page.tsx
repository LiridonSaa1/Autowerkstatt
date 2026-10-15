import { useState, type FormEvent } from 'react';
import { Link, useLocation } from 'wouter';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';

export default function AuthPage() {
  const [, navigate] = useLocation();
  const queryClient = useQueryClient();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!supabase) { setError('Die Anmeldung ist nicht konfiguriert.'); return; }
    const form = new FormData(event.currentTarget);
    const credentials = { email: String(form.get('email')).trim(), password: String(form.get('password')) };
    setBusy(true); setError('');
    try {
      const { data, error } = await supabase.auth.signInWithPassword(credentials);
      if (error) throw error;
      if (data.session) { queryClient.clear(); navigate('/admin'); }
      else setError('Die Anmeldung ist fehlgeschlagen. Bitte versuchen Sie es erneut.');
    } catch (err) { setError(err instanceof Error ? err.message : 'Die Anmeldung ist fehlgeschlagen. Bitte versuchen Sie es erneut.'); }
    finally { setBusy(false); }
  }
  return <main className="surface-grid flex min-h-[100dvh] items-center justify-center px-4 py-16">
    <div className="w-full max-w-md rounded-xl border border-border bg-card p-8 shadow-xl">
      <Link href="/" className="font-display text-xl font-bold uppercase text-accent">Auto Service Hub</Link>
      <h1 className="my-6 font-display text-3xl font-bold">Administrator-Anmeldung</h1>
      <form onSubmit={submit} className="grid gap-5">
        <label className="grid gap-2 text-sm">E-Mail<input name="email" type="email" defaultValue="liridon.salihi123@gmail.com" autoComplete="email" required className="rounded border border-border bg-background p-3" /></label>
        <label className="grid gap-2 text-sm">Passwort<input name="password" type="password" autoComplete="current-password" required className="rounded border border-border bg-background p-3" /></label>
        {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
        <button disabled={busy || !supabase} className="rounded bg-primary p-3 font-bold text-primary-foreground disabled:opacity-50">{busy ? 'Bitte warten…' : 'Anmelden'}</button>
      </form>
      <Link href="/" className="mt-4 block text-sm underline">Zur Startseite</Link>
    </div>
  </main>;
}


