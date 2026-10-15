import { useEffect, useState } from 'react';
import { Quote, Star, CarFront, Pause, Play } from 'lucide-react';
import type { Review } from '@workspace/api-client-react';
import { Carousel, CarouselContent, CarouselItem, CarouselPrevious, CarouselNext, type CarouselApi } from '@/components/ui/carousel';

export default function ReviewsCarousel({ reviews }: { reviews: Review[] }) {
  const [api, setApi] = useState<CarouselApi>();
  const [selected, setSelected] = useState(0);
  const [snaps, setSnaps] = useState<number[]>([]);
  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);
  const [paused, setPaused] = useState(false);
  useEffect(() => {
    if (!api) return;
    const update = () => { setSelected(api.selectedScrollSnap()); setSnaps(api.scrollSnapList()); };
    update(); api.on('select', update); api.on('reInit', update);
    return () => { api.off('select', update); api.off('reInit', update); };
  }, [api]);
  useEffect(() => {
    if (!api || snaps.length < 2 || hovered || focused || paused) return;
    const timer = window.setInterval(() => {
      if (document.hidden || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
      if (api.canScrollNext()) api.scrollNext();
      else api.scrollTo(0);
    }, 5000);
    return () => window.clearInterval(timer);
  }, [api, snaps.length, selected, hovered, focused, paused]);
  return <Carousel setApi={setApi} opts={{ align: 'start', slidesToScroll: 1, containScroll: 'trimSnaps' }} aria-label="Kundenbewertungen" className="group/reviews" onMouseEnter={() => setHovered(true)} onMouseLeave={() => setHovered(false)} onFocusCapture={() => setFocused(true)} onBlurCapture={event => { if (!event.currentTarget.contains(event.relatedTarget)) setFocused(false); }} onPointerDown={() => setHovered(true)} onPointerUp={event => { if (event.pointerType !== 'mouse') setHovered(false); }} onPointerCancel={() => setHovered(false)}>
    <CarouselContent className="-ml-5 items-stretch py-3">
      {reviews.map(review => {
        const initials = review.customerName.trim().split(/\s+/).filter(Boolean).slice(0, 2).map(name => name[0]).join('').toUpperCase();
        return <CarouselItem key={review.id} className="flex pl-5 md:basis-1/2">
          <article className="relative flex min-h-[310px] w-full flex-col overflow-hidden rounded-2xl border border-border bg-card p-6 shadow-[0_4px_20px_-12px_rgba(16,35,45,0.22)] transition-colors hover:border-accent/40 sm:p-8" data-testid={`review-featured-${review.id}`}>
            <div className="absolute inset-x-8 top-0 h-0.5 bg-gradient-to-r from-accent/70 via-accent/20 to-transparent" />
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-3"><span className="flex gap-1 text-accent" aria-label={`${review.rating} von 5 Sternen`}>{Array.from({ length: 5 }, (_, index) => <Star key={index} size={16} aria-hidden="true" className={index < review.rating ? 'fill-current' : 'text-accent/25'} />)}</span><span className="text-xs font-bold tabular-nums text-foreground">{review.rating.toFixed(1)}<span className="font-normal text-muted-foreground"> / 5</span></span></div>
              <Quote size={32} strokeWidth={1.2} className="shrink-0 text-accent/25" aria-hidden="true" />
            </div>
            <blockquote className="my-7 flex-1"><p className="break-words text-base font-medium leading-8 text-foreground/85 sm:text-lg">„{review.comment}“</p></blockquote>
            <footer className="flex items-center gap-3 border-t border-border/70 pt-5">
              <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl border border-accent/15 bg-accent/10 text-sm font-bold text-accent" aria-hidden="true">{initials}</span>
              <div className="min-w-0"><p className="break-words text-sm font-bold">{review.customerName}</p><p className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground"><CarFront size={13} className="shrink-0" aria-hidden="true" /><span className="break-words">{review.carModel}</span></p></div>
            </footer>
          </article>
        </CarouselItem>;
      })}
    </CarouselContent>
    {snaps.length > 1 && <div className="relative mt-5 flex min-h-11 items-center justify-between gap-4">
      <button type="button" onClick={() => setPaused(value => !value)} aria-label={paused ? 'Automatischen Wechsel starten' : 'Automatischen Wechsel pausieren'} aria-pressed={paused} className="grid h-9 w-9 shrink-0 place-items-center rounded-full border border-border text-muted-foreground hover:text-accent">{paused ? <Play size={14} /> : <Pause size={14} />}</button>
      <div className="flex flex-wrap items-center gap-1" aria-label="Bewertungsseiten">{snaps.map((_, index) => <button key={index} type="button" onClick={() => api?.scrollTo(index)} aria-label={`Bewertungsseite ${index + 1}`} aria-current={index === selected ? 'true' : undefined} className="grid h-9 min-w-8 place-items-center rounded-full focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"><span className={`h-1.5 rounded-full transition-all ${selected === index ? 'w-6 bg-accent' : 'w-1.5 bg-foreground/20'}`} /></button>)}</div>
      <div className="flex shrink-0 items-center gap-3"><span className="mr-1 text-[11px] tabular-nums text-muted-foreground" aria-live="polite">{String(selected + 1).padStart(2, '0')} / {String(snaps.length).padStart(2, '0')}</span><CarouselPrevious className="static h-11 w-11 translate-y-0 border-border bg-card hover:border-accent hover:bg-accent hover:text-white" aria-label="Vorherige Bewertung" /><CarouselNext className="static h-11 w-11 translate-y-0 border-border bg-card hover:border-accent hover:bg-accent hover:text-white" aria-label="Nächste Bewertung" /></div>
    </div>}
  </Carousel>;
}
