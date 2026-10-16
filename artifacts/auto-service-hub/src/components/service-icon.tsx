import React from 'react';

export type ServiceIconType =
  | 'technical-repairs'
  | 'engine-diagnostics'
  | 'system-service'
  | 'oil-filters'
  | 'tires-wheels'
  | 'electrical-system'
  | string;

export interface ServiceIconProps {
  icon?: string | null;
  name?: string;
  className?: string;
  badgeClassName?: string;
  size?: number;
  showBadge?: boolean;
  variant?: 'gradient' | 'red';
}

export function resolveServiceIconKey(icon?: string | null, name?: string): string {
  if (icon && icon.trim()) {
    const clean = icon.trim().toLowerCase();
    if (clean.includes('tech') || clean.includes('repair') || clean.includes('lift') || clean.includes('hebebühne')) return 'technical-repairs';
    if (clean.includes('engine') || clean.includes('motor') || clean.includes('diag')) return 'engine-diagnostics';
    if (clean.includes('system') || clean.includes('service') || clean.includes('inspekt') || clean.includes('tool') || clean.includes('werkzeug')) return 'system-service';
    if (clean.includes('oil') || clean.includes('öl') || clean.includes('filter')) return 'oil-filters';
    if (clean.includes('tire') || clean.includes('reifen') || clean.includes('wheel') || clean.includes('rad') || clean.includes('räd')) return 'tires-wheels';
    if (clean.includes('elect') || clean.includes('elektr') || clean.includes('batter') || clean.includes('strom') || clean.includes('blitz')) return 'electrical-system';
    return clean;
  }

  if (name) {
    const n = name.toLowerCase();
    if (n.includes('technical') || n.includes('mechanik') || n.includes('reparatur') || n.includes('lift')) return 'technical-repairs';
    if (n.includes('engine') || n.includes('motor') || n.includes('diagnos')) return 'engine-diagnostics';
    if (n.includes('system') || n.includes('inspektion') || n.includes('wartung')) return 'system-service';
    if (n.includes('oil') || n.includes('öl') || n.includes('filter')) return 'oil-filters';
    if (n.includes('tire') || n.includes('reifen') || n.includes('wheel') || n.includes('rad') || n.includes('räd')) return 'tires-wheels';
    if (n.includes('elect') || n.includes('elektr') || n.includes('batterie') || n.includes('licht')) return 'electrical-system';
  }

  return 'technical-repairs';
}

export const ICON_IMAGE_MAP: Record<string, string> = {
  'technical-repairs': '/service-icons/technical-repairs.png',
  'engine-diagnostics': '/service-icons/engine-diagnostics.png',
  'system-service': '/service-icons/system-service.png',
  'oil-filters': '/service-icons/oil-filters.png',
  'tires-wheels': '/service-icons/tires-wheels.png',
  'electrical-system': '/service-icons/electrical-system.png',
};

export const AVAILABLE_SERVICE_ICONS: Array<{
  key: ServiceIconType;
  label: string;
  image: string;
}> = [
  { key: 'technical-repairs', label: 'Technical Repairs (Hebebühne)', image: '/service-icons/technical-repairs.png' },
  { key: 'engine-diagnostics', label: 'Engine Diagnostics (Motor & Puls)', image: '/service-icons/engine-diagnostics.png' },
  { key: 'system-service', label: 'System Service (Schraubenschlüssel & Dreher)', image: '/service-icons/system-service.png' },
  { key: 'oil-filters', label: 'Oil and Filters (Ölkanne & Filter)', image: '/service-icons/oil-filters.png' },
  { key: 'tires-wheels', label: 'Tires and Wheels (Reifen & Räder)', image: '/service-icons/tires-wheels.png' },
  { key: 'electrical-system', label: 'Electrical System (Elektrik & Batterie)', image: '/service-icons/electrical-system.png' },
];

export function ServiceIcon({
  icon,
  name,
  className = '',
  badgeClassName = '',
  size = 64,
  showBadge = true,
  variant = 'gradient',
}: ServiceIconProps) {
  const resolvedKey = resolveServiceIconKey(icon, name);
  const imgSuffix = variant === 'red' ? '-red.png' : '.png';
  const imgSrc = `/service-icons/${resolvedKey}${imgSuffix}`;

  return (
    <div
      style={{ width: size, height: size, minWidth: size, minHeight: size }}
      className={`relative inline-flex items-center justify-center select-none ${badgeClassName}`}
    >
      <img
        src={imgSrc}
        alt={name || resolvedKey}
        width={size}
        height={size}
        loading="lazy"
        className={`w-full h-full object-contain filter drop-shadow-lg transition-transform duration-300 group-hover:scale-110 ${className}`}
      />
    </div>
  );
}
