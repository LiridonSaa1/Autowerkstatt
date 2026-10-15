import { Dialog, DialogContent, DialogTitle, DialogDescription, DialogTrigger } from '@/components/ui/dialog';
import ReviewsCarousel from '@/components/reviews-carousel';
import { QuoteRequestForm } from '@/components/quotes';
import { type FormEvent, useEffect, useMemo, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import {
  ArrowDown,
  ArrowRight,
  ArrowUpRight,
  CalendarDays,
  Check,
  ChevronLeft,
  ChevronRight,
  Clock3,
  Gauge,
  MapPin,
  Menu,
  MessageCircle,
  Phone,
  ShieldCheck,
  Sparkles,
  Star,
  X,
} from 'lucide-react';
import { calendarDateKey, formatCalendarDate } from '@/lib/date-format';
import {
  getGetAvailabilityQueryKey,
  getGetShopInfoQueryKey,
  getListApprovedReviewsQueryKey,
  getListServicesQueryKey,
  useCreateAppointment,
  useCreateContactMessage,
  useCreateReview,
  useGetAvailability,
  useGetShopInfo,
  useListApprovedReviews,
  useListPortfolio,
  useListServices,
} from '@workspace/api-client-react';

const monthInput = (date: Date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
const monthsDe = ['Januar', 'Februar', 'März', 'April', 'Mai', 'Juni', 'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember'];
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
        <div key={index} className="h-56 animate-pulse rounded-xl border border-border bg-card/70" />
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
  const [month, setMonth] = useState(() => new Date());
  const [selectedDay, setSelectedDay] = useState('');
  const [selectedTime, setSelectedTime] = useState('');
  const [selectedServiceId, setSelectedServiceId] = useState('');
  const [portfolioCategory, setPortfolioCategory] = useState(portfolioCategories[0]);
  const [selectedWorkId, setSelectedWorkId] = useState<number | null>(null);
  const availabilityParams = useMemo(() => ({ month: monthInput(month) }), [month]);
  const availabilityQuery = useGetAvailability(availabilityParams, {
    query: { queryKey: getGetAvailabilityQueryKey(availabilityParams), refetchInterval: 15000 },
  });
  const createBooking = useCreateAppointment();
  const createMessage = useCreateContactMessage();
  const createReview = useCreateReview();
  const [bookingSuccess, setBookingSuccess] = useState('');
  const [reviewSuccess, setReviewSuccess] = useState('');
  const [messageSuccess, setMessageSuccess] = useState('');
  const [bookingError, setBookingError] = useState('');
  const [reviewError, setReviewError] = useState('');
  const [messageError, setMessageError] = useState('');
  const shop = shopQuery.data as (NonNullable<typeof shopQuery.data> & { email?: string }) | undefined;
  const businessName = shop?.name || 'KFZ-Service';
  const businessTagline = shop?.tagline || '';
  const { refetch: refetchShop } = shopQuery;
  useEffect(() => {
    const update = (event: StorageEvent) => {
      if (event.key === 'shop-settings-updated') void refetchShop();
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
  const availableDays = availabilityQuery.data ?? [];
  const selectedAvailability = availableDays.find((day) => calendarDateKey(day.date) === selectedDay);
  const filteredPortfolio = portfolioCategory === portfolioCategories[0]
    ? portfolio
    : portfolio.filter((item) => item.category.toLocaleLowerCase('de-DE') === portfolioCategory.toLocaleLowerCase('de-DE'));
  const selectedWork = portfolio.find((item) => item.id === selectedWorkId);
  const changeMonth = (amount: number) => {
    setMonth((current) => new Date(current.getFullYear(), current.getMonth() + amount, 1));
    setSelectedDay('');
    setSelectedTime('');
  };

  const submitBooking = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setBookingError('');
    setBookingSuccess('');
    createBooking.mutate({
      data: {
        serviceId: selectedServiceId,
        customService: selectedServiceId === 'custom' ? String(form.get('customService') ?? '') : null,
        vehicleMake: String(form.get('vehicleMake') ?? ''),
        vehicleModel: String(form.get('vehicleModel') ?? ''),
        vehicleYear: Number(form.get('vehicleYear')),
        licensePlate: String(form.get('licensePlate') ?? '') || null,
        appointmentDate: new Date(`${selectedDay}T00:00:00Z`).toISOString(),
        appointmentTime: selectedTime,
        customerName: String(form.get('customerName') ?? ''),
        phone: String(form.get('phone') ?? ''),
        email: String(form.get('email') ?? ''),
        notes: String(form.get('notes') ?? '') || null,
      },
    }, {
      onSuccess: (receipt) => {
        setBookingSuccess(`Ihre Anfrage wurde gesendet. Ihr Referenzcode lautet ${receipt.referenceCode}.`);
        setSelectedDay('');
        setSelectedTime('');
        void queryClient.invalidateQueries({ queryKey: getGetAvailabilityQueryKey(availabilityParams) });
      },
      onError: () => setBookingError('Ihre Anfrage konnte nicht gesendet werden. Bitte prüfen Sie die Angaben und versuchen Sie es erneut.'),
    });
  };

  const submitReview = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    setReviewError('');
    createReview.mutate({
      data: {
        customerName: String(form.get('reviewName') ?? ''),
        carModel: String(form.get('carModel') ?? ''),
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
            <img src={`${import.meta.env.BASE_URL}kfz-service-logo-transparent.png`} alt={businessName} width={1536} height={1024} className="h-14 w-auto object-contain sm:h-16" />
            <span className="hidden max-w-32 font-display text-sm font-bold uppercase leading-tight xl:block" data-testid="header-business-name">{businessName}</span>
          </a>
          <nav className="hidden items-center gap-6 text-[12px] font-semibold text-white/75 lg:flex">
            <a href="#rreth-nesh" className="transition-colors hover:text-orange-300">Über uns</a>
            <a href="#punet" className="transition-colors hover:text-orange-300">Unsere Arbeiten</a>
            <a href="#sherbimet" className="transition-colors hover:text-orange-300">Leistungen</a>
            <a href="#angebote" className="hover:text-orange-300">Angebot</a>
            <a href="#vleresime" className="transition-colors hover:text-orange-300">Bewertungen</a>
            <a href="#kontakt" className="transition-colors hover:text-orange-300">Kontakt</a>
            <a href="/sign-in" className="transition-colors hover:text-orange-300">Admin</a>
          </nav>
          <a href="#rezervo" className="hidden items-center gap-2 bg-accent px-5 py-3 text-[11px] font-bold uppercase tracking-wider text-white transition-transform hover:-translate-y-0.5 sm:flex">
            Termin vereinbaren
            <ArrowUpRight size={15} />
          </a>
          <button type="button" onClick={() => setMenuOpen((value) => !value)} className="grid h-10 w-10 place-items-center border border-white/25 lg:hidden" aria-label={menuOpen ? 'Menü schließen' : 'Menü öffnen'} data-testid="button-menu">
            {menuOpen ? <X size={19} /> : <Menu size={19} />}
          </button>
        </div>
        {menuOpen && (
          <nav className="grid gap-4 border-t border-white/15 bg-primary px-6 py-6 text-sm text-white lg:hidden">
            <a href="#rreth-nesh" onClick={() => setMenuOpen(false)}>Über uns</a>
            <a href="#punet" onClick={() => setMenuOpen(false)}>Unsere Arbeiten</a>
            <a href="#sherbimet" onClick={() => setMenuOpen(false)}>Leistungen</a>
            <a href="#angebote" className="hover:text-orange-300">Angebot</a>
            <a href="#vleresime" onClick={() => setMenuOpen(false)}>Bewertungen</a>
            <a href="#kontakt" onClick={() => setMenuOpen(false)}>Kontakt</a>
            <a href="/sign-in" onClick={() => setMenuOpen(false)}>Administrator-Anmeldung</a>
            <a href="#rezervo" onClick={() => setMenuOpen(false)} className="font-bold text-orange-300">Termin vereinbaren</a>
          </nav>
        )}
      </header>

      <section id="fillimi" className="relative flex min-h-[730px] items-end bg-primary text-white md:min-h-[800px]">
        <div className="absolute inset-y-0 right-0 w-full overflow-hidden md:w-[76%]">
          <img src={`${import.meta.env.BASE_URL}workshop-hero.jpg`} alt="" className="h-full w-full object-cover object-center opacity-55 mix-blend-luminosity md:opacity-65 md:mix-blend-normal" />
          <div className="absolute inset-0 bg-gradient-to-r from-primary via-primary/75 to-primary/25 md:via-primary/55" />
          <div className="absolute inset-0 bg-gradient-to-t from-primary via-transparent to-primary/45" />
        </div>
        <div className="hero-lines absolute inset-0 opacity-70" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_72%_42%,rgba(233,99,52,.18),transparent_40%)]" />
        <div className="absolute right-[-8%] top-[20%] hidden h-[500px] w-[62%] border border-white/10 md:block">
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
            <h1 className="reveal reveal-delay-1 font-display text-[clamp(4.4rem,10.7vw,9.8rem)] font-bold uppercase leading-[.78] tracking-[-.035em]">
              Ihr Auto.
              <br />
              <span className="text-orange-300">In guten</span>
              <br />
              Händen.
            </h1>
            <p className="reveal reveal-delay-2 mt-8 max-w-[520px] text-sm leading-7 text-white/65 md:text-base">
              Faire Reparaturen, sorgfältige Fahrzeugpflege und klare Informationen vor Ihrer Entscheidung. Entdecken Sie unsere Leistungen und buchen Sie online.
            </p>
            <div className="reveal reveal-delay-3 mt-9 flex flex-wrap gap-3">
              <a href="#rezervo" className="inline-flex items-center gap-3 bg-accent px-6 py-4 text-[11px] font-bold uppercase tracking-wider text-foreground transition-transform hover:-translate-y-1" data-testid="link-book-hero">
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
          { icon: ShieldCheck, title: 'Transparente Arbeit', text: 'Sie wissen, was wir tun und warum.' },
          { icon: Gauge, title: 'Praktische Lösungen', text: 'Passend zu Ihrem Fahrzeug und Bedarf.' },
          { icon: Sparkles, title: 'Sorgfältige Fahrzeugpflege', text: 'Sauber bis ins Detail, innen und außen.' },
          { icon: CalendarDays, title: 'Einfach Termine anfragen', text: 'Wählen Sie Tag und Uhrzeit online.' },
        ].map(({ icon: Icon, title, text }) => (
          <div key={title} className="flex min-h-[126px] items-center gap-4 border-b border-r border-border px-5 py-5 last:border-r-0 md:border-b-0 md:px-7">
            <Icon className="shrink-0 text-accent" size={22} strokeWidth={1.8} />
            <div>
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
            <div className="mt-10 grid max-w-3xl grid-cols-1 border-y border-border py-6 sm:grid-cols-3">
              <div className="pr-5">
                <span className="font-display text-2xl font-bold uppercase">Zertifizierte Mechaniker</span>
                <p className="mt-1 text-xs text-muted-foreground">Erfahrung und Sorgfalt für jedes Fahrzeug.</p>
              </div>
              <div className="border-l border-border pl-6">
                <span className="font-display text-2xl font-bold uppercase">Moderne Ausstattung</span>
                <p className="mt-1 text-xs text-muted-foreground">Präzise Diagnose und gründliche Prüfung.</p>
              </div>
              <div className="border-l border-border pl-6">
                <span className="font-display text-2xl font-bold uppercase">Garantie auf unsere Arbeit</span>
                <p className="mt-1 text-xs text-muted-foreground">Service, bei dem Sie im Mittelpunkt stehen.</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section id="punet" className="scroll-mt-16 bg-primary px-5 py-24 text-white md:px-10 md:py-32">
        <div className="mx-auto max-w-[1340px]">
          <div className="mb-12 flex flex-col justify-between gap-6 md:flex-row md:items-end">
            <div>
              <SectionEyebrow inverse>Unsere Arbeiten</SectionEyebrow>
              <h2 className="mt-5 font-display text-6xl font-bold uppercase leading-[.87] tracking-tight md:text-8xl">Zurück auf die Straße,<br />frisch aufbereitet.</h2>
            </div>
            <p className="max-w-[340px] text-sm leading-7 text-white/55">Aktuelle Ergebnisse aus unserer Werkstatt. Jede Arbeit beginnt mit einer klaren Einschätzung und endet mit einer Abschlusskontrolle.</p>
          </div>
          {portfolioQuery.isLoading && <LoadingCards count={3} />}
          {portfolioQuery.isError && (
            <div className="border border-white/15 p-6 text-sm text-white/70" role="alert">
              Die Arbeiten konnten nicht geladen werden.
              <button type="button" onClick={() => void portfolioQuery.refetch()} className="ml-3 text-orange-300 underline">Erneut versuchen</button>
            </div>
          )}
          {!portfolioQuery.isLoading && !portfolioQuery.isError && portfolio.length === 0 && (
            <div className="border border-dashed border-white/25 px-8 py-14 text-center">
              <Sparkles className="mx-auto text-orange-300" />
              <p className="mt-4 text-sm text-white/65">Unsere Galerie mit abgeschlossenen Arbeiten wird in Kürze aktualisiert.</p>
            </div>
          )}
          {portfolio.length > 0 && (
            <>
              <div className="mb-7 flex flex-wrap gap-2" role="group" aria-label="Galerie filtern">
                {portfolioCategories.map((category) => (
                  <button key={category} type="button" onClick={() => setPortfolioCategory(category)} aria-pressed={portfolioCategory === category} className={`border px-4 py-2.5 text-[10px] font-bold uppercase tracking-wider transition-colors ${portfolioCategory === category ? 'border-accent bg-accent text-foreground' : 'border-white/20 text-white/65 hover:border-white/50 hover:text-white'}`} data-testid={`filter-portfolio-${category.toLocaleLowerCase('de-DE').replaceAll(' ', '-')}`}>{category}</button>
                ))}
              </div>
              {filteredPortfolio.length === 0 ? (
                <div className="border border-dashed border-white/25 px-8 py-14 text-center text-sm text-white/60">In dieser Kategorie sind noch keine Arbeiten vorhanden.</div>
              ) : (
            <div className="grid gap-4 md:grid-cols-12">
              {filteredPortfolio.slice(0, 5).map((item, index) => (
                <article key={item.id} className={`group relative min-h-[300px] overflow-hidden border border-white/10 bg-[#263a42] ${index === 0 ? 'md:col-span-7 md:row-span-2 md:min-h-[620px]' : 'md:col-span-5'}`} data-testid={`card-work-${item.id}`}>
                  {item.imageUrl ? <img src={item.imageUrl} alt={`${item.title} — ${item.vehicleLabel}`} className="absolute inset-0 h-full w-full object-cover opacity-75 transition-transform duration-700 group-hover:scale-[1.035]" /> : <div className="absolute inset-0 hero-lines opacity-30" />}
                  <div className="absolute inset-0 bg-gradient-to-t from-primary via-primary/10 to-transparent" />
                  <div className="absolute inset-x-0 bottom-0 p-6 md:p-8">
                    <span className="eyebrow text-orange-300">{item.category}</span>
                    <h3 className="mt-2 font-display text-3xl font-bold uppercase">{item.title}</h3>
                    <div className="mt-2 flex flex-wrap items-center gap-x-4 text-xs text-white/65">
                      <span>{item.vehicleLabel}</span>
                      {item.completedAt && <span>{formatCalendarDate(item.completedAt)}</span>}
                    </div>
                    <p className="mt-3 max-w-lg text-xs leading-5 text-white/70">{item.description}</p>
                    <button type="button" onClick={() => setSelectedWorkId(item.id)} className="mt-4 inline-flex items-center gap-2 border-b border-orange-300 pb-1 text-[10px] font-bold uppercase tracking-wider text-orange-300" data-testid={`button-preview-work-${item.id}`}>Foto ansehen <ArrowUpRight size={13} /></button>
                  </div>
                </article>
              ))}
            </div>
              )}
            </>
          )}
        </div>
      </section>

      <section id="sherbimet" className="surface-grid scroll-mt-16 px-5 py-24 md:px-10 md:py-32">
        <div className="mx-auto max-w-[1340px]">
          <div className="mb-12 flex flex-col justify-between gap-7 md:flex-row md:items-end">
            <div>
              <SectionEyebrow>Leistungen</SectionEyebrow>
              <h2 className="mt-5 max-w-3xl font-display text-6xl font-bold uppercase leading-[.9] tracking-tight md:text-8xl">Bereit für jeden<br />Kilometer.</h2>
            </div>
            <p className="max-w-[360px] text-sm leading-7 text-muted-foreground">Von der regelmäßigen Wartung bis zur umfassenden Aufbereitung – wir hören zu und finden heraus, was Ihr Fahrzeug braucht.</p>
          </div>
          {serviceQuery.isLoading ? <LoadingCards count={4} /> : null}
          {serviceQuery.isError && (
            <div className="border border-destructive/30 bg-card p-6 text-sm" role="alert">
              <p className="font-semibold">Die Leistungen konnten nicht geladen werden.</p>
              <button type="button" onClick={() => void serviceQuery.refetch()} className="mt-3 text-accent underline">Erneut versuchen</button>
            </div>
          )}
          {!serviceQuery.isLoading && !serviceQuery.isError && services.length === 0 && (
            <div className="border border-dashed border-border bg-card/70 p-10 text-center text-sm text-muted-foreground">Unsere Leistungen erscheinen hier, sobald sie veröffentlicht sind.</div>
          )}
          {services.length > 0 && (
            <div className="grid border-l border-t border-border sm:grid-cols-2 lg:grid-cols-3">
              {services.map((service, index) => (
                <article key={service.id} className="group relative min-h-[245px] border-b border-r border-border bg-card p-7 transition-colors hover:bg-primary hover:text-primary-foreground md:p-9" data-testid={`card-service-${service.id}`}>
                  <span className="absolute right-7 top-7 font-display text-4xl font-bold text-accent/70">0{index + 1}</span>
                  <span className="eyebrow text-muted-foreground group-hover:text-orange-200">{service.category}</span>
                  <h3 className="mt-6 max-w-[75%] font-display text-3xl font-bold uppercase leading-none">{service.name}</h3>
                  <p className="mt-4 max-w-[380px] text-xs leading-6 text-muted-foreground group-hover:text-white/65">{service.description}</p>
                  <div className="mt-6 flex items-center justify-between border-t border-border/70 pt-4 text-[10px] font-bold uppercase tracking-wider group-hover:border-white/20">
                    <span>{service.priceLabel}</span>
                    <span className="flex items-center gap-1.5 text-muted-foreground group-hover:text-orange-200"><Clock3 size={13} /> {service.durationMinutes} min</span>
                  </div>
                  <a href="#rezervo" onClick={() => setSelectedServiceId(service.id)} className="mt-5 inline-flex items-center gap-2 text-[10px] font-bold uppercase tracking-wider text-accent group-hover:text-orange-200" data-testid={`link-book-service-${service.id}`}>Diese Leistung buchen <ArrowRight size={13} /></a>
                </article>
              ))}
            </div>
          )}
          <a href="#rezervo" className="mt-8 inline-flex items-center gap-3 text-xs font-bold uppercase tracking-wider text-accent hover:gap-5 transition-all">Passenden Termin finden <ArrowRight size={15} /></a>
        </div>
      </section>

      <section className="bg-[#ddd9cf] px-5 py-20 md:px-10 md:py-24">
        <div className="mx-auto grid max-w-[1340px] gap-12 lg:grid-cols-[.7fr_1.3fr]">
          <div>
            <SectionEyebrow>So arbeiten wir</SectionEyebrow>
            <h2 className="mt-5 max-w-lg font-display text-5xl font-bold uppercase leading-[.9] md:text-7xl">Transparent,<br />von Anfang an.</h2>
          </div>
          <div className="grid gap-0 sm:grid-cols-3">
            {[
              ['01', 'Bedarf schildern', 'Wählen Sie eine Leistung und nennen Sie uns die Fahrzeugdaten.'],
              ['02', 'Termin auswählen', 'Sehen Sie freie Termine und senden Sie Ihre Anfrage.'],
              ['03', 'Wir melden uns', 'Wir bestätigen Ihren Termin und besprechen die nächsten Schritte.'],
            ].map(([number, title, detail]) => (
              <div key={number} className="border-t border-primary/20 py-6 sm:ml-6 sm:first:ml-0 sm:border-l sm:border-t-0 sm:pl-6">
                <span className="font-display text-5xl font-bold text-accent">{number}</span>
                <h3 className="mt-4 font-display text-2xl font-bold uppercase">{title}</h3>
                <p className="mt-2 max-w-[220px] text-xs leading-6 text-muted-foreground">{detail}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section id="vleresime" className="scroll-mt-16 px-5 py-24 md:px-10 md:py-32">
        <div className="mx-auto max-w-[1340px]">
          <div className="mb-10 flex flex-col justify-between gap-8 md:flex-row md:items-end">
            <div><SectionEyebrow>Kundenstimmen</SectionEyebrow><h2 className="mt-5 font-display text-6xl font-bold uppercase leading-[.88] md:text-8xl">Vertrauen verbindet.</h2><p className="mt-6 max-w-xl text-sm leading-7 text-muted-foreground">Lesen Sie die Erfahrungen unserer Kunden. Neue Bewertungen werden nach Prüfung freigegeben.</p></div>
            <Dialog open={reviewOpen} onOpenChange={(open) => { if (!createReview.isPending) { setReviewOpen(open); if (open) { setReviewError(''); setReviewSuccess(''); } } }}>
              <DialogTrigger asChild><button className="inline-flex shrink-0 items-center justify-center gap-3 bg-accent px-6 py-4 text-xs font-bold uppercase tracking-wider text-accent-foreground" data-testid="button-open-review"><MessageCircle size={18} />Bewertung abgeben</button></DialogTrigger>
              <DialogContent className="max-w-2xl border-white/15 bg-primary p-6 text-white md:p-9">
                <div><span className="eyebrow text-orange-300">Erfahrung teilen</span><DialogTitle className="mt-3 font-display text-3xl font-bold uppercase">Wie war Ihr Besuch?</DialogTitle><DialogDescription className="mt-3 text-sm text-white/70">Ihre Bewertung wird geprüft und nach Freigabe veröffentlicht.</DialogDescription></div>
                            <form className="mt-7 grid gap-4 sm:grid-cols-2" onSubmit={submitReview}>
              <label className="grid gap-2 text-xs text-white/70">Ihr Name<input required minLength={2} maxLength={120} name="reviewName" className="h-11 border border-white/20 bg-white/5 px-3 text-sm text-white outline-none focus:border-orange-300" placeholder="Vor- und Nachname" data-testid="input-review-name" /></label>
              <label className="grid gap-2 text-xs text-white/70">Fahrzeug<input required minLength={2} maxLength={120} name="carModel" className="h-11 border border-white/20 bg-white/5 px-3 text-sm text-white outline-none focus:border-orange-300" placeholder="z. B. Marke und Modell" data-testid="input-review-car" /></label>
              <fieldset disabled={createReview.isPending} className="min-w-0 sm:col-span-2">
                <legend className="mb-2 text-xs text-white/70">Bewertung</legend>
                <div className="flex flex-wrap items-center gap-3">
                  <div className="flex gap-1" onMouseLeave={() => setHoverRating(null)}>
                    {[1, 2, 3, 4, 5].map(rating => <label key={rating} className="relative flex h-11 w-11 cursor-pointer items-center justify-center rounded-lg transition-colors hover:bg-white/5" onMouseEnter={() => setHoverRating(rating)}>
                      <input type="radio" name="rating" value={rating} checked={reviewRating === rating} onChange={() => setReviewRating(rating)} aria-label={`${rating} von 5 Sternen`} className="peer sr-only" data-testid={`input-review-rating-${rating}`} />
                      <Star size={31} aria-hidden="true" className={`rounded-sm transition-colors peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-offset-4 peer-focus-visible:outline-orange-300 ${rating <= (hoverRating ?? reviewRating) ? 'fill-orange-400 text-orange-400' : 'text-white/35'}`} />
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
          {reviewSuccess && <p role="status" className="mb-6 rounded-lg border border-emerald-700/20 bg-emerald-700/5 p-4 text-sm text-emerald-800">{reviewSuccess}</p>}
          {reviewQuery.isLoading && <div className="h-56 animate-pulse rounded-xl bg-muted" />}
          {reviewQuery.isError && <p className="text-sm text-destructive" role="alert">Die Bewertungen konnten nicht geladen werden. <button onClick={() => void reviewQuery.refetch()} className="underline">Erneut versuchen</button></p>}
          {!reviewQuery.isLoading && !reviewQuery.isError && reviews.length === 0 && <div className="rounded-xl border border-border bg-card px-6 py-14 text-center"><MessageCircle size={30} className="mx-auto text-accent" /><p className="mt-4 text-sm text-muted-foreground">Es gibt noch keine veröffentlichten Bewertungen. Teilen Sie als Erster Ihre Erfahrung.</p></div>}
          {reviews.length > 0 && <ReviewsCarousel reviews={reviews} />}
        </div>
      </section>

      <section id="rezervo" className="scroll-mt-16 bg-primary px-5 py-24 text-white md:px-10 md:py-32">
        <div className="mx-auto max-w-[1340px]">
          <div className="mb-12 grid gap-8 md:grid-cols-[1fr_360px] md:items-end">
            <div>
              <SectionEyebrow inverse>Online-Terminvereinbarung</SectionEyebrow>
              <h2 className="mt-5 font-display text-6xl font-bold uppercase leading-[.87] md:text-8xl">Wählen Sie<br />Ihren Wunschtag.</h2>
            </div>
            <p className="text-sm leading-7 text-white/55">Fragen Sie Ihren Termin bequem online an. Wir bestätigen die Details persönlich mit Ihnen.</p>
          </div>
          <div className="grid overflow-hidden border border-white/15 lg:grid-cols-[.8fr_1.2fr]">
            <div className="border-b border-white/15 p-6 md:p-9 lg:border-b-0 lg:border-r">
              <div className="flex items-center justify-between">
                <div>
                  <span className="eyebrow text-white/45">Verfügbarkeit</span>
                  <h3 className="mt-2 font-display text-3xl font-bold uppercase">{monthsDe[month.getMonth()]} {month.getFullYear()}</h3>
                </div>
                <div className="flex gap-2">
                  <button type="button" onClick={() => changeMonth(-1)} aria-label="Vorheriger Monat" className="grid h-10 w-10 place-items-center border border-white/20 hover:bg-white/10" data-testid="button-previous-month"><ChevronLeft size={17} /></button>
                  <button type="button" onClick={() => changeMonth(1)} aria-label="Nächster Monat" className="grid h-10 w-10 place-items-center border border-white/20 hover:bg-white/10" data-testid="button-next-month"><ChevronRight size={17} /></button>
                </div>
              </div>
              {availabilityQuery.isLoading && <div className="mt-6 grid grid-cols-7 gap-2">{Array.from({ length: 14 }).map((_, index) => <div key={index} className="h-10 animate-pulse bg-white/10" />)}</div>}
              {availabilityQuery.isError && (
                <div className="mt-6 border border-white/20 p-4 text-xs text-white/70" role="alert">
                  Die verfügbaren Zeiten konnten nicht geladen werden.
                  <button type="button" onClick={() => void availabilityQuery.refetch()} className="ml-2 text-orange-300 underline">Erneut versuchen</button>
                </div>
              )}
              {!availabilityQuery.isLoading && !availabilityQuery.isError && availableDays.length === 0 && <div className="mt-6 border border-dashed border-white/20 p-5 text-xs leading-6 text-white/55">Für diesen Monat sind keine Termine veröffentlicht. Wählen Sie einen anderen Monat oder schreiben Sie uns.</div>}
              {availableDays.length > 0 && (
                <div className="mt-6">
                  <div className="grid grid-cols-7 gap-1.5 text-center text-[9px] font-bold uppercase text-white/35">
                    {['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'].map((letter, index) => <span key={`${letter}-${index}`} className="py-2">{letter}</span>)}
                  </div>
                  <div className="grid grid-cols-7 gap-1.5">
                    {(() => {
                      const start = new Date(month.getFullYear(), month.getMonth(), 1);
                      const offset = (start.getDay() + 6) % 7;
                      const lastDay = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
                      return Array.from({ length: offset + lastDay }).map((_, index) => {
                        if (index < offset) return <span key={`blank-${index}`} />;
                        const date = `${month.getFullYear()}-${String(month.getMonth() + 1).padStart(2, '0')}-${String(index - offset + 1).padStart(2, '0')}`;
                         const day = availableDays.find((item) => calendarDateKey(item.date) === date);
                        const enabled = Boolean(day?.open && day.slots.some((slot) => slot.available));
                        return <button key={date} type="button" disabled={!enabled} onClick={() => { setSelectedDay(date); setSelectedTime(''); }} className={`relative grid aspect-square place-items-center text-xs transition-colors ${selectedDay === date ? 'bg-accent font-bold text-foreground' : enabled ? 'bg-white/10 text-white hover:bg-white/20' : 'text-white/20'}`} aria-label={`${index - offset + 1} ${monthsDe[month.getMonth()]}`} data-testid={`button-day-${date}`}>
                          {index - offset + 1}
                          {enabled && selectedDay !== date && <span className="absolute bottom-1 h-1 w-1 rounded-full bg-orange-300" />}
                        </button>;
                      });
                    })()}
                  </div>
                </div>
              )}
              {selectedAvailability && (
                <div className="mt-6 border-t border-white/15 pt-5">
                   <p className="text-xs font-semibold">{formatCalendarDate(selectedDay, { weekday: 'long', day: 'numeric', month: 'long' })}</p>
                  <div className="mt-3 flex flex-wrap gap-2">
                     {selectedAvailability.slots.map((slot) => <button key={slot.time} type="button" disabled={!slot.available} onClick={() => setSelectedTime(slot.time)} className={`border px-3 py-2 text-[11px] ${selectedTime === slot.time ? 'border-accent bg-accent text-foreground' : slot.available ? 'border-white/20 text-white/70 hover:border-white/50' : 'cursor-not-allowed border-white/10 text-white/30 line-through'}`} data-testid={`button-slot-${slot.time}`} aria-label={`${slot.time} — ${slot.available ? 'frei' : 'belegt'}`}>{slot.time}{!slot.available && ' · Belegt'}</button>)}
                  </div>
                </div>
              )}
            </div>
            <form className="grid gap-4 p-6 md:grid-cols-2 md:p-9" onSubmit={submitBooking}>
              <label className="grid gap-2 text-xs text-white/65 md:col-span-2">Leistung
                <select required name="serviceId" value={selectedServiceId} onChange={(event) => setSelectedServiceId(event.target.value)} className="h-12 border border-white/20 bg-[#213943] px-3 text-sm text-white outline-none focus:border-orange-300" data-testid="select-booking-service">
                  <option value="" disabled>Leistung auswählen</option>
                  {services.map((service) => <option key={service.id} value={service.id}>{service.name} — {service.priceLabel}</option>)}
                  <option value="custom">Andere Leistung</option>
                </select>
              </label>
              {selectedServiceId === 'custom' && <label className="grid gap-2 text-xs text-white/65 md:col-span-2">Gewünschte Leistung beschreiben<input required minLength={3} maxLength={160} name="customService" className="h-12 border border-white/20 bg-white/5 px-3 text-sm text-white outline-none focus:border-orange-300" data-testid="input-booking-custom-service" /></label>}
              <label className="grid gap-2 text-xs text-white/65">Vollständiger Name<input required minLength={2} maxLength={120} name="customerName" className="h-12 border border-white/20 bg-white/5 px-3 text-sm text-white outline-none focus:border-orange-300" data-testid="input-booking-name" /></label>
              <label className="grid gap-2 text-xs text-white/65">Telefon<input required minLength={5} maxLength={40} type="tel" name="phone" className="h-12 border border-white/20 bg-white/5 px-3 text-sm text-white outline-none focus:border-orange-300" data-testid="input-booking-phone" /></label>
              <label className="grid gap-2 text-xs text-white/65">E-Mail<input required type="email" name="email" className="h-12 border border-white/20 bg-white/5 px-3 text-sm text-white outline-none focus:border-orange-300" data-testid="input-booking-email" /></label>
              <label className="grid gap-2 text-xs text-white/65">Kennzeichen oder FIN (optional)<input maxLength={24} name="licensePlate" className="h-12 border border-white/20 bg-white/5 px-3 text-sm text-white outline-none focus:border-orange-300" data-testid="input-booking-plate" /></label>
              <label className="grid gap-2 text-xs text-white/65">Marke<input required maxLength={80} name="vehicleMake" className="h-12 border border-white/20 bg-white/5 px-3 text-sm text-white outline-none focus:border-orange-300" data-testid="input-booking-make" /></label>
              <label className="grid gap-2 text-xs text-white/65">Modell<input required maxLength={80} name="vehicleModel" className="h-12 border border-white/20 bg-white/5 px-3 text-sm text-white outline-none focus:border-orange-300" data-testid="input-booking-model" /></label>
              <label className="grid gap-2 text-xs text-white/65">Baujahr<input required type="number" min="1950" max="2100" name="vehicleYear" className="h-12 border border-white/20 bg-white/5 px-3 text-sm text-white outline-none focus:border-orange-300" data-testid="input-booking-year" /></label>
              <label className="grid gap-2 text-xs text-white/65">Gewähltes Datum<input readOnly required value={selectedDay} placeholder="Datum im Kalender auswählen" className="h-12 border border-white/20 bg-white/5 px-3 text-sm text-white outline-none placeholder:text-white/35" data-testid="input-booking-date" /></label>
              <label className="grid gap-2 text-xs text-white/65 md:col-span-2">Weitere Hinweise<textarea maxLength={2000} name="notes" rows={3} className="resize-y border border-white/20 bg-white/5 px-3 py-3 text-sm text-white outline-none focus:border-orange-300" placeholder="Beschreiben Sie kurz Ihr Anliegen (optional)" data-testid="input-booking-notes" /></label>
              {(!selectedDay || !selectedTime) && <p className="text-[11px] text-orange-200 md:col-span-2">Wählen Sie einen freien Tag und eine Uhrzeit, um fortzufahren.</p>}
              <div className="md:col-span-2">
                <button type="submit" disabled={!selectedDay || !selectedTime || createBooking.isPending || services.length === 0} className="inline-flex min-h-12 items-center gap-3 bg-accent px-6 text-xs font-bold uppercase tracking-wider text-foreground disabled:cursor-not-allowed disabled:opacity-50" data-testid="button-submit-booking">{createBooking.isPending ? 'Wird gesendet…' : 'Anfrage senden'} <ArrowRight size={15} /></button>
                {bookingSuccess && <p className="mt-4 flex items-center gap-2 text-sm text-emerald-200" role="status"><Check size={16} />{bookingSuccess}</p>}
                {bookingError && <p className="mt-4 text-sm text-orange-200" role="alert">{bookingError}</p>}
              </div>
            </form>
          </div>
        </div>
      </section>

      <QuoteRequestForm />
      <section id="kontakt" className="scroll-mt-16 px-5 py-24 md:px-10 md:py-32">
        <div className="mx-auto grid max-w-[1340px] gap-12 lg:grid-cols-[.8fr_1.2fr]">
          <div>
            <SectionEyebrow>So finden Sie uns</SectionEyebrow>
            <h2 className="mt-5 font-display text-6xl font-bold uppercase leading-[.88] md:text-8xl">Wir sind<br />für Sie da.</h2>
            <p className="mt-6 max-w-[390px] text-sm leading-7 text-muted-foreground">Haben Sie vor der Terminvereinbarung eine Frage? Schreiben Sie uns, wir melden uns schnellstmöglich.</p>
            <div className="mt-8 grid gap-5">
              <div className="flex items-start gap-4">
                <Phone className="mt-0.5 text-accent" size={18} />
                <div><p className="text-[10px] font-bold uppercase tracking-wider">Telefon</p><p className="mt-1 text-sm text-muted-foreground">{shop?.phone ? <a href={`tel:${shop.phone.replace(/[^+\d]/g, '')}`} className="hover:text-accent" data-testid="link-shop-phone">{shop.phone}</a> : shopQuery.isLoading ? 'Wird geladen…' : shopQuery.isError ? 'Informationen konnten nicht geladen werden' : 'Telefonnummer folgt'}</p></div>
              </div>
              {shop?.emergencyPhone && <div className="flex items-start gap-4"><Phone className="mt-0.5 text-accent" size={18} /><div><p className="text-[10px] font-bold uppercase tracking-wider">Notfallnummer</p><a href={`tel:${shop.emergencyPhone.replace(/[^+\d]/g, '')}`} className="mt-1 inline-block text-sm text-muted-foreground hover:text-accent" data-testid="link-emergency-phone">{shop.emergencyPhone}</a></div></div>}
              <div className="flex items-start gap-4">
                <MapPin className="mt-0.5 text-accent" size={18} />
                <div><p className="text-[10px] font-bold uppercase tracking-wider">Standort</p><p className="mt-1 text-sm text-muted-foreground">{shopQuery.isLoading ? 'Wird geladen…' : shopQuery.isError ? 'Informationen konnten nicht geladen werden' : [shop?.address, shop?.city].filter(Boolean).join(', ') || 'Adresse vor Veröffentlichung ergänzen'}</p></div>
              </div>
              <div className="flex items-start gap-4">
                <Clock3 className="mt-0.5 text-accent" size={18} />
                <div><p className="text-[10px] font-bold uppercase tracking-wider">Öffnungszeiten</p><p className="mt-1 text-sm text-muted-foreground">{shopQuery.isLoading ? 'Wird geladen…' : shopQuery.isError ? 'Informationen konnten nicht geladen werden' : shop?.openingHours || 'Öffnungszeiten vor Veröffentlichung ergänzen'}</p></div>
              </div>
              {shop?.email && <a href={`mailto:${shop.email}`} className="text-sm text-accent hover:underline">{shop.email}</a>}
              {shop?.whatsapp && <a href={`https://wa.me/${shop.whatsapp.replace(/\D/g, '')}`} target="_blank" rel="noreferrer" className="inline-flex w-fit items-center gap-2 text-xs font-bold text-accent hover:underline" data-testid="link-whatsapp"><MessageCircle size={15} /> Auf WhatsApp schreiben</a>}
              {shopQuery.isError && <button type="button" onClick={() => void shopQuery.refetch()} className="w-fit text-left text-xs text-accent underline">Kontaktdaten erneut laden</button>}
            </div>
            {shop?.mapUrl ? (
              <iframe src={shop.mapUrl} title="Standort unserer Werkstatt" loading="lazy" referrerPolicy="no-referrer-when-downgrade" className="mt-8 h-64 w-full border border-border" allowFullScreen data-testid="map-preview" />
            ) : (
              <div className="mt-8 grid h-64 place-items-center border border-dashed border-border bg-muted/50 px-6 text-center text-xs leading-5 text-muted-foreground">Die Karte erscheint, sobald ein Kartenlink hinterlegt ist.</div>
            )}
            {shop?.mapUrl && <a href={shop.mapUrl} target="_blank" rel="noreferrer" className="mt-4 inline-flex items-center gap-2 border-b border-accent pb-2 text-[10px] font-bold uppercase tracking-wider" data-testid="link-map">Karte öffnen <ArrowUpRight size={14} /></a>}
          </div>
          <div className="border border-border bg-card p-6 shadow-sm md:p-10">
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

      <footer className="bg-primary px-5 py-10 text-white md:px-10">
        <div className="mx-auto flex max-w-[1340px] flex-col justify-between gap-8 border-b border-white/15 pb-8 md:flex-row md:items-end">
          <div>
            <span className="font-display text-3xl font-bold uppercase">{businessName}</span>
            <p className="mt-2 text-xs text-white/45">{businessTagline}</p>
          </div>
          <div className="flex flex-wrap gap-x-6 gap-y-3 text-[10px] font-semibold uppercase tracking-wider text-white/60">
            <a href="#rreth-nesh" className="hover:text-orange-300">Über uns</a>
            <a href="#punet" className="hover:text-orange-300">Arbeiten</a>
            <a href="#sherbimet" className="hover:text-orange-300">Leistungen</a>
            <a href="#angebote" className="hover:text-orange-300">Angebot</a>
            <a href="#vleresime" className="hover:text-orange-300">Bewertungen</a>
            <a href="#rezervo" className="hover:text-orange-300">Termin anfragen</a>
            <a href="#kontakt" className="hover:text-orange-300">Kontakt</a>
            <a href="/sign-in" className="hover:text-orange-300">Administrator-Anmeldung</a>
          </div>
        </div>
        <div className="mx-auto flex max-w-[1340px] flex-col justify-between gap-2 pt-5 text-[10px] text-white/35 sm:flex-row">
          <span>© {new Date().getFullYear()} {businessName}</span>
          <span>Faire Wartung. Termine bequem online.</span>
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
