import pg from '../lib/db/node_modules/pg/lib/index.js';

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });

const services = [
  {
    id: 'tech-repairs',
    name: 'Technical Repairs',
    category: 'Mechanik & Instandsetzung',
    description: 'Fachgerechte Reparatur und Instandsetzung mechanischer Komponenten wie Bremsanlagen, Fahrwerk, Kupplung, Auspuff und Achsen mit geprüften Qualitäts-Ersatzteilen.',
    price_label: 'ab 120 €',
    duration_minutes: 90,
    icon: 'technical-repairs'
  },
  {
    id: 'engine-diag',
    name: 'Engine Diagnostics',
    category: 'Diagnose & Motormanagement',
    description: 'Präzise computergestützte Fehlerspeicher-Auslese, Live-Parameter-Prüfung und Lokalisierung elektronischer sowie mechanischer Störungen im Motor- und Abgassystem.',
    price_label: 'ab 69 €',
    duration_minutes: 45,
    icon: 'engine-diagnostics'
  },
  {
    id: 'system-service',
    name: 'System Service',
    category: 'Wartung & Inspektion',
    description: 'Vollständige Inspektion und Wartung nach Herstellervorgaben mit Erhalt der Garantie. Inklusive Funktionskontrolle aller Sicherheitssysteme und Serviceheft-Eintrag.',
    price_label: 'ab 149 €',
    duration_minutes: 60,
    icon: 'system-service'
  },
  {
    id: 'oil-filters',
    name: 'Oil and Filters',
    category: 'Flüssigkeiten & Filter',
    description: 'Professioneller Ölwechsel mit Premium-Markenölen nach Herstellernorm sowie Erneuerung von Öl-, Luft-, Innenraum- und Kraftstofffiltern für optimalen Motorschutz.',
    price_label: 'ab 89 €',
    duration_minutes: 40,
    icon: 'oil-filters'
  },
  {
    id: 'tires-wheels',
    name: 'Tires and Wheels',
    category: 'Reifen & Fahrwerk',
    description: 'Montage, präzises Auswuchten, Reifendruck- und Profiltiefenprüfung, saisonaler Radwechsel sowie RDKS-Sensor-Kalibrierung für maximale Bodenhaftung und Sicherheit.',
    price_label: 'ab 49 €',
    duration_minutes: 30,
    icon: 'tires-wheels'
  },
  {
    id: 'electrical-system',
    name: 'Electrical System',
    category: 'Elektronik & Batterie',
    description: 'Umfassende Prüfung und Instandsetzung von Starterbatterie, Lichtmaschine, Anlasser, Beleuchtung und Bordelektronik zur Vermeidung von Liegenbleibern.',
    price_label: 'ab 79 €',
    duration_minutes: 45,
    icon: 'electrical-system'
  }
];

async function main() {
  await pool.query(
    "DELETE FROM services WHERE id NOT IN ('tech-repairs', 'engine-diag', 'system-service', 'oil-filters', 'tires-wheels', 'electrical-system')"
  );

  for (const s of services) {
    await pool.query(
      `INSERT INTO services (id, name, category, description, price_label, duration_minutes, icon)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       ON CONFLICT (id) DO UPDATE SET
         name = EXCLUDED.name,
         category = EXCLUDED.category,
         description = EXCLUDED.description,
         price_label = EXCLUDED.price_label,
         duration_minutes = EXCLUDED.duration_minutes,
         icon = EXCLUDED.icon`,
      [s.id, s.name, s.category, s.description, s.price_label, s.duration_minutes, s.icon]
    );
  }

  const res = await pool.query('SELECT id, name, category, price_label, icon FROM services ORDER BY name ASC');
  console.log('Seeded services in database:', res.rows);
  await pool.end();
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
