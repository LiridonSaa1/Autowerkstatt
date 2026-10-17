import http from 'node:http';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
const require = createRequire(import.meta.url);
const { build } = require('esbuild');
const express = require('express');

test('schedule API enforces admin access, validates and persists updates', async () => {
  const dir = await mkdtemp(path.join(tmpdir(), 'service-car-booking-'));
  const env = { ...process.env };
  const originalFetch = globalThis.fetch;
  let server;
  try {
    Object.assign(process.env, { SUPABASE_URL: 'https://fixture.supabase.co', SUPABASE_PUBLISHABLE_KEY: 'fixture', ADMIN_EMAIL: 'admin@example.com' });
    globalThis.fetch = async () => Response.json({ id: 'fixture', email: 'admin@example.com', email_confirmed_at: '2026-01-01' });
    const mock = `
      export const rows = new Map([[1, { id: 1, values: { name: 'Existing company' } }]]);
      export const siteSettingsTable = { id: 'id' };
      export const db = {
        select: () => ({ from: () => ({ where: async condition => rows.has(condition.value) ? [rows.get(condition.value)] : [] }) }),
        insert: () => ({ values: row => ({ onConflictDoUpdate: async () => { rows.set(row.id, row); } }) }),
      };
    `;
    const output = path.join(dir, 'router.cjs');
    await build({ entryPoints: [path.resolve('src/routes/booking-schedule.ts')], outfile: output, bundle: true, platform: 'node', format: 'cjs', logLevel: 'silent', plugins: [{ name: 'fixtures', setup(build) {
      build.onResolve({ filter: /^@workspace\/db$/ }, () => ({ path: 'db', namespace: 'fixture' }));
      build.onResolve({ filter: /^drizzle-orm$/ }, () => ({ path: 'drizzle', namespace: 'fixture' }));
      build.onLoad({ filter: /.*/, namespace: 'fixture' }, args => ({ contents: args.path === 'db' ? mock : 'export const eq = (column, value) => ({column, value});', loader: 'js' }));
    } }] });
    const app = express(); app.use(express.json()); app.use('/api', require(output).default);
    server = app.listen(0, '127.0.0.1'); await new Promise(resolve => server.once('listening', resolve));
    const call = (method = 'GET', data, authorized = true) => new Promise((resolve, reject) => {
      const request = http.request({ hostname: '127.0.0.1', port: server.address().port, path: '/api/admin/booking-schedule', method, headers: { 'Content-Type': 'application/json', ...(authorized ? { Authorization: 'Bearer fixture' } : {}) } }, response => {
        let text = ''; response.on('data', chunk => text += chunk); response.on('end', () => resolve({ status: response.statusCode, data: JSON.parse(text) }));
      });
      request.on('error', reject); if (data) request.write(JSON.stringify(data)); request.end();
    });
    assert.equal((await call('GET', undefined, false)).status, 401);
    assert.equal((await call('PUT', {}, false)).status, 401);
    const initial = await call(); assert.equal(initial.status, 200); assert.equal(initial.data.weekly.length, 7);
    const changed = structuredClone(initial.data);
    changed.weekly[0].start = '08:00'; changed.holidays = [{ from: '2026-12-24', to: '2026-12-26', label: 'Weihnachten' }];
    assert.equal((await call('PUT', { ...changed, intervalMinutes: 0 })).status, 400);
    assert.deepEqual((await call('PUT', changed)).data, changed);
    assert.deepEqual((await call()).data, changed);
    assert.deepEqual(await require(output).readBookingSchedule(), changed);
    assert.equal((await call('PUT', { ...changed, firstDate: '2026-12-31', lastDate: '2026-10-16' })).status, 400);
    assert.deepEqual((await call()).data, changed);
  } finally {
    globalThis.fetch = originalFetch;
    for (const key of Object.keys(process.env)) if (!(key in env)) delete process.env[key];
    Object.assign(process.env, env);
    if (server) await new Promise(resolve => server.close(resolve));
    await rm(dir, { recursive: true, force: true });
  }
});
