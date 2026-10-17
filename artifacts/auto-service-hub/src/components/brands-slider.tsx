import React, { useRef, useState, useEffect } from 'react';
import {
  SiAudi,
  SiBmw,
  SiVolkswagen,
  SiFord,
  SiPorsche,
  SiOpel,
  SiSkoda,
  SiSeat,
  SiToyota,
  SiRenault,
  SiPeugeot,
  SiVolvo,
  SiHyundai,
  SiNissan,
  SiHonda,
} from 'react-icons/si';
import { ShieldCheck, ChevronLeft, ChevronRight, Play, Pause, CheckCircle2, Sparkles } from 'lucide-react';

function MercedesIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 100 100" fill="currentColor" className={className} aria-label="Mercedes-Benz">
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M50 4C24.595 4 4 24.595 4 50s20.595 46 46 46 46-20.595 46-46S75.405 4 50 4zm0 6.5c21.815 0 39.5 17.685 39.5 39.5S71.815 89.5 50 89.5 10.5 71.815 10.5 50 28.185 10.5 50 10.5zm0 8.2l-3.8 30.5L18.4 62.4l28.6-4.5L50 50l3 7.9 28.6 4.5-27.8-13.2L50 18.7z"
      />
    </svg>
  );
}

export interface BrandItem {
  name: string;
  sub: string;
  tag: string;
  icon: React.ComponentType<{ className?: string }>;
}

export const SERVICED_BRANDS: BrandItem[] = [
  {
    name: 'Audi',
    sub: 'A1–A8, Q-Reihe, RS & e-tron',
    tag: 'Diagnose & Service',
    icon: SiAudi,
  },
  {
    name: 'BMW',
    sub: '1er–8er, X1–X7, M Power',
    tag: 'Inspektion & Codierung',
    icon: SiBmw,
  },
  {
    name: 'Mercedes-Benz',
    sub: 'A-, C-, E-, S-Klasse, GLC, AMG',
    tag: 'Wartung nach Vorgabe',
    icon: MercedesIcon,
  },
  {
    name: 'Volkswagen / Golf',
    sub: 'Golf 1–8, Passat, Tiguan, Polo',
    tag: 'Spezialisiert',
    icon: SiVolkswagen,
  },
  {
    name: 'Ford',
    sub: 'Focus, Fiesta, Kuga, Mondeo, Transit',
    tag: 'Motor & Elektronik',
    icon: SiFord,
  },
  {
    name: 'Porsche',
    sub: '911, Cayenne, Macan, Panamera',
    tag: 'Präzisionswartung',
    icon: SiPorsche,
  },
  {
    name: 'Škoda',
    sub: 'Octavia, Superb, Kodiaq, Fabia',
    tag: 'VAG-Diagnosesysteme',
    icon: SiSkoda,
  },
  {
    name: 'SEAT / Cupra',
    sub: 'Leon, Ibiza, Formentor, Ateca',
    tag: 'VAG-Service',
    icon: SiSeat,
  },
  {
    name: 'Opel',
    sub: 'Corsa, Astra, Insignia, Mokka',
    tag: 'Meisterwartung',
    icon: SiOpel,
  },
  {
    name: 'Toyota',
    sub: 'Corolla, Yaris, RAV4, Hybrid',
    tag: 'Hybrid- & Benzin-Check',
    icon: SiToyota,
  },
  {
    name: 'Volvo',
    sub: 'XC40, XC60, XC90, V60, V90',
    tag: 'Sicherheits- & Bremsencheck',
    icon: SiVolvo,
  },
  {
    name: 'Renault',
    sub: 'Clio, Megane, Captur, Trafic',
    tag: 'Inspektion & Reparatur',
    icon: SiRenault,
  },
  {
    name: 'Peugeot',
    sub: '208, 308, 3008, 508, Partner',
    tag: 'Fahrwerk & Bremsen',
    icon: SiPeugeot,
  },
  {
    name: 'Hyundai',
    sub: 'i20, i30, Tucson, Kona, Ioniq',
    tag: 'Moderne Fehlerdiagnose',
    icon: SiHyundai,
  },
  {
    name: 'Nissan',
    sub: 'Qashqai, Juke, X-Trail, Micra',
    tag: 'Komplettservice',
    icon: SiNissan,
  },
  {
    name: 'Honda',
    sub: 'Civic, CR-V, HR-V, Jazz',
    tag: 'VTEC & Hybrid Service',
    icon: SiHonda,
  },
];

export default function BrandsSlider() {
  const [isPaused, setIsPaused] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Triple the items to ensure seamless infinite looping without gaps on any screen width
  const marqueeItems = [...SERVICED_BRANDS, ...SERVICED_BRANDS, ...SERVICED_BRANDS];

  const handleManualScroll = (direction: 'left' | 'right') => {
    if (!scrollRef.current) return;
    const scrollAmount = 300;
    scrollRef.current.scrollBy({
      left: direction === 'left' ? -scrollAmount : scrollAmount,
      behavior: 'smooth',
    });
  };

  return (
    <div className="relative w-full overflow-hidden border-y border-border/60 bg-gradient-to-b from-card/30 via-card/75 to-card/30 py-12 md:py-16">
      {/* Background glow effects */}
      <div className="pointer-events-none absolute left-1/4 top-0 h-44 w-96 -translate-y-1/2 rounded-full bg-accent/8 blur-3xl" />
      <div className="pointer-events-none absolute right-1/4 bottom-0 h-44 w-96 translate-y-1/2 rounded-full bg-orange-400/8 blur-3xl" />

      <div className="mx-auto max-w-[1340px] px-5 lg:px-10">
        {/* Header section */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 pb-8">
          <div>
            <div className="eyebrow flex items-center gap-2.5 text-accent font-semibold tracking-wider text-xs">
              <span className="h-px w-7 bg-accent" />
              <span>ALLE FAHRZEUGMARKEN</span>
            </div>
            <h3 className="mt-3 font-display text-3xl font-bold uppercase tracking-tight text-foreground sm:text-4xl md:text-5xl">
              Fahrzeuge, die wir <span className="text-accent">fachgerecht</span> servicieren.
            </h3>
            <p className="mt-2.5 max-w-2xl text-xs sm:text-sm text-muted-foreground leading-relaxed">
              Ob deutsche Marken wie Audi, BMW, Mercedes und Porsche oder Volumenmodelle von VW (Golf), Ford, Opel und asiatischen Herstellern — wir warten und reparieren streng nach Herstellervorgaben mit vollem Garantieerhalt.
            </p>
          </div>

          {/* Controls & Autoslide Status */}
          <div className="flex shrink-0 items-center gap-3 self-start md:self-end">
            {/* Live Autoslide badge */}
            <div className="flex items-center gap-2 rounded-full border border-border/80 bg-background/80 px-3 py-1.5 text-[11px] font-semibold text-foreground shadow-2xs backdrop-blur-sm">
              <span className="relative flex h-2 w-2">
                <span className={`absolute inline-flex h-full w-full rounded-full bg-accent opacity-75 ${isPaused ? '' : 'animate-ping'}`} />
                <span className={`relative inline-flex h-2 w-2 rounded-full ${isPaused ? 'bg-muted-foreground' : 'bg-accent'}`} />
              </span>
              <span>{isPaused ? 'Autoslide pausiert' : 'Autoslide aktiv'}</span>
            </div>

            {/* Play/Pause Button */}
            <button
              type="button"
              onClick={() => setIsPaused((prev) => !prev)}
              aria-label={isPaused ? 'Autoslide starten' : 'Autoslide pausieren'}
              className="grid h-10 w-10 place-items-center rounded-none border border-border/80 bg-background text-foreground shadow-2xs transition-all hover:border-accent hover:bg-accent/10 hover:text-accent"
              title={isPaused ? 'Autoslide starten' : 'Autoslide pausieren'}
            >
              {isPaused ? <Play size={15} className="ml-0.5 fill-current" /> : <Pause size={15} />}
            </button>

            {/* Manual Arrows */}
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => handleManualScroll('left')}
                aria-label="Vorherige Marken"
                className="grid h-10 w-10 place-items-center rounded-none border border-border/80 bg-background text-foreground shadow-2xs transition-all hover:border-accent hover:bg-accent/10 hover:text-accent"
              >
                <ChevronLeft size={18} />
              </button>
              <button
                type="button"
                onClick={() => handleManualScroll('right')}
                aria-label="Nächste Marken"
                className="grid h-10 w-10 place-items-center rounded-none border border-border/80 bg-background text-foreground shadow-2xs transition-all hover:border-accent hover:bg-accent/10 hover:text-accent"
              >
                <ChevronRight size={18} />
              </button>
            </div>
          </div>
        </div>

        {/* Brand slider marquee */}
        <div
          ref={scrollRef}
          className="group relative -mx-5 overflow-x-auto scrollbar-none px-5 py-3 md:mx-0 md:px-0"
          style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
          onMouseEnter={() => setIsPaused(true)}
          onMouseLeave={() => setIsPaused(false)}
        >
          {/* Subtle gradient fades on the edges for a clean studio finish */}
          <div className="pointer-events-none absolute left-0 top-0 bottom-0 z-10 w-12 bg-gradient-to-r from-background to-transparent" />
          <div className="pointer-events-none absolute right-0 top-0 bottom-0 z-10 w-12 bg-gradient-to-l from-background to-transparent" />

          {/* The continuously animated marquee track */}
          <div
            className={`brands-marquee-slider gap-4 ${isPaused ? 'paused' : ''}`}
          >
            {marqueeItems.map((brand, index) => {
              const Icon = brand.icon;
              return (
                <div
                  key={`${brand.name}-${index}`}
                  className="group/card relative flex min-w-[215px] sm:min-w-[235px] flex-col justify-between rounded-none border border-border/70 bg-card/95 p-5 shadow-xs backdrop-blur-sm transition-all duration-300 hover:-translate-y-1 hover:border-accent hover:shadow-[0_12px_32px_-8px_rgba(245,95,36,0.25)] select-none"
                >
                  {/* Top glowing orange accent bar on hover */}
                  <div className="absolute left-6 top-0 h-[2.5px] w-10 rounded-full bg-accent/0 transition-all duration-300 group-hover/card:w-16 group-hover/card:bg-accent" />

                  {/* Icon & Tag */}
                  <div className="flex items-start justify-between gap-3">
                    <div className="grid h-12 w-12 place-items-center rounded-none border border-border/80 bg-background text-foreground shadow-2xs transition-all duration-300 group-hover/card:border-accent/50 group-hover/card:bg-accent/10 group-hover/card:text-accent group-hover/card:scale-110">
                      <Icon className="h-7 w-7" />
                    </div>
                    <span className="inline-flex items-center gap-1 rounded-none bg-accent/10 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider text-accent border border-accent/15">
                      {brand.tag}
                    </span>
                  </div>

                  {/* Brand title & sub info */}
                  <div className="mt-5">
                    <h4 className="font-display text-lg font-bold tracking-tight text-foreground transition-colors group-hover/card:text-accent">
                      {brand.name}
                    </h4>
                    <p className="mt-1 text-[11px] font-normal leading-4 text-muted-foreground line-clamp-1">
                      {brand.sub}
                    </p>
                  </div>

                  {/* Bottom reassurance bullet */}
                  <div className="mt-4 flex items-center gap-1.5 border-t border-border/50 pt-3 text-[10px] font-medium text-muted-foreground group-hover/card:text-foreground">
                    <CheckCircle2 size={12} className="shrink-0 text-emerald-600" />
                    <span>Wartung &amp; Reparatur</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Bottom Trust Badges */}
        <div className="mt-8 grid grid-cols-1 gap-3.5 border-t border-border/50 pt-6 text-xs text-muted-foreground sm:grid-cols-2 lg:flex lg:flex-wrap lg:items-center lg:justify-between lg:gap-6">
          <div className="flex items-center gap-2.5">
            <span className="grid h-5 w-5 shrink-0 place-items-center rounded-full bg-accent/15 text-accent">
              <CheckCircle2 size={13} />
            </span>
            <span className="font-medium text-foreground">Alle Baureihen &amp; Baujahre</span>
          </div>
          <div className="flex items-center gap-2.5">
            <span className="grid h-5 w-5 shrink-0 place-items-center rounded-full bg-accent/15 text-accent">
              <CheckCircle2 size={13} />
            </span>
            <span className="font-medium text-foreground">Ersatzteile in Erstausrüsterqualität</span>
          </div>
          <div className="flex items-center gap-2.5">
            <span className="grid h-5 w-5 shrink-0 place-items-center rounded-full bg-accent/15 text-accent">
              <CheckCircle2 size={13} />
            </span>
            <span className="font-medium text-foreground">Modernste markenspezifische Fehlerdiagnose</span>
          </div>
          <div className="flex items-center gap-2.5">
            <span className="grid h-5 w-5 shrink-0 place-items-center rounded-full bg-accent/15 text-accent">
              <CheckCircle2 size={13} />
            </span>
            <span className="font-medium text-foreground">GVO 461/2010 — Voller Garantieerhalt</span>
          </div>
        </div>
      </div>
    </div>
  );
}
