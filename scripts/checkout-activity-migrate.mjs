import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
const require = createRequire(new URL('../lib/db/package.json', import.meta.url));
const { Pool } = require('pg');
if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is required');
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
try {
  if (process.argv.includes('--prune')) {
    const result = await pool.query("DELETE FROM checkout_activity_events WHERE occurred_at < now() - interval '90 days'");
    console.log(`Removed ${result.rowCount} expired activity events`);
  } else {
    await pool.query(await readFile(new URL('./checkout-activity-schema.sql', import.meta.url), 'utf8'));
    console.log('Checkout activity schema is ready');
  }
} finally { await pool.end(); }
