import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { randomUUID } from 'node:crypto';
import { mkdtemp, rm, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
const require = createRequire(import.meta.url);
const { build } = require('esbuild');
const { Pool } = createRequire(new URL('../../../lib/db/package.json', import.meta.url))('pg');

test('PostgreSQL statistics, session filters, idempotency and time boundaries', { skip: !process.env.DATABASE_URL }, async () => {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL, connectionTimeoutMillis: 10000 });
  const client = await pool.connect();
  const directory = await mkdtemp(path.join(tmpdir(), 'checkout-activity-db-'));
  try {
    await client.query('BEGIN');
    const schema = (await readFile(new URL('../../../scripts/checkout-activity-schema.sql', import.meta.url), 'utf8'))
      .replace('BEGIN;', '').replace('COMMIT;', '').replace('CREATE TABLE IF NOT EXISTS', 'CREATE TEMP TABLE IF NOT EXISTS');
    // Temporary table shadows any real table; all fixture writes roll back.
    await client.query(schema);
    globalThis.__checkoutDb = client;
    const output = path.join(directory, 'store.cjs');
    await build({ entryPoints: [path.resolve('src/lib/checkout-activity-store.ts')], outfile: output, bundle: true, platform: 'node', format: 'cjs', logLevel: 'silent', plugins: [{ name: 'test-db', setup(build) {
      build.onResolve({ filter: /^@workspace\/db$/ }, () => ({ path: 'db', namespace: 'test' }));
      build.onLoad({ filter: /.*/, namespace: 'test' }, () => ({ contents: 'export const pool=globalThis.__checkoutDb;', loader: 'js' }));
    } }] });
    const { insertActivity, listActivity, sessionActivity, recordCheckoutFact } = require(output);
    const first = randomUUID(), second = randomUUID(), internal = randomUUID(), bot = randomUUID();
    const vin = 'WBA12345678901234';
    const row = (kind, sessionId, extra = {}) => ({ id: randomUUID(), sessionId, kind, source: 'client', occurredAt: '2026-10-18T10:00:00.000Z', vin: null, country: null, internal: false, bot: false, code: null, reference: null, ...extra });
    const visit = row('visit', first, { country: 'DE' });
    await insertActivity(visit); await insertActivity(visit);
    await insertActivity(row('vin_search_started', first, { vin }));
    await insertActivity(row('payment_started', first, { source: 'server', reference: 'attempt-1' }));
    await insertActivity(row('payment_failed', first, { source: 'server', reference: 'attempt-1' }));
    await insertActivity(row('payment_confirmed', first, { source: 'server', reference: 'payment-1' }));
    await insertActivity(row('payment_confirmed', first, { source: 'server', reference: 'payment-1' }));
    await insertActivity(row('order_saved', first, { source: 'server', reference: 'order-1' }));
    await insertActivity(row('visit', second, { country: 'XK' }));
    await insertActivity(row('vin_search_started', second, { vin }));
    await insertActivity(row('checkout_started', second));
    await insertActivity(row('visit', internal, { internal: true }));
    await insertActivity(row('visit', bot, { bot: true }));
    // Europe/Berlin midnight for 18 October starts at 22:00 UTC the day before.
    await insertActivity(row('visit', randomUUID(), { occurredAt: '2026-10-17T21:59:59Z' }));
    await insertActivity(row('visit', randomUUID(), { occurredAt: '2026-10-18T22:00:00Z' }));
    const filters = { from: '2026-10-18', to: '2026-10-18', hideBots: 'true', hideInternal: 'true', page: 1 };
    const result = await listActivity(filters, client);
    assert.equal(result.sessions.length, 2);
    assert.deepEqual(result.summary, { sessions: 2, visits: 2, vinSearches: 2, paymentAttempts: 1, purchases: 1, orders: 1, errors: 1 });
    assert.equal(result.sessions.find(row => row.sessionId === first).confirmed, true);
    assert.equal(result.sessions.find(row => row.sessionId === second).confirmed, false);
    assert.equal((await listActivity({ ...filters, vin: 'WBA' }, client)).summary.sessions, 2);
    const german = await listActivity({ ...filters, country: 'DE' }, client);
    assert.equal(german.summary.sessions, 1);
    assert.equal(german.summary.purchases, 1, 'country matches session without losing country-less webhook events');
    assert.equal((await listActivity({ ...filters, page: 2 }, client)).summary.sessions, 2);
    assert.equal((await listActivity({ ...filters, page: 2 }, client)).sessions.length, 0);
    assert.equal((await listActivity({ ...filters, hideBots: 'false', hideInternal: 'false' }, client)).summary.visits, 4);
    const timeline = await sessionActivity(first);
    assert.equal(timeline.length, 6);
    const next = await sessionActivity(first, timeline[2].id);
    assert.deepEqual(next.map(row => row.id), timeline.slice(3).map(row => row.id));
    // Authoritative integration hashes stable references and deduplicates webhook retries.
    await recordCheckoutFact({ sessionId: first, kind: 'payment_confirmed', reference: 'pi_secret_free_id' });
    await recordCheckoutFact({ sessionId: first, kind: 'payment_confirmed', reference: 'pi_secret_free_id' });
    const facts = await client.query("SELECT reference FROM checkout_activity_events WHERE reference NOT IN ('attempt-1','payment-1','order-1')");
    assert.equal(facts.rows.length, 1); assert.match(facts.rows[0].reference, /^[a-f0-9]{64}$/);
  } finally {
    await client.query('ROLLBACK'); client.release(); await pool.end();
    delete globalThis.__checkoutDb;
    await rm(directory, { recursive: true, force: true });
  }
});
