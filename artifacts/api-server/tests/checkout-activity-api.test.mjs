import http from 'node:http';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { randomUUID } from 'node:crypto';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
const require = createRequire(import.meta.url);
const { build } = require('esbuild');
const express = require('express');
test('API authorizes admin reads, rejects forged payments and drops private payloads', async () => {
  const directory = await mkdtemp(path.join(tmpdir(), 'checkout-activity-api-'));
  const saved = { ...process.env }; const originalFetch = globalThis.fetch;
  const events = []; globalThis.__checkoutApiEvents = events;
  let server;
  try {
    Object.assign(process.env, { SUPABASE_URL: 'https://test.supabase.co', SUPABASE_PUBLISHABLE_KEY: 'fixture', ADMIN_EMAIL: 'admin@example.com' });
    globalThis.fetch = async (_url, options) => options.headers.Authorization === 'Bearer admin'
      ? Response.json({ id: 'admin', email: 'admin@example.com', email_confirmed_at: '2026-01-01' })
      : Response.json({ id: 'other', email: 'other@example.com', email_confirmed_at: '2026-01-01' });
    const output = path.join(directory, 'router.cjs');
    await build({ entryPoints: [path.resolve('src/routes/checkout-activity.ts')], outfile: output, bundle: true, platform: 'node', format: 'cjs', logLevel: 'silent', plugins: [{ name: 'test-store', setup(build) {
      build.onResolve({ filter: /checkout-activity-store$|^@workspace\/db$/ }, args => ({ path: args.path, namespace: 'test' }));
      build.onLoad({ filter: /.*/, namespace: 'test' }, args => ({ contents: args.path === '@workspace/db'
        ? 'export const pool={query:async()=>({rows:[]})};'
        : 'export const insertActivity=async e=>globalThis.__checkoutApiEvents.push(e); export const listActivity=async()=>({summary:{sessions:0},sessions:[]}); export const sessionActivity=async()=>[];', loader: 'js' }));
    } }] });
    const app = express(); app.use(express.json({ limit: '8kb' })); app.use('/api', require(output).default);
    server = app.listen(0, '127.0.0.1'); await new Promise(resolve => server.once('listening', resolve));
    const call = (route, method = 'GET', body, token, headers = {}) => new Promise((resolve, reject) => {
      const request = http.request({ hostname: '127.0.0.1', port: server.address().port, path: route, method,
        headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}), ...headers } }, response => {
        let text = ''; response.on('data', chunk => text += chunk); response.on('end', () => resolve({ status: response.statusCode, data: JSON.parse(text) }));
      }); request.on('error', reject); if (body) request.write(JSON.stringify(body)); request.end();
    });
    const url = '/api/admin/checkout-activity?from=2026-10-01&to=2026-10-18';
    assert.equal((await call(url)).status, 401);
    assert.equal((await call(url, 'GET', undefined, 'other')).status, 403);
    assert.equal((await call(url, 'GET', undefined, 'admin')).status, 200);
    const sid = randomUUID();
    assert.equal((await call(`/api/admin/checkout-activity/sessions/${sid}`)).status, 401);
    assert.equal((await call('/api/admin/checkout-activity/internal', 'POST', { sessionId: sid })).status, 401);
    assert.equal((await call('/api/admin/checkout-activity?from=bad', 'GET', undefined, 'admin')).status, 400);
    const valid = { id: randomUUID(), sessionId: sid, kind: 'visit' };
    assert.equal((await call('/api/activity/events', 'POST', { ...valid, kind: 'payment_confirmed' })).status, 400);
    assert.equal((await call('/api/activity/events', 'POST', { ...valid, client_secret: 'do-not-save' })).status, 400);
    assert.equal(events.length, 0);
    assert.equal((await call('/api/activity/events', 'POST', valid, undefined, { Origin: 'https://evil.example' })).status, 403);
    assert.equal((await call('/api/activity/events', 'POST', valid, undefined, { 'User-Agent': 'crawler', 'X-Country': 'US' })).status, 202);
    assert.equal(events.length, 1); assert.equal(events[0].source, 'client'); assert.equal(events[0].bot, true); assert.equal(events[0].country, null);
    assert.equal(Object.hasOwn(events[0], 'ip'), false);
    for (let i = 0; i < 39; i++) await call('/api/activity/events', 'POST', { ...valid, id: randomUUID() });
    assert.equal((await call('/api/activity/events', 'POST', { ...valid, id: randomUUID() })).status, 429);
  } finally {
    if (server) await new Promise(resolve => server.close(resolve));
    globalThis.fetch = originalFetch; delete globalThis.__checkoutApiEvents;
    for (const key of Object.keys(process.env)) if (!(key in saved)) delete process.env[key]; Object.assign(process.env, saved);
    await rm(directory, { recursive: true, force: true });
  }
});
