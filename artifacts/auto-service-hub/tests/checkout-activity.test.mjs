import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { mkdir } from 'node:fs/promises';
const { chromium } = createRequire(import.meta.url)('playwright');

test('checkout activity: filters persist, session timeline opens, mobile fits and access error is explicit', async () => {
  const browser = await chromium.launch({ channel: 'msedge', headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  const errors = []; page.on('pageerror', error => errors.push(error.message));
  const id = '65d98d33-7cc6-44b8-8b1b-6859eb4dd409';
  const vin = 'WBA12345678901234';
  let unauthorized = false;
  const queries = [];
  await page.route('**/api/admin/checkout-activity**', route => {
    const url = new URL(route.request().url()); queries.push(url.search);
    if (unauthorized) return route.fulfill({ status: 401, json: { error: 'Authentication required' } });
    if (url.pathname.endsWith('/internal')) return route.fulfill({ json: { updated: true } });
    if (url.pathname.includes('/sessions/')) return route.fulfill({ json: { hasMore: false, after: null, timeline: [
      { id: 'a', kind: 'visit', source: 'client', occurredAt: '2026-10-18T08:00:00Z', vin: null, code: null },
      { id: 'b', kind: 'vin_search_started', source: 'client', occurredAt: '2026-10-18T08:01:00Z', vin, code: null },
      { id: 'c', kind: 'payment_started', source: 'server', occurredAt: '2026-10-18T08:02:00Z', vin: null, code: null },
      { id: 'd', kind: 'payment_failed', source: 'server', occurredAt: '2026-10-18T08:03:00Z', vin: null, code: null },
    ] } });
    return route.fulfill({ json: { summary: { sessions: 1, visits: 1, vinSearches: 1, paymentAttempts: 1, purchases: 0, orders: 0, errors: 1 },
      sessions: [{ sessionId: id, firstAt: '2026-10-18T08:00:00Z', lastAt: '2026-10-18T08:03:00Z', eventCount: 4, vins: [vin], countries: ['DE'], internal: false, bot: false, confirmed: false, failed: true, started: true, orderSaved: false }], page: 1, pageSize: 25 } });
  });
  try {
    await page.goto('http://127.0.0.1:5173/admin/checkout-activity?from=2026-10-01&to=2026-10-18');
    await page.getByRole('heading', { name: 'Checkout-Aktivität' }).waitFor();
    await page.getByRole('button', { name: new RegExp(id) }).click();
    await page.getByText('Zahlung gestartet', { exact: true }).waitFor();
    assert.equal(await page.getByText('Zahlung fehlgeschlagen', { exact: true }).count(), 2);
    assert.match(await page.locator('main').innerText(), /Vermutung: möglicher Abbruch/);
    await page.getByLabel('Land (ISO-Code)').fill('DE');
    await page.getByLabel('FIN / VIN (auch Präfix)').fill('WBA');
    await page.getByLabel('Internen Traffic ausblenden').uncheck();
    await page.getByRole('button', { name: 'Filter anwenden' }).click();
    await page.reload();
    assert.equal(await page.getByLabel('Land (ISO-Code)').inputValue(), 'DE');
    assert.equal(await page.getByLabel('FIN / VIN (auch Präfix)').inputValue(), 'WBA');
    assert.equal(await page.getByLabel('Internen Traffic ausblenden').isChecked(), false);
    assert.ok(queries.some(query => query.includes('country=DE') && query.includes('vin=WBA') && query.includes('hideInternal=false')));
    await mkdir('../../test-results', { recursive: true });
    for (const width of [375, 768, 1440]) {
      await page.setViewportSize({ width, height: 1000 });
      await page.getByRole('button', { name: new RegExp(id) }).waitFor();
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `overflow at ${width}px`);
      await page.screenshot({ path: `../../test-results/checkout-activity-${width}.png`, fullPage: true });
    }
    unauthorized = true;
    await page.reload();
    await page.getByRole('heading', { name: 'Nur für Administratoren' }).waitFor();
    assert.equal(await page.getByText(id, { exact: true }).count(), 0);
    assert.deepEqual(errors, []);
  } finally { await browser.close(); }
});
