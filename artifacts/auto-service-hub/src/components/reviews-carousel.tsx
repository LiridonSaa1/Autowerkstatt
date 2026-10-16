import ReviewVehicle from './review-vehicle';
import { useEffect, useState } from 'react';
import { Quote, Star, Pause, Play, ShieldCheck } from 'lucide-react';
import type { Review } from '@workspace/api-client-react';
import { Carousel, CarouselContent, CarouselItem, CarouselPrevious, CarouselNext, type CarouselApi } from '@/components/ui/carousel';

export default function ReviewsCarousel({ reviews }: { reviews: Review[] }) {
  const slides = reviews.length >= 3 ? [...reviews, ...reviews] : reviews;
  const [api, setApi] = useState<CarouselApi>();
  const [selected, setSelected] = useState(0);
  const [snaps, setSnaps] = useState<number[]>([]);
  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);
  const [paused, setPaused] = useState(false);

  useEffect(() => {
    if (!api) return;
    const update = () => {
      setSelected(api.selectedScrollSnap());
      setSnaps(api.scrollSnapList());
    };
    update();
    api.on('select', update);
    api.on('reInit', update);
    return () => {
      api.off('select', update);
      api.off('reInit', update);
    };
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

  return (
    <Carousel
      setApi={setApi}
      opts={{ align: 'start', slidesToScroll: 1, loop: reviews.length >= 3, containScroll: 'trimSnaps' }}
      aria-label="Kundenbewertungen"
      className="group/reviews px-1 sm:px-3"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onFocusCapture={() => setFocused(true)}
      onBlurCapture={event => {
        if (!event.currentTarget.contains(event.relatedTarget)) setFocused(false);
      }}
      onPointerDown={() => setHovered(true)}
      onPointerUp={event => {
        if (event.pointerType !== 'mouse') setHovered(false);
      }}
      onPointerCancel={() => setHovered(false)}
    >
      <CarouselContent className="-ml-4 items-stretch pb-5 pt-5 lg:-ml-5">
        {slides.map((review, slideIndex) => {
          const initials = review.customerName
            .trim()
            .split(/\s+/)
            .filter(Boolean)
            .slice(0, 2)
            .map(name => name[0])
            .join('')
            .toUpperCase();
          const cleanComment = review.comment.replace(/^["„«]+|["“»]+$/g, '').trim();

          return (
            <CarouselItem key={`${review.id}-${slideIndex}`} aria-hidden={slideIndex >= reviews.length ? true : undefined} className="flex pl-4 md:basis-1/2 lg:basis-1/3 lg:pl-5">
              <article
                className={`group relative flex min-h-[235px] w-full flex-col justify-between overflow-hidden rounded-2xl border bg-white/85 p-5 shadow-[0_8px_30px_-18px_rgba(80,55,40,.2)] backdrop-blur-sm transition-all duration-300 hover:-translate-y-1 hover:border-accent/60 hover:shadow-[0_16px_36px_-12px_rgba(235,90,40,0.15)] sm:p-5 ${slideIndex === (selected + 1) % slides.length ? 'border-accent/70 lg:-translate-y-3 shadow-[0_12px_30px_-10px_rgba(255,94,30,.2)]' : 'border-border/60'}`}
                data-testid={`review-featured-${review.id}`}
              >
                {/* Top orange accent indicator */}
                <div className="absolute left-7 top-0 h-[3px] w-14 rounded-full bg-accent sm:left-8" />

                {/* Header: Stars rating & Quote Icon */}
                <div className="flex items-center justify-between gap-4">
                  <div className="flex flex-wrap items-center gap-2.5">
                    <div className="flex gap-1" aria-label={`${review.rating} von 5 Sternen`}>
                      {Array.from({ length: 5 }, (_, index) => {
                        const isFilled = index < review.rating;
                        return (
                          <Star
                            key={index}
                            size={16}
                            aria-hidden="true"
                            className={
                              isFilled
                                ? 'fill-accent text-accent'
                                : 'fill-transparent text-accent/35 stroke-accent stroke-[1.5]'
                            }
                          />
                        );
                      })}
                    </div>
                    <div className="flex items-baseline text-xs font-bold tabular-nums text-foreground">
                      <span>{review.rating.toFixed(1)}</span>
                      <span className="ml-1 font-normal text-muted-foreground/75">/ 5</span>
                    </div>
                    <span className="hidden items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] font-semibold tracking-wide text-emerald-700 dark:text-emerald-400 sm:inline-flex">
                      <ShieldCheck size={11} className="text-emerald-600" /> Freigegeben
                    </span>
                  </div>

                  <Quote
                    size={36}
                    strokeWidth={1.2}
                    className="shrink-0 text-accent/25 transition-transform duration-300 group-hover:scale-105 group-hover:text-accent/35"
                    aria-hidden="true"
                  />
                </div>

                {/* Comment quote */}
                <blockquote className="my-4 flex-1 sm:my-5">
                  <p className="break-words text-xs font-normal leading-6 text-foreground/85">
                    „{cleanComment}“
                  </p>
                </blockquote>

                {/* Footer: Customer initials & Car info */}
                <footer className="relative mt-auto flex min-h-20 items-center gap-2.5 border-t border-border/70 pr-28 pt-4">
                  <span
                    className="grid h-9 w-9 shrink-0 place-items-center rounded-xl border border-accent/15 bg-accent/10 text-xs font-bold text-accent shadow-2xs"
                    aria-hidden="true"
                  >
                    {initials}
                  </span>
                  <div className="min-w-0">
                    <p className="truncate text-xs font-bold tracking-tight text-foreground">
                      {review.customerName}
                    </p>
                    <ReviewVehicle reviewId={review.id} carModel={review.carModel} />
                  </div>
                </footer>
              </article>
            </CarouselItem>
          );
        })}
      </CarouselContent>

      {snaps.length > 1 && (
        <div className="relative mt-0 flex min-h-11 items-center justify-between gap-4">
          <button
            type="button"
            onClick={() => setPaused(value => !value)}
            aria-label={paused ? 'Automatischen Wechsel starten' : 'Automatischen Wechsel pausieren'}
            aria-pressed={paused}
            className="grid h-9 w-9 shrink-0 place-items-center rounded-full border border-border/80 bg-card text-muted-foreground shadow-2xs transition-colors hover:border-accent/40 hover:text-accent"
          >
            {paused ? <Play size={14} className="ml-0.5 fill-current" /> : <Pause size={14} />}
          </button>

          <div className="flex flex-wrap items-center gap-1.5" aria-label="Bewertungsseiten">
            {snaps.slice(0, reviews.length).map((_, index) => (
              <button
                key={index}
                type="button"
                onClick={() => api?.scrollTo(index)}
                aria-label={`Bewertungsseite ${index + 1}`}
                aria-current={index === selected % reviews.length ? 'true' : undefined}
                className="grid h-9 min-w-7 place-items-center rounded-full focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
              >
                <span
                  className={`h-1.5 rounded-full transition-all duration-300 ${
                    selected % reviews.length === index ? 'w-6 bg-accent' : 'w-1.5 bg-foreground/20 hover:bg-foreground/40'
                  }`}
                />
              </button>
            ))}
          </div>

          <div className="flex shrink-0 items-center gap-3">
            <span
              className="mr-1 text-xs font-medium tabular-nums text-muted-foreground/80"
              aria-live="polite"
            >
              {String(selected % reviews.length + 1).padStart(2, '0')} / {String(Math.min(snaps.length, reviews.length)).padStart(2, '0')}
            </span>
            <CarouselPrevious
              className="static h-11 w-11 translate-y-0 border-border/80 bg-card text-foreground shadow-sm transition-colors hover:border-accent hover:bg-accent hover:text-white lg:absolute lg:-left-12 lg:top-[-155px]"
              aria-label="Vorherige Bewertung"
            />
            <CarouselNext
              className="static h-11 w-11 translate-y-0 border-accent bg-accent text-white shadow-sm transition-colors hover:bg-accent/90 lg:absolute lg:-right-12 lg:left-auto lg:top-[-155px]"
              aria-label="Nächste Bewertung"
            />
          </div>
        </div>
      )}
    </Carousel>
  );
}

