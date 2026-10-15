import { ArrowLeft, CircleAlert, Wrench } from 'lucide-react';
import { Link } from 'wouter';

export default function NotFound() {
  return (
    <main className="surface-grid flex min-h-[100dvh] items-center justify-center px-5 py-14">
      <section className="w-full max-w-xl border border-border bg-card p-8 shadow-md md:p-12">
        <div className="flex items-center justify-between">
          <span className="grid h-11 w-11 place-items-center bg-primary text-accent"><Wrench size={20} /></span>
          <span className="font-display text-6xl font-bold text-accent/40">404</span>
        </div>
        <div className="mt-12 flex items-center gap-3 text-accent">
          <CircleAlert size={20} />
          <span className="eyebrow">Hier geht es nicht weiter</span>
        </div>
        <h1 className="mt-4 font-display text-5xl font-bold uppercase leading-[.9] md:text-6xl">Diese Seite wurde nicht gefunden.</h1>
        <p className="mt-5 max-w-sm text-sm leading-6 text-muted-foreground">Die Adresse hat sich möglicherweise geändert. Auf der Startseite finden Sie den richtigen Weg.</p>
        <Link href="/" className="mt-8 inline-flex items-center gap-3 bg-primary px-5 py-3.5 text-xs font-bold uppercase tracking-wider text-primary-foreground" data-testid="link-not-found-home"><ArrowLeft size={15} /> Zur Startseite</Link>
      </section>
    </main>
  );
}
