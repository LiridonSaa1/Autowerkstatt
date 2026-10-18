import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { randomUUID } from 'node:crypto';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
const require = createRequire(import.meta.url);
const { build } = require('esbuild');
let directory, activity;
before(async () => {
  directory = await mkdtemp(path.join(tmpdir(), 'checkout-activity-'));
  const output = path.join(directory, 'core.cjs');
  await build({ entryPoints: [path.resolve('src/lib/checkout-activity.ts')], outfile: output, bundle: true, platform: 'node', format: 'cjs', logLevel: 'silent' });
  activity = require(output);
});
after(async () => { if (directory) await rm(directory, { recursive: true, force: true }); });
const session = randomUUID();
const vin = 'WBA12345678901234';
function event(kind, overrides = {}) {
  return { id: randomUUID(), sessionId: session, kind, occurredAt: '2026-10-18T10:00:00.000Z',
    source: kind.startsWith('payment_') || kind === 'order_saved' ? 'server' : 'client', vin: null, country: null,
    internal: false, bot: false, code: null, reference: null, ...overrides };
}
test('same VIN belongs to separate sessions; one session may search multiple VINs', () => {
  const other = randomUUID();
  const groups = activity.groupSessions([event('visit'), event('vin_search_started', { vin }), event('vin_search_started', { vin: 'WVW12345678901234' }), event('vin_search_started', { sessionId: other, vin })]);
  assert.equal(groups.length, 2);
  assert.equal(groups.find(row => row.sessionId === session).timeline.length, 3);
  assert.equal(groups.find(row => row.sessionId === other).timeline.length, 1);
});
test('timeline sorts by server time and deduplicates re-delivered event IDs', () => {
  const start = event('visit', { occurredAt: '2026-10-18T09:00:00.000Z' });
  const end = event('checkout_started');
  const result = activity.describeSession([end, start, start]);
  assert.equal(result.timeline.length, 2);
  assert.equal(result.timeline[0].kind, 'visit');
});
test('opening checkout or Stripe never counts as purchase', () => {
  const events = [event('visit'), event('checkout_started'), event('payment_started', { reference: 'attempt-1' })];
  assert.equal(activity.describeSession(events).paymentStatus, 'started');
  assert.equal(activity.summarize(events).purchases, 0);
  assert.equal(activity.summarize(events).paymentAttempts, 1);
});
test('failed attempt remains separate from eventual confirmation and saved order', () => {
  const failed = event('payment_failed', { reference: 'attempt-1' });
  const confirmed = event('payment_confirmed', { reference: 'payment-2' });
  assert.equal(activity.describeSession([failed]).paymentStatus, 'failed');
  const result = activity.describeSession([confirmed, failed]);
  assert.equal(result.paymentStatus, 'confirmed');
  assert.equal(result.orderSaved, false);
  assert.equal(activity.describeSession([confirmed, event('order_saved', { reference: 'order-1' })]).orderSaved, true);
});
test('order saved without payment is not a confirmed purchase; browser cannot forge facts', () => {
  const events = [event('order_saved', { reference: 'order-1' }), event('payment_confirmed', { source: 'client' })];
  assert.equal(activity.summarize(events).orders, 1);
  assert.equal(activity.summarize(events).purchases, 0);
  assert.equal(activity.describeSession(events).paymentStatus, 'none');
});
test('statistics deduplicate purchases and orders by reference and attempts by event ID', () => {
  const visit = event('visit');
  const search = event('vin_search_started', { vin });
  const attempt = event('payment_started', { reference: 'attempt-1' });
  assert.deepEqual(activity.summarize([visit, visit, event('visit'), search, attempt, attempt,
    event('payment_failed'), event('vin_search_failed'), event('checkout_error'),
    event('payment_confirmed', { reference: 'payment-1' }), event('payment_confirmed', { reference: 'payment-1' }),
    event('order_saved', { reference: 'order-1' }), event('order_saved', { reference: 'order-1' })]),
  { sessions: 1, visits: 1, vinSearches: 1, paymentAttempts: 1, purchases: 1, orders: 1, errors: 3 });
});
test('inactivity is explicitly a hypothesis, never a confirmed abandonment reason', () => {
  const item = event('visit');
  assert.equal(activity.describeSession([item], Date.parse(item.occurredAt) + 1000).hypothesis, null);
  assert.match(activity.describeSession([item], Date.parse(item.occurredAt) + 31 * 60000).hypothesis, /möglich.*nicht bestätigt/);
  assert.equal(activity.describeSession([event('payment_confirmed')], Date.parse(item.occurredAt) + 31 * 60000).hypothesis, null);
});
test('public schema rejects card data, secret tokens, free text and payment/order events', () => {
  const valid = { id: randomUUID(), sessionId: session, kind: 'visit' };
  assert.equal(activity.clientEventSchema.safeParse(valid).success, true);
  for (const field of ['cardNumber', 'client_secret', 'email', 'message', 'paymentIntent', 'reference', 'source', 'occurredAt', 'country']) {
    assert.equal(activity.clientEventSchema.safeParse({ ...valid, [field]: 'forbidden' }).success, false, field);
  }
  for (const kind of activity.serverKinds) assert.equal(activity.clientEventSchema.safeParse({ ...valid, kind }).success, false);
  assert.equal(activity.clientEventSchema.safeParse({ ...valid, kind: 'vin_search_started', vin: 'bad-vin' }).success, false);
});
test('filters enforce time range, normalized VIN, country and hiding defaults', () => {
  const base = { from: '2026-10-01', to: '2026-10-18' };
  const result = activity.parseActivityFilters({ ...base, vin: 'wba' });
  assert.equal(result.success, true);
  assert.equal(result.data.hideBots, 'true'); assert.equal(result.data.hideInternal, 'true'); assert.equal(result.data.vin, 'WBA');
  for (const invalid of [{ to: '2026-09-01' }, { from: '2025-01-01' }, { country: "DE' OR true" }, { vin: '%' }, { page: '-1' }]) {
    assert.equal(activity.parseActivityFilters({ ...base, ...invalid }).success, false);
  }
});
