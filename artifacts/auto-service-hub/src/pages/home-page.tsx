import { SiFacebook, SiInstagram, SiTiktok } from 'react-icons/si';
import { Dialog, DialogContent, DialogTitle, DialogDescription, DialogTrigger } from '@/components/ui/dialog';
import ReviewsCarousel from '@/components/reviews-carousel';
import HeroTitle from '@/components/hero-title';
import BookingWizard from '@/components/booking-wizard';
import BrandsSlider from '@/components/brands-slider';
import ServicesSection from '@/components/services-section';
import { type FormEvent, useEffect, useMemo, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import {
  ArrowDown,
  ArrowRight,
  ArrowUpRight,
  Award,
  Clock3,
  Cpu,
  Gauge,
  Mail,
  LogIn,
  MapPin,
  Menu,
  MessageCircle,
  Phone,
  PhoneCall,
  ShieldCheck,
  Sparkles,
  Star,
  X,
} from 'lucide-react';
import { formatCalendarDate } from '@/lib/date-format';
import {
  getGetShopInfoQueryKey,
  getListApprovedReviewsQueryKey,
  getListServicesQueryKey,
  useCreateContactMessage,
  useCreateReview,
  useGetShopInfo,
  useListApprovedReviews,
  useListPortfolio,
  useListServices,
} from '@workspace/api-client-react';

const portfolioCategories = ['Alle', 'Motor', 'Bremsen & Teile', 'Pflege & Aufbereitung'];
function SectionEyebrow({ children, inverse = false }: { children: string; inverse?: boolean }) {
  return (
    <div className={`eyebrow flex items-center gap-3 ${inverse ? 'text-orange-300' : 'text-accent'}`}>
      <span className="h-px w-8 bg-current" />
      {children}
    </div>
  );
}

function LoadingCards({ count = 3 }: { count?: number }) {
  return (
    <div className="grid gap-4 md:grid-cols-3">
      {Array.from({ length: count }).map((_, index) => (
        <div key={index} className="h-56 animate-pulse rounded-none border border-border bg-card/70" />
      ))}
    </div>
  );
}

export default function HomePage() {
  const queryClient = useQueryClient();
  const shopQuery = useGetShopInfo({ query: { queryKey: getGetShopInfoQueryKey(), refetchInterval: 15000 } });
  const serviceQuery = useListServices({ query: { queryKey: getListServicesQueryKey(), refetchInterval: 15000 } });
  const portfolioQuery = useListPortfolio();
  const reviewQuery = useListApprovedReviews({ query: { queryKey: getListApprovedReviewsQueryKey(), refetchInterval: 30000 } });
  const [reviewOpen, setReviewOpen] = useState(false);
  const [reviewRating, setReviewRating] = useState(5);
  const [reviewComment, setReviewComment] = useState('');
  const [hoverRating, setHoverRating] = useState<number | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [selectedServiceIds, setSelectedServiceIds] = useState<string[]>([]);
  const [portfolioCategory, setPortfolioCategory] = useState(portfolioCategories[0]);
  const [selectedWorkId, setSelectedWorkId] = useState<number | null>(null);
  const createMessage = useCreateContactMessage();
  const createReview = useCreateReview();
  const [reviewSuccess, setReviewSuccess] = useState('');
  const [messageSuccess, setMessageSuccess] = useState('');
  const [reviewError, setReviewError] = useState('');
  const [messageError, setMessageError] = useState('');
  const shop = shopQuery.data as (NonNullable<typeof shopQuery.data> & { email?: string; facebookUrl?: string; instagramUrl?: string; tiktokUrl?: string; weeklyHours?: { enabled: boolean; start: string; end: string; breakStart: string; breakEnd: string }[] }) | undefined;
  const businessName = shop?.name || 'KFZ-Service';
  const businessTagline = shop?.tagline || '';
  const { refetch: refetchShop } = shopQuery;
  useEffect(() => {
    const update = (event: StorageEvent) => {
      if (event.key === 'shop-settings-updated') void refetchShop();
      if (event.key === 'booking-schedule-updated') void refetchShop();
      if (event.key === 'shop-services-updated') void queryClient.invalidateQueries({ queryKey: getListServicesQueryKey() });
    };
    window.addEventListener('storage', update);
    return () => window.removeEventListener('storage', update);
  }, [refetchShop]);
  useEffect(() => {
    document.title = businessName;
    for (const selector of ['meta[property="og:title"]', 'meta[name="twitter:title"]']) {
      document.querySelector(selector)?.setAttribute('content', businessName);
    }
    for (const selector of ['meta[name="description"]', 'meta[property="og:description"]', 'meta[name="twitter:description"]']) {
      document.querySelector(selector)?.setAttribute('content', businessTagline);
    }
  }, [businessName, businessTagline]);
  const services = serviceQuery.data ?? [];
  const portfolio = portfolioQuery.data ?? [];
  const reviews = reviewQuery.data ?? [];
  const averageReviewRating = reviews.length ? (reviews.reduce((total, review) => total + review.rating, 0) / reviews.length).toFixed(1) : '—';
  const filteredPortfolio = portfolioCategory === portfolioCategories[0]
    ? portfolio
    : portfolio.filter((item) => item.category.toLocaleLowerCase('de-DE') === portfolioCategory.toLocaleLowerCase('de-DE'));
  const selectedWork = portfolio.find((item) => item.id === selectedWorkId);
  const submitReview = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    setReviewError('');
    createReview.mutate({
      data: {
        customerName: String(form.get('reviewName') ?? ''),
        carModel: `${String(form.get('reviewVehicleBrand') ?? '').trim()} ${String(form.get('reviewVehicleModel') ?? '').trim()}`,
        rating: Number(form.get('rating')),
        comment: String(form.get('comment') ?? ''),
      },
    }, {
      onSuccess: () => {
        setReviewSuccess('Ihre Bewertung wurde erfolgreich gespeichert. Vielen Dank! Sie wird nach Prüfung veröffentlicht.');
        formElement.reset();
        setReviewRating(5);
        setReviewComment('');
        setHoverRating(null);
        setReviewOpen(false);
        void queryClient.invalidateQueries({ queryKey: getListApprovedReviewsQueryKey() });
      },
      onError: () => setReviewError('Die Bewertung konnte nicht gesendet werden. Bitte versuchen Sie es erneut.'),
    });
  };

  const submitMessage = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    setMessageError('');
    createMessage.mutate({
      data: {
        name: String(form.get('contactName') ?? ''),
        email: String(form.get('contactEmail') ?? ''),
        subject: String(form.get('subject') ?? ''),
        message: String(form.get('message') ?? ''),
      },
    }, {
      onSuccess: () => {
        setMessageSuccess('Ihre Nachricht wurde erfolgreich gesendet.');
        formElement.reset();
      },
      onError: () => setMessageError('Die Nachricht konnte nicht gesendet werden. Bitte versuchen Sie es erneut.'),
    });
  };

  return (
    <main className="min-h-[100dvh] overflow-hidden">
      <header className="absolute inset-x-0 top-0 z-40 border-b border-white/15 text-white">
        <div className="mx-auto flex h-[76px] max-w-[1340px] items-center justify-between px-5 lg:px-10">
          <a href="#fillimi" className="flex shrink-0 items-center gap-3" aria-label={`${businessName} — Startseite`} data-testid="link-home">
            <img src={`${import.meta.env.BASE_URL}service-car-logo-light.png`} alt={businessName} width={817} height={273} className="h-11 w-auto object-contain sm:h-14" />
          </a>
          <nav className="hidden items-center gap-6 text-[15px] font-semibold text-white/75 lg:flex">
            <a href="#rreth-nesh" className="transition-colors hover:text-orange-300">Über uns</a>
            <a href="#sherbimet" className="transition-colors hover:text-orange-300">Leistungen</a>
            <a href="#vleresime" className="transition-colors hover:text-orange-300">Bewertungen</a>
            <a href="#kontakt" className="transition-colors hover:text-orange-300">Kontakt</a>
          </nav>
          <div className="flex items-center gap-3">
          <a href="#rezervo" className="hidden items-center gap-2 bg-accent px-5 py-3 text-[11px] font-bold uppercase tracking-wider text-white transition-transform hover:-translate-y-0.5 sm:flex">
            Termin vereinbaren
            <ArrowUpRight size={15} />
          </a>
          <a href="/sign-in" aria-label="Anmelden" title="Anmelden" className="grid h-10 w-10 shrink-0 place-items-center border border-white/25 text-white transition-colors hover:border-accent hover:bg-accent" data-testid="link-login">
            <LogIn size={20} aria-hidden="true" />
          </a>
          <button type="button" onClick={() => setMenuOpen((value) => !value)} className="grid h-10 w-10 place-items-center border border-white/25 lg:hidden" aria-label={menuOpen ? 'Menü schließen' : 'Menü öffnen'} data-testid="button-menu">
            {menuOpen ? <X size={19} /> : <Menu size={19} />}
          </button>
          </div>
        </div>
        {menuOpen && (
          <nav className="grid gap-4 border-t border-white/15 bg-primary px-6 py-6 text-base text-white lg:hidden">
            <a href="#rreth-nesh" onClick={() => setMenuOpen(false)}>Über uns</a>
            <a href="#sherbimet" onClick={() => setMenuOpen(false)}>Leistungen</a>
            <a href="#vleresime" onClick={() => setMenuOpen(false)}>Bewertungen</a>
            <a href="#kontakt" onClick={() => setMenuOpen(false)}>Kontakt</a>
            <a href="#rezervo" onClick={() => setMenuOpen(false)} className="font-bold text-orange-300">Termin vereinbaren</a>
          </nav>
        )}
      </header>

      <section id="fillimi" className="relative flex min-h-[730px] items-end bg-primary text-white md:min-h-[800px]">
        <div className="absolute inset-0 w-full overflow-hidden">
          <img
            src={`${import.meta.env.BASE_URL}workshop-hero.jpg`}
            alt="Service Car Werkstatt"
            className="h-full w-full object-cover object-[78%_center] md:object-[80%_center] opacity-90 md:opacity-95"
          />
          <div className="absolute inset-0 bg-gradient-to-r from-primary via-primary/85 to-primary/20 sm:via-primary/75 md:via-primary/55 md:to-transparent" />
          <div className="absolute inset-0 bg-gradient-to-t from-primary/80 via-transparent to-primary/50" />
        </div>
        <div className="hero-lines absolute inset-0 opacity-40 pointer-events-none" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_78%_45%,rgba(233,99,52,.12),transparent_48%)] pointer-events-none" />
        <div className="absolute right-[-8%] top-[20%] hidden h-[500px] w-[62%] border border-white/10 md:block pointer-events-none">
          <div className="absolute inset-5 border border-white/10" />
          <div className="absolute right-[16%] top-[10%] h-[80%] w-[1px] bg-white/10" />
          <div className="absolute bottom-[19%] left-[9%] right-[9%] h-[1px] bg-white/10" />
          <div className="absolute right-[11%] top-[12%] font-display text-[100px] font-bold leading-none text-white/[.035]">SERVICE</div>
          <div className="absolute bottom-[12%] left-[12%] font-display text-[250px] font-bold leading-[.75] text-white/[.04]">01</div>
        </div>
        <div className="relative z-10 mx-auto grid w-full max-w-[1340px] items-end gap-10 px-5 pb-20 pt-36 md:grid-cols-[1fr_330px] md:px-10 md:pb-24">
          <div className="max-w-[850px]">
            <div className="reveal eyebrow mb-7 flex items-center gap-3 text-orange-300">
              <span className="h-px w-9 bg-current" />
              {businessTagline}
            </div>
            <HeroTitle />
            <p className="reveal reveal-delay-2 mt-8 max-w-[520px] text-sm leading-7 text-white/65 md:text-base">
              Faire Reparaturen, sorgfältige Fahrzeugpflege und klare Informationen vor Ihrer Entscheidung. Entdecken Sie unsere Leistungen und buchen Sie online.
            </p>
            <div className="reveal reveal-delay-3 mt-9 flex flex-wrap gap-3">
              <a href="#rezervo" className="inline-flex items-center gap-3 bg-accent px-6 py-4 text-[11px] font-bold uppercase tracking-wider text-white transition-transform hover:-translate-y-1" data-testid="link-book-hero">
                Termin vereinbaren
                <ArrowRight size={16} />
              </a>
              <a href="#sherbimet" className="inline-flex items-center gap-3 border border-white/30 px-6 py-4 text-[11px] font-bold uppercase tracking-wider text-white transition-colors hover:border-white/70" data-testid="link-services-hero">
                Leistungen entdecken
                <ArrowDown size={15} />
              </a>
            </div>
          </div>
          <div className="reveal reveal-delay-3 hidden border-l border-white/20 pl-7 pb-2 md:block">
            <span className="eyebrow text-white/45">Unser Anspruch</span>
            <p className="mt-3 font-display text-3xl font-semibold uppercase leading-tight">Klare Antworten.<br />Gute Lösungen.</p>
            <div className="mt-6 flex items-center gap-3 text-xs text-white/55">
              <span className="h-2 w-2 rounded-full bg-orange-300" />
              Jederzeit online Termine anfragen
            </div>
          </div>
        </div>
        <div className="absolute bottom-0 left-0 right-0 h-[6px] bg-accent" />
      </section>

      <section className="relative z-10 mx-auto -mt-1 grid max-w-[1340px] grid-cols-2 border-x border-b border-border bg-card md:grid-cols-4">
        {[
          { image: 'transparent-service.jpg', title: 'Transparente Arbeit', text: 'Sie wissen, was wir tun und warum.' },
          { image: 'practical-solutions.jpg', title: 'Praktische Lösungen', text: 'Passend zu Ihrem Fahrzeug und Bedarf.' },
          { image: 'vehicle-care-spray.jpg', title: 'Sorgfältige Fahrzeugpflege', text: 'Sauber bis ins Detail, innen und außen.' },
          { image: 'online-booking.jpg', title: 'Einfach Termine anfragen', text: 'Wählen Sie Tag und Uhrzeit online.' },
        ].map(({ image, title, text }) => (
          <div key={title} className="flex min-h-[126px] flex-col items-start gap-3 border-b border-r border-border px-4 py-5 last:border-r-0 sm:flex-row sm:items-center md:border-b-0 md:px-5">
            <img src={`${import.meta.env.BASE_URL}benefits/${image}`} alt="" width={1024} height={1024} loading="lazy" className="h-16 w-16 shrink-0 rounded-none object-contain mix-blend-multiply lg:h-20 lg:w-20" />
            <div className="min-w-0">
              <h2 className="text-xs font-bold uppercase tracking-wide">{title}</h2>
              <p className="mt-1.5 text-[11px] leading-5 text-muted-foreground">{text}</p>
            </div>
          </div>
        ))}
      </section>

      <section id="rreth-nesh" className="scroll-mt-16 px-5 py-24 md:px-10 md:py-32">
        <div className="mx-auto grid max-w-[1340px] gap-14 lg:grid-cols-[.85fr_1.15fr] lg:items-center">
          <div className="relative min-h-[430px] overflow-hidden bg-primary md:min-h-[550px]">
            <img src={`${import.meta.env.BASE_URL}about-workshop.png`} alt="Mechaniker bei der Arbeit am Motor eines Fahrzeugs in einer modernen Werkstatt" width={1536} height={1024} loading="lazy" className="absolute inset-0 h-full w-full object-cover object-[60%_center]" data-testid="image-about-workshop" />
          </div>
          <div>
            <SectionEyebrow>Über uns</SectionEyebrow>
            <h2 className="mt-5 max-w-2xl font-display text-6xl font-bold uppercase leading-[.88] md:text-8xl">Mehr als<br />eine Werkstatt.</h2>
            <p className="mt-7 max-w-[600px] text-sm leading-7 text-muted-foreground">Ihr Auto ist mehr als ein Fahrzeug. Es begleitet Ihren Alltag, Ihre Pläne und die Menschen, die Ihnen wichtig sind. Deshalb erklären wir Ihnen, was wir feststellen, was warten kann und was jetzt Aufmerksamkeit braucht.</p>
            <p className="mt-4 max-w-[600px] text-sm leading-7 text-muted-foreground">Von der ersten Prüfung bis zum letzten Pflegeschritt verfolgen wir ein Ziel: Sie sollen mit einem guten Gefühl wieder losfahren.</p>
            <div className="mt-10 grid max-w-3xl grid-cols-1 gap-3.5 sm:grid-cols-3 sm:gap-0 sm:border-y sm:border-border sm:py-6">
              <div className="flex items-start gap-4 rounded-none border border-border/80 bg-white/80 p-4 shadow-xs backdrop-blur-sm sm:flex-col sm:rounded-none sm:border-0 sm:bg-transparent sm:p-0 sm:pr-5 sm:shadow-none">
                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-none border border-accent/20 bg-accent/10 text-accent sm:hidden">
                  <ShieldCheck size={20} strokeWidth={1.8} />
                </span>
                <div className="min-w-0">
                  <span className="font-display text-xl font-bold uppercase tracking-tight text-foreground sm:text-2xl">
                    Zertifizierte Mechaniker
                  </span>
                  <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                    Erfahrung und Sorgfalt für jedes Fahrzeug.
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-4 rounded-none border border-border/80 bg-white/80 p-4 shadow-xs backdrop-blur-sm sm:flex-col sm:rounded-none sm:border-0 sm:border-l sm:border-border sm:bg-transparent sm:p-0 sm:pl-6 sm:shadow-none">
                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-none border border-accent/20 bg-accent/10 text-accent sm:hidden">
                  <Cpu size={20} strokeWidth={1.8} />
                </span>
                <div className="min-w-0">
                  <span className="font-display text-xl font-bold uppercase tracking-tight text-foreground sm:text-2xl">
                    Moderne Ausstattung
                  </span>
                  <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                    Präzise Diagnose und gründliche Prüfung.
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-4 rounded-none border border-border/80 bg-white/80 p-4 shadow-xs backdrop-blur-sm sm:flex-col sm:rounded-none sm:border-0 sm:border-l sm:border-border sm:bg-transparent sm:p-0 sm:pl-6 sm:shadow-none">
                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-none border border-accent/20 bg-accent/10 text-accent sm:hidden">
                  <Award size={20} strokeWidth={1.8} />
                </span>
                <div className="min-w-0">
                  <span className="font-display text-xl font-bold uppercase tracking-tight text-foreground sm:text-2xl">
                    Garantie auf unsere Arbeit
                  </span>
                  <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                    Service, bei dem Sie im Mittelpunkt stehen.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <ServicesSection
        services={services}
        loading={serviceQuery.isLoading}
        error={serviceQuery.isError}
        onRetry={() => void serviceQuery.refetch()}
        onSelect={(id) => setSelectedServiceIds((prev) => (prev.includes(id) ? prev : [...prev, id]))}
      />

      <BookingWizard
        services={services}
        loading={serviceQuery.isLoading}
        error={serviceQuery.isError}
        onRetry={() => void serviceQuery.refetch()}
        selectedServiceIds={selectedServiceIds}
        onToggleService={(id) =>
          setSelectedServiceIds((prev) =>
            prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id],
          )
        }
        onClearServices={() => setSelectedServiceIds([])}
      />

      <section id="vleresime" className="relative w-full scroll-mt-16 overflow-hidden bg-[#faf8f5] px-5 py-20 md:px-10 md:py-24">
        <div className="relative mx-auto w-full max-w-[1340px] bg-[radial-gradient(ellipse_at_70%_0%,rgba(255,176,107,.14),transparent_50%)]">
          <div className="relative mb-2 flex min-h-[220px] flex-col justify-between gap-5 pb-4 lg:flex-row lg:items-end">
            <div className="relative z-10 lg:max-w-[67%]">
              <SectionEyebrow>Kundenstimmen</SectionEyebrow>
              <div className="mt-5 flex flex-nowrap items-center gap-4 sm:gap-6">
                <h2 className="shrink-0 font-display text-3xl font-bold uppercase leading-[.9] min-[400px]:text-4xl sm:text-5xl md:text-6xl lg:text-7xl">
                  Vertrauen<br /><span className="text-accent">verbindet.</span>
                </h2>
                <div className="shrink-0 border-l border-border/80 pl-4 sm:pl-6">
                  <p className="text-2xl font-bold tracking-tight text-primary sm:text-3xl">
                    {averageReviewRating}
                    <span className="ml-1 text-sm font-normal text-muted-foreground/60 sm:text-base"> / 5</span>
                  </p>
                  <div className="mt-1.5 flex gap-1 text-accent sm:mt-2.5" aria-hidden="true">
                    {Array.from({ length: 5 }, (_, index) => (
                      <Star
                        key={index}
                        size={14}
                        className={`sm:h-4 sm:w-4 ${index < Math.round(Number(averageReviewRating)) ? 'fill-current' : 'opacity-25'}`}
                      />
                    ))}
                  </div>
                  <p className="mt-1.5 text-[11px] text-muted-foreground sm:mt-2.5 sm:text-xs">
                    {reviews.length} veröffentlichte Bewertungen
                  </p>
                </div>
              </div>
              <p className="mt-4 max-w-md text-xs leading-6 text-muted-foreground">Lesen Sie die Erfahrungen unserer Kunden. Neue Bewertungen werden nach Prüfung freigegeben.</p>
            </div>
            <div className="relative h-44 overflow-hidden rounded-none lg:absolute lg:-right-[7%] lg:-top-6 lg:h-[260px] lg:w-[47%] lg:rounded-none lg:rounded-bl-[240px]" aria-hidden="true"><img src={`${import.meta.env.BASE_URL}customer-experience.png`} alt="" className="h-full w-full object-cover object-[70%_45%]" /><div className="absolute inset-0 bg-gradient-to-r from-[#faf8f5]/80 via-transparent to-transparent" /><div className="pointer-events-none absolute -left-12 top-0 hidden h-[115%] w-32 -rotate-[37deg] border-r border-white/70 bg-gradient-to-r from-orange-200/30 to-orange-500/65 lg:block" /></div>
            <Dialog open={reviewOpen} onOpenChange={(open) => { if (!createReview.isPending) { setReviewOpen(open); if (open) { setReviewError(''); setReviewSuccess(''); } } }}>
              <DialogTrigger asChild><button className="relative z-10 inline-flex shrink-0 items-center justify-center gap-3 self-start rounded-none bg-accent px-5 py-3 text-xs font-bold uppercase tracking-wider text-white shadow-[0_8px_24px_-8px_rgba(255,94,30,.55)] transition-all hover:-translate-y-0.5 hover:bg-accent/90 lg:mb-4 lg:self-end" data-testid="button-open-review"><MessageCircle size={18} />Bewertung abgeben<ArrowRight size={16} /></button></DialogTrigger>
              <DialogContent className="max-w-2xl border-white/15 bg-primary p-6 text-white md:p-9">
                <div><span className="eyebrow text-orange-300">Erfahrung teilen</span><DialogTitle className="mt-3 font-display text-3xl font-bold uppercase">Wie war Ihr Besuch?</DialogTitle><DialogDescription className="mt-3 text-sm text-white/70">Ihre Bewertung wird geprüft und nach Freigabe veröffentlicht.</DialogDescription></div>
                            <form className="mt-7 grid gap-4 sm:grid-cols-2" onSubmit={submitReview}>
              <label className="grid gap-2 text-xs text-white/70 sm:col-span-2">
                Ihr Name
                <input required minLength={2} maxLength={120} name="reviewName" className="h-11 border border-white/20 bg-white/5 px-3 text-sm text-white outline-none focus:border-orange-300" placeholder="Vor- und Nachname" data-testid="input-review-name" />
              </label>

              <label className="grid min-w-0 gap-2 text-xs text-white/70">
                Fahrzeugmarke
                <input required maxLength={50} name="reviewVehicleBrand" disabled={createReview.isPending} className="h-11 border border-white/20 bg-white/5 px-3 text-sm text-white outline-none focus:border-orange-300" placeholder="z. B. Audi" data-testid="input-review-brand" />
              </label>
              <label className="grid min-w-0 gap-2 text-xs text-white/70">
                Modell
                <input required maxLength={69} name="reviewVehicleModel" disabled={createReview.isPending} className="h-11 border border-white/20 bg-white/5 px-3 text-sm text-white outline-none focus:border-orange-300" placeholder="z. B. RS 6 Avant, 2023" data-testid="input-review-model" />
              </label>
              <fieldset disabled={createReview.isPending} className="min-w-0 sm:col-span-2">
                <legend className="mb-2 text-xs text-white/70">Bewertung</legend>
                <div className="flex flex-wrap items-center gap-3">
                  <div className="flex gap-1" onMouseLeave={() => setHoverRating(null)}>
                    {[1, 2, 3, 4, 5].map(rating => <label key={rating} className="relative flex h-11 w-11 cursor-pointer items-center justify-center rounded-none transition-colors hover:bg-white/5" onMouseEnter={() => setHoverRating(rating)}>
                      <input type="radio" name="rating" value={rating} checked={reviewRating === rating} onChange={() => setReviewRating(rating)} aria-label={`${rating} von 5 Sternen`} className="peer sr-only" data-testid={`input-review-rating-${rating}`} />
                      <Star size={31} aria-hidden="true" className={`rounded-none transition-colors peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-offset-4 peer-focus-visible:outline-orange-300 ${rating <= (hoverRating ?? reviewRating) ? 'fill-orange-400 text-orange-400' : 'text-white/35'}`} />
                    </label>)}
                  </div>
                  <span className="text-xs font-semibold text-white/70" aria-live="polite">{reviewRating} von 5</span>
                </div>
              </fieldset>
              <label className="grid gap-2 text-xs text-white/70 sm:col-span-2">Ihre Erfahrung<textarea required minLength={8} maxLength={150} name="comment" rows={3} value={reviewComment} onChange={event => setReviewComment(event.target.value.slice(0, 150))} aria-describedby="review-comment-limit" className="resize-y border border-white/20 bg-white/5 px-3 py-3 text-sm text-white outline-none focus:border-orange-300" placeholder="Was hat Ihnen gefallen? (max. 150 Zeichen)" data-testid="input-review-comment" /><span id="review-comment-limit" className="flex flex-wrap justify-between gap-2 text-[11px] text-white/60"><span>Max. 150 Zeichen</span><span>{reviewComment.length} / 150 Zeichen</span></span></label>
              <div className="sm:col-span-2">
                <button type="submit" disabled={createReview.isPending} className="inline-flex items-center gap-3 bg-accent px-5 py-3 text-xs font-bold uppercase tracking-wider text-foreground disabled:opacity-60" data-testid="button-submit-review">{createReview.isPending ? 'Wird gesendet…' : 'Bewertung absenden'} <ArrowRight size={14} /></button>
                
                {reviewError && <p className="mt-3 text-xs text-orange-200" role="alert">{reviewError}</p>}
              </div>
            </form>
              </DialogContent>
            </Dialog>
          </div>
          {reviewSuccess && <p role="status" className="mb-6 rounded-none border border-emerald-700/20 bg-emerald-700/5 p-4 text-sm text-emerald-800">{reviewSuccess}</p>}
          {reviewQuery.isLoading && <div className="h-44 animate-pulse rounded-none bg-muted" />}
          {reviewQuery.isError && <p className="text-sm text-destructive" role="alert">Die Bewertungen konnten nicht geladen werden. <button onClick={() => void reviewQuery.refetch()} className="underline">Erneut versuchen</button></p>}
          {!reviewQuery.isLoading && !reviewQuery.isError && reviews.length === 0 && <div className="rounded-none border border-border bg-card px-6 py-8 text-center"><MessageCircle size={30} className="mx-auto text-accent" /><p className="mt-4 text-sm text-muted-foreground">Es gibt noch keine veröffentlichten Bewertungen. Teilen Sie als Erster Ihre Erfahrung.</p></div>}
          {reviews.length > 0 && <ReviewsCarousel reviews={reviews} />}
          <div className="mt-8 grid grid-cols-2 overflow-hidden rounded-none border border-primary/10 bg-white shadow-[0_8px_30px_-18px_rgba(29,47,58,.2)] lg:grid-cols-4">
            {[
              { icon: MessageCircle, value: String(reviews.length), label: 'Veröffentlichte Bewertungen' },
              { icon: Star, value: `${averageReviewRating} / 5`, label: 'Durchschnittsbewertung' },
              { icon: ShieldCheck, value: 'Persönlich geprüft', label: 'Vor der Veröffentlichung' },
              { icon: Gauge, value: 'Alle Fahrzeugmarken', label: 'PKW, SUV, Transporter u.v.m.' },
            ].map(({ icon: Icon, value, label }, index) => (
              <div
                key={label}
                className={`flex min-w-0 items-center gap-3 p-3.5 sm:gap-4 sm:p-6 ${
                  index >= 2 ? 'border-t border-primary/10' : ''
                } ${index % 2 === 1 ? 'border-l border-primary/10' : ''} lg:border-t-0 lg:border-l lg:first:border-l-0`}
              >
                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-none border border-orange-100 bg-orange-50 text-accent sm:h-12 sm:w-12 sm:rounded-none">
                  <Icon size={20} strokeWidth={1.7} aria-hidden="true" className="sm:hidden" />
                  <Icon size={22} strokeWidth={1.7} aria-hidden="true" className="hidden sm:block" />
                </span>
                <div className="min-w-0">
                  <p
                    className={
                      index < 2
                        ? 'text-xl font-bold leading-none tracking-tight text-primary tabular-nums sm:text-3xl'
                        : 'text-xs font-bold leading-snug text-primary sm:text-sm'
                    }
                  >
                    {value}
                  </p>
                  <p className="mt-1 text-[11px] leading-tight text-muted-foreground sm:mt-2 sm:text-xs sm:leading-relaxed">
                    {label}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>



      <section className="bg-white px-5 py-20 md:px-10 md:py-24">
        <div className="mx-auto grid max-w-[1340px] gap-12 lg:grid-cols-[.7fr_1.3fr]">
          <div>
            <SectionEyebrow>So arbeiten wir</SectionEyebrow>
            <h2 className="mt-5 max-w-lg font-display text-[2.75rem] font-bold uppercase leading-[.9] md:text-[4rem]">Transparent,<br />von Anfang an.</h2>
          </div>
          <div className="relative pl-1 sm:pl-0 sm:grid sm:grid-cols-3 sm:gap-0">
            {/* Timeline vertical rail for mobile */}
            <div
              className="absolute bottom-6 left-[27px] top-6 w-0.5 bg-gradient-to-b from-accent via-orange-400 to-orange-300 sm:hidden"
              aria-hidden="true"
            />
            {[
              ['01', 'Bedarf schildern', 'Wählen Sie eine Leistung und nennen Sie uns die Fahrzeugdaten.'],
              ['02', 'Termin auswählen', 'Sehen Sie freie Termine und senden Sie Ihre Anfrage.'],
              ['03', 'Wir melden uns', 'Wir bestätigen Ihren Termin und besprechen die nächsten Schritte.'],
            ].map(([number, title, detail]) => (
              <div
                key={number}
                className="relative flex items-start gap-4 pb-8 last:pb-0 sm:block sm:ml-6 sm:border-l sm:border-t-0 sm:border-primary/20 sm:first:ml-0 sm:pb-0 sm:pl-6"
              >
                {/* Mobile timeline node badge */}
                <div className="relative z-10 grid h-12 w-12 shrink-0 place-items-center rounded-none border-2 border-white bg-gradient-to-br from-orange-400 to-accent font-display text-lg font-bold text-white shadow-md shadow-orange-500/25 sm:hidden">
                  {number}
                </div>

                {/* Desktop large number */}
                <span className="hidden font-display text-5xl font-bold text-accent sm:block">{number}</span>

                {/* Content */}
                <div className="min-w-0 pt-1 sm:pt-4">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-accent sm:hidden">
                    Schritt {number}
                  </span>
                  <h3 className="font-display text-xl font-bold uppercase leading-tight sm:mt-0 sm:text-2xl">{title}</h3>
                  <p className="mt-1.5 max-w-[280px] text-xs leading-5 text-muted-foreground sm:mt-2 sm:max-w-[220px] sm:leading-6">
                    {detail}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>





      {/* Brand Slider: Automarken, die wir servicieren (Audi, BMW, Mercedes, VW/Golf, Ford etc.) */}
      <BrandsSlider />

      <section id="kontakt" className="scroll-mt-16 bg-white px-5 py-24 md:px-10 md:py-32">
        <div className="mx-auto grid max-w-[1340px] gap-12 lg:grid-cols-[.9fr_1.1fr]">
          <div className="flex flex-col">
            <div>
              <SectionEyebrow>So finden Sie uns</SectionEyebrow>
              <h2 className="mt-5 font-display text-[3rem] font-bold uppercase leading-[.88] md:text-[4.8rem]">Wir sind<br />für Sie da.</h2>
              <p className="mt-6 max-w-[460px] text-sm leading-7 text-muted-foreground">
                Haben Sie vor der Terminvereinbarung eine Frage? Schreiben Sie uns direkt über unser Kontaktformular oder besuchen Sie uns vor Ort in unserer Werkstatt.
              </p>
            </div>
            {shop?.mapUrl && (
              <div className="mt-8 overflow-hidden rounded-none border border-border bg-card shadow-sm">
                <iframe
                  src={(shop as typeof shop & { mapEmbedUrl?: string }).mapEmbedUrl || (shop.mapUrl.includes('/maps/embed') ? shop.mapUrl : undefined)}
                  title="Standort unserer Werkstatt"
                  loading="lazy"
                  referrerPolicy="no-referrer-when-downgrade"
                  className="h-64 w-full"
                  allowFullScreen
                  data-testid="map-preview"
                />
                <div className="flex items-center justify-between border-t border-border/80 bg-muted/20 px-5 py-3.5">
                  <span className="flex items-center gap-2 text-xs font-semibold text-foreground">
                    <MapPin size={15} className="text-accent" /> Werkstatt auf Google Maps
                  </span>
                  <a
                    href={shop.mapUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1.5 text-xs font-bold text-accent hover:underline"
                    data-testid="link-map"
                  >
                    Karte öffnen <ArrowUpRight size={14} />
                  </a>
                </div>
              </div>
            )}
          </div>
          <div className="rounded-none border border-border/80 bg-card p-6 shadow-xl md:p-10">
            <div className="mb-7">
              <span className="eyebrow text-accent">Direkter Kontakt</span>
              <h3 className="mt-2 font-display text-4xl font-bold uppercase">Was können wir für Sie tun?</h3>
            </div>
            <form className="grid gap-4 sm:grid-cols-2" onSubmit={submitMessage}>
              <label className="grid gap-2 text-xs font-medium">Name<input required minLength={2} maxLength={120} name="contactName" className="h-12 border border-border bg-background px-3 text-sm outline-none focus:border-accent" data-testid="input-contact-name" /></label>
              <label className="grid gap-2 text-xs font-medium">E-Mail<input required type="email" name="contactEmail" className="h-12 border border-border bg-background px-3 text-sm outline-none focus:border-accent" data-testid="input-contact-email" /></label>
              <label className="grid gap-2 text-xs font-medium sm:col-span-2">Betreff<input required minLength={2} maxLength={160} name="subject" className="h-12 border border-border bg-background px-3 text-sm outline-none focus:border-accent" data-testid="input-contact-subject" /></label>
              <label className="grid gap-2 text-xs font-medium sm:col-span-2">Nachricht<textarea required minLength={5} maxLength={3000} rows={5} name="message" className="resize-y border border-border bg-background px-3 py-3 text-sm outline-none focus:border-accent" data-testid="input-contact-message" /></label>
              <div className="sm:col-span-2">
                <button type="submit" disabled={createMessage.isPending} className="inline-flex h-12 items-center gap-3 bg-primary px-6 text-xs font-bold uppercase tracking-wider text-primary-foreground disabled:opacity-50" data-testid="button-send-message">{createMessage.isPending ? 'Wird gesendet…' : 'Nachricht senden'} <ArrowRight size={15} /></button>
                {messageSuccess && <p className="mt-3 text-sm text-emerald-700" role="status">{messageSuccess}</p>}
                {messageError && <p className="mt-3 text-sm text-destructive" role="alert">{messageError}</p>}
              </div>
            </form>
          </div>
        </div>
      </section>

      <footer className="bg-[#f4f1ec] px-5 pt-14 pb-6 text-foreground md:px-10 md:pt-20 md:pb-6">
        <div className="mx-auto max-w-[1340px]">
          <div className="grid gap-10 pb-12 sm:grid-cols-2 lg:grid-cols-[1.1fr_1fr_1fr_1fr]">
            <div>
              <a href="#fillimi" aria-label={`${businessName} — Startseite`}><img src={`${import.meta.env.BASE_URL}service-car-logo.png`} alt={businessName} width={817} height={273} className="h-16 w-auto max-w-full object-contain" /></a>
              <p className="mt-6 max-w-[270px] text-sm leading-7 text-muted-foreground">Wartung, Reparatur und Fahrzeugpflege – persönlich, sorgfältig und zuverlässig.</p>
              <div className="mt-5 flex flex-wrap gap-2.5">
                {[{ label: 'Facebook', url: shop?.facebookUrl, Icon: SiFacebook }, { label: 'TikTok', url: shop?.tiktokUrl, Icon: SiTiktok }, { label: 'Instagram', url: shop?.instagramUrl, Icon: SiInstagram }].map(({ label, url, Icon }) => url ? <a key={label} href={url} target="_blank" rel="noreferrer" aria-label={label} className="grid h-10 w-10 place-items-center border border-border bg-white text-accent transition-colors hover:border-accent hover:bg-accent hover:text-white"><Icon size={18} /></a> : <span key={label} aria-label={`${label} – Link folgt`} title={`${label} – Link folgt`} className="grid h-10 w-10 place-items-center border border-border bg-white text-accent"><Icon size={18} /></span>)}
                {shop?.whatsapp && <a href={`https://wa.me/${shop.whatsapp.replace(/\D/g, '')}`} target="_blank" rel="noreferrer" aria-label="WhatsApp" className="grid h-10 w-10 place-items-center border border-border bg-white text-accent hover:border-accent"><MessageCircle size={18} /></a>}
              </div>
            </div>
            <div>
              <h3 className="eyebrow text-muted-foreground">Kontakt</h3>
              <div className="mt-5 space-y-3 text-sm leading-6">
                {shop?.phone && <a href={`tel:${shop.phone.replace(/[^+\d]/g, '')}`} className="block font-semibold text-accent" data-testid="link-shop-phone">{shop.phone}</a>}
                {shop?.emergencyPhone && <a href={`tel:${shop.emergencyPhone.replace(/[^+\d]/g, '')}`} className="block font-semibold text-accent" data-testid="link-emergency-phone">{shop.emergencyPhone}</a>}
                {shop?.email && <a href={`mailto:${shop.email}`} className="block break-all hover:text-accent">{shop.email}</a>}
              </div>
            </div>
            <div>
              <h3 className="eyebrow text-muted-foreground">Navigation</h3>
              <nav className="mt-5 grid gap-3 text-sm" aria-label="Navigation im Footer">
                <a href="#rreth-nesh" className="hover:text-accent">Über uns</a>
                <a href="#sherbimet" className="hover:text-accent">Leistungen</a>
                <a href="#vleresime" className="hover:text-accent">Bewertungen</a>
                <a href="#kontakt" className="hover:text-accent">Kontakt</a>
                <a href="#rezervo" className="hover:text-accent">Termin vereinbaren</a>
              </nav>
            </div>
            <div>
              <h3 className="eyebrow text-muted-foreground">Öffnungszeiten</h3>
              <dl className="mt-5 space-y-3 text-sm">
                {shop?.weeklyHours?.map((day, index) => <div key={index} className="flex justify-between gap-3"><dt>{['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'][index]}</dt><dd className="text-right tabular-nums">{!day.enabled ? <span className="text-muted-foreground">Geschlossen</span> : `${day.start}–${day.end} Uhr`}</dd></div>)}
              </dl>
            </div>
          </div>
          <div className="flex flex-col justify-between gap-4 border-t border-border pt-6 text-xs text-muted-foreground sm:flex-row sm:items-center">
            <span>© {new Date().getFullYear()} {businessName}. Alle Rechte vorbehalten.</span>
            <a href="/sign-in" className="inline-flex items-center gap-2 hover:text-accent"><LogIn size={14} />Admin Portal</a>
          </div>
        </div>
      </footer>
      {selectedWork && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-primary/90 p-4" role="dialog" aria-modal="true" aria-labelledby="portfolio-preview-title" onClick={() => setSelectedWorkId(null)}>
          <div className="relative w-full max-w-5xl overflow-hidden border border-white/20 bg-primary shadow-2xl" onClick={(event) => event.stopPropagation()}>
            <button type="button" onClick={() => setSelectedWorkId(null)} aria-label="Fotoansicht schließen" className="absolute right-3 top-3 z-10 grid h-10 w-10 place-items-center bg-primary/80 text-white" data-testid="button-close-work-preview"><X size={19} /></button>
            {selectedWork.imageUrl && <img src={selectedWork.imageUrl} alt={`${selectedWork.title} — ${selectedWork.vehicleLabel}`} className="max-h-[72vh] w-full object-contain" />}
            <div className="p-5 text-white md:p-7">
              <span className="eyebrow text-orange-300">{selectedWork.category}</span>
              <h2 id="portfolio-preview-title" className="mt-2 font-display text-3xl font-bold uppercase">{selectedWork.title}</h2>
              <p className="mt-2 text-xs text-white/65">{selectedWork.vehicleLabel} · {selectedWork.description}</p>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
