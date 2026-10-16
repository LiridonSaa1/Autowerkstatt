import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { CarFront } from 'lucide-react';
import { customFetch } from '@workspace/api-client-react';
type VehicleVisual = {
  identity: { make: string; model: string; year: number | null; confidence: number } | null;
  imageUrl: string | null; sourceUrl: string | null; attribution: string | null; licenseUrl: string | null;
};
export default function ReviewVehicle({ reviewId, carModel }: { reviewId: number; carModel: string }) {
  const [failedImage, setFailedImage] = useState<string | null>(null);
  const query = useQuery({ queryKey: ['review-vehicle', reviewId, carModel], queryFn: () => customFetch<VehicleVisual>(`/api/reviews/${reviewId}/vehicle`), staleTime: 24 * 60 * 60 * 1000, retry: false });
  const vehicle = query.data;
  const label = vehicle?.identity ? `${vehicle.identity.make} ${vehicle.identity.model}${vehicle.identity.year ? `, ${vehicle.identity.year}` : ''}` : carModel;
  const photo = vehicle?.imageUrl && vehicle.imageUrl !== failedImage && vehicle.sourceUrl && vehicle.licenseUrl;
  return <>
    <p className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground" title={label}><CarFront size={13} className="shrink-0 text-accent/80" aria-hidden="true" /><span className="truncate font-medium">{label}</span></p>
    <div className="absolute -right-2 bottom-0 flex h-24 w-28 flex-col items-center justify-end" data-testid={`vehicle-visual-${reviewId}`}>
      {photo ? <><img src={vehicle.imageUrl!} alt={`Beispielbild: ${vehicle.identity?.make} ${vehicle.identity?.model}`} loading="lazy" referrerPolicy="no-referrer" onError={() => setFailedImage(vehicle.imageUrl)} className="h-16 w-full rounded-lg object-contain" /><span className="mt-0.5 text-[8px] text-muted-foreground">Beispielbild</span><div className="flex w-full items-center justify-center gap-1 text-[8px] text-muted-foreground"><a href={vehicle.sourceUrl!} target="_blank" rel="noreferrer" title={vehicle.attribution!} className="min-w-0 truncate hover:text-accent">{vehicle.attribution}</a><a href={vehicle.licenseUrl!} target="_blank" rel="noreferrer" className="shrink-0 underline">Lizenz</a></div></> : <div className="mb-2 flex h-16 w-24 items-center justify-center rounded-xl bg-muted/30" aria-label={label}><CarFront size={49} strokeWidth={1.1} className="text-foreground/30" aria-hidden="true" /></div>}
    </div>
  </>;
}
