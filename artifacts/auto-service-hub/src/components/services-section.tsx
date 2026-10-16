import { useState } from 'react';
import { ArrowRight, Battery, CarFront, CircleDot, Clock3, Cpu, Grid2X2, Settings, ShieldCheck, Tag, Wrench, Droplets } from 'lucide-react';
import type { Service } from '@workspace/api-client-react';
import { resolveServiceIconKey } from './service-icon';

const presentations: Record<string, { title: string; description: string; category: string; filter: string; image: number; icon: typeof Wrench }> = {
  'electrical-system': { title: 'Elektroniksystem', description: 'Diagnose und Reparatur von Steuergeräten, Batterien, Beleuchtung und Bordelektronik.', category: 'Elektronik & Batterie', filter: 'electronics', image: 0, icon: Battery },
  'engine-diagnostics': { title: 'Motor-Diagnose', description: 'Präzise Fehleranalyse mit modernster Diagnosetechnik für Motor und Abgassystem.', category: 'Diagnose & Motorsteuerung', filter: 'electronics', image: 1, icon: Cpu },
  'oil-filters': { title: 'Öl- und Filterwechsel', description: 'Hochwertige Öle und Markenfilter für optimale Motorleistung und längere Lebensdauer.', category: 'Flüssigkeiten & Filter', filter: 'maintenance', image: 2, icon: Droplets },
  'system-service': { title: 'Inspektion & Service', description: 'Herstellerkonforme Wartung inklusive aller Prüfungen und Sicherheitschecks.', category: 'Wartung & Inspektion', filter: 'maintenance', image: 3, icon: Wrench },
  'technical-repairs': { title: 'Reparaturen', description: 'Fachgerechte Reparatur und Instandsetzung mechanischer Komponenten.', category: 'Mechanik & Reparatur', filter: 'repair', image: 4, icon: Settings },
  'tires-wheels': { title: 'Reifen & Räder', description: 'Montage, Auswuchten und professionelle Reifenbetreuung für maximale Sicherheit.', category: 'Reifen & Fahrwerk', filter: 'tires', image: 5, icon: CircleDot },
};
const filters = [
  { id: 'all', title: 'Alle Leistungen', icon: Grid2X2 }, { id: 'maintenance', title: 'Wartung', icon: Wrench },
  { id: 'repair', title: 'Reparatur', icon: Settings }, { id: 'electronics', title: 'Elektronik', icon: Cpu },
  { id: 'tires', title: 'Reifen & Räder', icon: CircleDot }, { id: 'detailing', title: 'Aufbereitung', icon: CarFront },
];
const serviceBadgeFiles = ['battery.png', 'engine.png', 'oil.png', 'tools.png', 'lift.png', 'tires.png'];
function ServiceBadgeIcon({ index }: { index: number }) {
  return <img src={`${import.meta.env.BASE_URL}service-badges/${serviceBadgeFiles[index]}`} alt="" aria-hidden="true" width={64} height={64} className="h-full w-full scale-[1.08] object-cover [filter:hue-rotate(18deg)_saturate(.95)]" />;
}
export default function ServicesSection({ services, loading, error, onRetry, onSelect }: { services: Service[]; loading: boolean; error: boolean; onRetry: () => void; onSelect: (id: string) => void }) {
  const [filter, setFilter] = useState('all');
  const rows = services.map((service, index) => {
    const key = /electrical|elektronik|batterie/i.test(service.name) ? 'electrical-system' : resolveServiceIconKey(service.icon, service.name);
    const presentation = presentations[key];
    return { service, index, presentation, filter: presentation?.filter ?? (/pflege|detail|aufbereit/i.test(`${service.name} ${service.category}`) ? 'detailing' : 'repair') };
  });
  const visible = rows.filter(row => filter === 'all' || row.filter === filter);
  return <section id="sherbimet" className="relative w-full scroll-mt-16 overflow-hidden bg-[#f4f1ec] text-[#102a38]">
    <div className="mx-auto max-w-[1600px] px-5 pb-7 pt-10 sm:px-10 lg:px-[5%]">
      <div className="mb-6 flex flex-col justify-between gap-7 lg:flex-row lg:items-center lg:justify-start lg:gap-14">
        <div className="lg:max-w-[650px]">
          <p className="flex items-center gap-4 text-xs font-bold uppercase tracking-[.09em] text-accent"><span className="h-px w-10 bg-accent" />Unsere Leistungen</p>
          <h2 className="mt-6 text-[clamp(42px,5.2vw,78px)] font-black uppercase leading-[.94] tracking-[-.045em]">Bereit für jeden<br /><span className="text-accent">Kilometer.</span></h2>
          <p className="mt-4 max-w-[500px] text-base leading-6 text-slate-600">Von der regelmäßigen Wartung bis zur umfassenden Aufbereitung – wir hören zu und finden heraus, was Ihr Fahrzeug braucht.</p>
        </div>
        <div className="flex max-w-[275px] items-start gap-4 rounded-[30px] border border-white/70 bg-white/45 p-6 shadow-[0_8px_24px_-10px_rgba(37,48,55,.14)] backdrop-blur-xl"><span className="grid h-14 w-12 shrink-0 place-items-center rounded-2xl bg-gradient-to-br from-orange-400 to-accent text-white"><ShieldCheck size={34} /></span><div><p className="text-base font-semibold leading-5">Zertifizierte<br />Mechaniker</p><p className="mt-2 text-xs leading-5 text-slate-500">Qualität, auf die Sie sich verlassen können.</p></div></div>
      </div>
      <div className="mb-6 flex flex-wrap gap-2.5" role="group" aria-label="Leistungen filtern">{filters.map(({ id, title, icon: Icon }) => <button key={id} type="button" onClick={() => setFilter(id)} aria-pressed={filter === id} className={`inline-flex min-h-11 items-center gap-3 rounded-full border px-5 text-xs transition-colors ${filter === id ? 'border-accent bg-accent font-semibold text-white' : 'border-slate-300/50 bg-white/15 text-slate-600 hover:border-accent/50 hover:bg-white/60'}`}><Icon size={18} strokeWidth={1.5} />{title}</button>)}</div>
      {loading && <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">{Array.from({ length: 6 }, (_, index) => <div key={index} className="h-60 animate-pulse rounded-2xl bg-white/70" />)}</div>}
      {error && <p role="alert" className="rounded-2xl border border-red-200 bg-white/70 p-6 text-sm text-red-700">Die Leistungen konnten nicht geladen werden. <button onClick={onRetry} className="underline">Erneut versuchen</button></p>}
      {!loading && !error && visible.length === 0 && <p role="status" className="rounded-2xl border border-white bg-white/50 p-8 text-sm text-slate-600">In dieser Kategorie sind aktuell keine Leistungen veröffentlicht.</p>}
      {!loading && !error && <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">{visible.map(({ service, index, presentation }) => {
        const Icon = presentation?.icon ?? Wrench;
        return <article key={service.id} className="group relative flex min-h-[240px] flex-col overflow-hidden rounded-[18px] border border-white/90 bg-white/55 shadow-[0_7px_24px_-14px_rgba(30,40,50,.2)] backdrop-blur-xl transition-all hover:-translate-y-1 hover:border-orange-200 hover:shadow-[0_12px_28px_-12px_rgba(255,91,30,.18)]" data-testid={`card-service-${service.id}`}>
          {presentation && <div aria-hidden="true" className="pointer-events-none absolute bottom-5 right-0 top-8 w-[48%] bg-no-repeat" style={{ backgroundImage: `url(${import.meta.env.BASE_URL}service-parts.png)`, backgroundSize: '300% 200%', backgroundPosition: `${presentation.image % 3 * 50}% ${presentation.image < 3 ? 0 : 100}%`, maskImage: 'linear-gradient(to right, transparent, black 24%)' }} />}
          <span className="absolute right-3 top-3 z-10 grid h-[64px] w-[64px] place-items-center overflow-hidden rounded-full border-2 border-white bg-[#f55f24] text-white shadow-sm">{presentation ? <ServiceBadgeIcon index={presentation.image} /> : <Icon size={34} strokeWidth={1.8} />}</span>
          <div className="relative z-10 flex-1 px-6 pb-3 pt-5"><span className="text-base font-bold text-slate-400/60">{String(index + 1).padStart(2, '0')}</span><p className="mt-1 pr-10 text-[10px] font-bold uppercase tracking-wide text-accent">{presentation?.category ?? service.category}</p><h3 className="mt-1.5 max-w-[90%] text-[23px] font-bold leading-tight tracking-tight">{presentation?.title ?? service.name}</h3><p className="mt-2 max-w-[61%] text-[13px] leading-5 text-slate-600">{presentation?.description ?? service.description}</p></div>
          <footer className="relative z-10 flex min-h-[58px] items-center gap-4 border-t border-white/80 bg-white/65 px-6 backdrop-blur-md"><span className="flex items-center gap-2 text-xs font-bold"><Tag size={17} className="text-accent" />{service.priceLabel || 'Auf Anfrage'}</span>{service.durationMinutes && <span className="flex items-center gap-2 border-l border-slate-200 pl-4 text-xs"><Clock3 size={17} className="text-accent" />{service.durationMinutes} Min</span>}<a href="#rezervo" onClick={() => onSelect(service.id)} aria-label={`${presentation?.title ?? service.name} buchen`} className="ml-auto grid h-11 w-11 shrink-0 place-items-center rounded-full border-[3px] border-white bg-accent text-white shadow-sm transition-transform group-hover:translate-x-0.5" data-testid={`link-book-service-${service.id}`}><ArrowRight size={21} /></a></footer>
        </article>;
      })}</div>}
    </div>
  </section>;
}
