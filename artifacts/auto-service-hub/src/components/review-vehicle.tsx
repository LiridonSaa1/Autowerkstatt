import { CarFront } from 'lucide-react';
import { resolveVehicleVisual } from '@/lib/vehicle-resolver';

export default function ReviewVehicle({ reviewId, carModel }: { reviewId: number; carModel: string }) {
  const visual = resolveVehicleVisual(carModel);
  const label = carModel || visual.label;

  return (
    <>
      <p className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground" title={label}>
        <CarFront size={13} className="shrink-0 text-accent/80" aria-hidden="true" />
        <span className="truncate font-medium">{label}</span>
      </p>

      {/* Realistic transparent 3D studio car cutout as in Photo 3 */}
      <div
        className="pointer-events-none absolute -bottom-1 -right-1 flex h-20 w-36 items-end justify-end overflow-visible sm:w-44"
        data-testid={`vehicle-visual-${reviewId}`}
      >
        <img
          src={visual.imageUrl}
          alt={label}
          loading="lazy"
          className="max-h-[68px] w-auto max-w-full object-contain object-right-bottom drop-shadow-[0_4px_12px_rgba(0,0,0,0.12)] transition-transform duration-300 group-hover:scale-105"
        />
      </div>
    </>
  );
}
