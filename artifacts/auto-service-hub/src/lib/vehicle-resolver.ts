export interface VehicleModelOption {
  id: string;
  name: string;
  year?: number;
  image: string;
}

export interface VehicleBrandOption {
  brand: string;
  models: VehicleModelOption[];
  defaultImage: string;
}

export const POPULAR_VEHICLES: { label: string; make: string; model: string; year?: number; image: string }[] = [
  { label: 'Audi RS 6, 2023', make: 'Audi', model: 'RS 6', year: 2023, image: '/vehicles/audi-rs6.png' },
  { label: 'BMW 5, 2019', make: 'BMW', model: '5er', year: 2019, image: '/vehicles/bmw-5.png' },
  { label: 'Mercedes C-Class, 2021', make: 'Mercedes-Benz', model: 'C-Klasse', year: 2021, image: '/vehicles/mercedes-c-class.png' },
  { label: 'VW Golf 7.5, 2018', make: 'Volkswagen', model: 'Golf 7.5', year: 2018, image: '/vehicles/vw-golf.png' },
  { label: 'BMW XM, 2024', make: 'BMW', model: 'XM', year: 2024, image: '/vehicles/bmw-xm.png' },
];

export const VEHICLE_BRANDS: VehicleBrandOption[] = [
  {
    brand: 'Audi',
    defaultImage: '/vehicles/audi-rs6.png',
    models: [
      { id: 'audi-rs6', name: 'RS 6 Avant', year: 2023, image: '/vehicles/audi-rs6.png' },
      { id: 'audi-a6', name: 'A6 Limousine', year: 2022, image: '/vehicles/audi-rs6.png' },
      { id: 'audi-a4', name: 'A4 Avant', year: 2021, image: '/vehicles/audi-rs6.png' },
      { id: 'audi-a3', name: 'A3 Sportback', year: 2020, image: '/vehicles/vw-golf.png' },
      { id: 'audi-q5', name: 'Q5 SUV', year: 2023, image: '/vehicles/bmw-xm.png' },
      { id: 'audi-q7', name: 'Q7 / Q8 SUV', year: 2024, image: '/vehicles/bmw-xm.png' },
    ],
  },
  {
    brand: 'BMW',
    defaultImage: '/vehicles/bmw-5.png',
    models: [
      { id: 'bmw-5', name: '5er Limousine (G30)', year: 2019, image: '/vehicles/bmw-5.png' },
      { id: 'bmw-3', name: '3er Limousine (G20)', year: 2021, image: '/vehicles/bmw-5.png' },
      { id: 'bmw-xm', name: 'XM Luxury SUV', year: 2024, image: '/vehicles/bmw-xm.png' },
      { id: 'bmw-m3', name: 'M3 / M5 Competition', year: 2023, image: '/vehicles/bmw-5.png' },
      { id: 'bmw-x5', name: 'X5 / X6 SUV', year: 2022, image: '/vehicles/bmw-xm.png' },
      { id: 'bmw-1', name: '1er / 2er Gran Coupé', year: 2021, image: '/vehicles/vw-golf.png' },
    ],
  },
  {
    brand: 'Mercedes-Benz',
    defaultImage: '/vehicles/mercedes-c-class.png',
    models: [
      { id: 'mb-c-class', name: 'C-Klasse (W206)', year: 2021, image: '/vehicles/mercedes-c-class.png' },
      { id: 'mb-e-class', name: 'E-Klasse Limousine', year: 2022, image: '/vehicles/mercedes-c-class.png' },
      { id: 'mb-a-class', name: 'A-Klasse Hatchback', year: 2020, image: '/vehicles/vw-golf.png' },
      { id: 'mb-glc', name: 'GLC / GLE SUV', year: 2023, image: '/vehicles/bmw-xm.png' },
      { id: 'mb-amg', name: 'AMG Performance', year: 2023, image: '/vehicles/mercedes-c-class.png' },
    ],
  },
  {
    brand: 'Volkswagen',
    defaultImage: '/vehicles/vw-golf.png',
    models: [
      { id: 'vw-golf-7', name: 'Golf 7.5', year: 2018, image: '/vehicles/vw-golf.png' },
      { id: 'vw-golf-8', name: 'Golf 8 GTI / R', year: 2022, image: '/vehicles/vw-golf.png' },
      { id: 'vw-passat', name: 'Passat Variant', year: 2021, image: '/vehicles/bmw-5.png' },
      { id: 'vw-tiguan', name: 'Tiguan / Touareg SUV', year: 2023, image: '/vehicles/bmw-xm.png' },
      { id: 'vw-polo', name: 'Polo', year: 2020, image: '/vehicles/vw-golf.png' },
    ],
  },
  {
    brand: 'Porsche',
    defaultImage: '/vehicles/audi-rs6.png',
    models: [
      { id: 'porsche-911', name: '911 Carrera / Turbo', year: 2023, image: '/vehicles/audi-rs6.png' },
      { id: 'porsche-panamera', name: 'Panamera / Taycan', year: 2022, image: '/vehicles/bmw-5.png' },
      { id: 'porsche-cayenne', name: 'Cayenne / Macan SUV', year: 2023, image: '/vehicles/bmw-xm.png' },
    ],
  },
];

export interface ResolvedVehicleVisual {
  make: string;
  model: string;
  year: number | null;
  imageUrl: string;
  label: string;
}

export function resolveVehicleVisual(rawInput: string): ResolvedVehicleVisual {
  const input = rawInput.trim();
  if (!input) {
    return {
      make: '',
      model: '',
      year: null,
      imageUrl: '/vehicles/bmw-5.png',
      label: '',
    };
  }

  const lower = input.toLowerCase();

  // Extract year if present
  const yearMatch = input.match(/\b(?:19|20)\d{2}\b/);
  const year = yearMatch ? Number(yearMatch[0]) : null;

  // 1. Check for specific high-priority models
  if (lower.includes('rs6') || lower.includes('rs 6') || (lower.includes('audi') && (lower.includes('a6') || lower.includes('rs')))) {
    return {
      make: 'Audi',
      model: 'RS 6',
      year: year ?? 2023,
      imageUrl: '/vehicles/audi-rs6.png',
      label: input,
    };
  }

  if (lower.includes('xm') || lower.includes('bmw xm')) {
    return {
      make: 'BMW',
      model: 'XM',
      year: year ?? 2024,
      imageUrl: '/vehicles/bmw-xm.png',
      label: input,
    };
  }

  if (
    lower.includes('suv') ||
    lower.includes('x5') ||
    lower.includes('x6') ||
    lower.includes('x7') ||
    lower.includes('x3') ||
    lower.includes('q7') ||
    lower.includes('q8') ||
    lower.includes('q5') ||
    lower.includes('glc') ||
    lower.includes('gle') ||
    lower.includes('gls') ||
    lower.includes('tiguan') ||
    lower.includes('touareg') ||
    lower.includes('cayenne') ||
    lower.includes('macan')
  ) {
    return {
      make: lower.includes('audi')
        ? 'Audi'
        : lower.includes('mercedes')
        ? 'Mercedes-Benz'
        : lower.includes('vw') || lower.includes('volkswagen')
        ? 'Volkswagen'
        : 'BMW',
      model: input,
      year,
      imageUrl: '/vehicles/bmw-xm.png',
      label: input,
    };
  }

  if (
    lower.includes('golf') ||
    lower.includes('gti') ||
    lower.includes('polo') ||
    lower.includes('a3') ||
    lower.includes('a-klasse') ||
    lower.includes('a-class') ||
    lower.includes('1er') ||
    lower.includes('hatchback')
  ) {
    return {
      make: lower.includes('audi')
        ? 'Audi'
        : lower.includes('mercedes')
        ? 'Mercedes-Benz'
        : lower.includes('bmw')
        ? 'BMW'
        : 'Volkswagen',
      model: lower.includes('golf') ? 'Golf' : input,
      year,
      imageUrl: '/vehicles/vw-golf.png',
      label: input,
    };
  }

  if (
    lower.includes('mercedes') ||
    lower.includes('c-class') ||
    lower.includes('c-klasse') ||
    lower.includes('e-class') ||
    lower.includes('e-klasse') ||
    lower.includes('s-class') ||
    lower.includes('s-klasse') ||
    lower.includes('c200') ||
    lower.includes('c300') ||
    lower.includes('c63') ||
    lower.includes('amg')
  ) {
    return {
      make: 'Mercedes-Benz',
      model: 'C-Klasse',
      year: year ?? 2021,
      imageUrl: '/vehicles/mercedes-c-class.png',
      label: input,
    };
  }

  if (
    lower.includes('bmw') ||
    lower.includes('5er') ||
    lower.includes('5 series') ||
    lower.includes('3er') ||
    lower.includes('3 series') ||
    lower.includes('m3') ||
    lower.includes('m5')
  ) {
    return {
      make: 'BMW',
      model: '5er',
      year: year ?? 2019,
      imageUrl: '/vehicles/bmw-5.png',
      label: input,
    };
  }

  if (lower.includes('audi') || lower.includes('a4') || lower.includes('a5') || lower.includes('a7')) {
    return {
      make: 'Audi',
      model: 'A4 / A6',
      year: year ?? 2022,
      imageUrl: '/vehicles/audi-rs6.png',
      label: input,
    };
  }

  // Fallback for general sedans/cars
  return {
    make: 'Fahrzeug',
    model: input,
    year,
    imageUrl: '/vehicles/bmw-5.png',
    label: input,
  };
}
