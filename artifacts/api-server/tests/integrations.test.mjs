import http from 'node:http';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { createDecipheriv } from 'node:crypto';
const require = createRequire(import.meta.url);
const { build } = require('esbuild');
const express = require('express');
test('integration gate, Supabase key inputs, encrypted database storage and session binding', async () => {
  const directory = await mkdtemp(path.join(tmpdir(), 'service-car-integrations-'));
  const originalFetch = globalThis.fetch;
  const localFetch = (url, options = {}) => new Promise((resolve, reject) => {
    const req = http.request(url, { method: options.method || 'GET', headers: options.headers }, res => {
      const chunks = []; res.on('data', chunk => chunks.push(chunk)); res.on('end', () => resolve(new Response(Buffer.concat(chunks), { status: res.statusCode, headers: res.headers })));
    }); req.on('error', reject); if (options.body) req.write(options.body); req.end();
  });
  const oldEnv = { ...process.env };
  let server;
  let encryptedConfig;
  try {
    process.env.INTEGRATIONS_DATA_DIR = path.join(directory, 'data');
    process.env.SUPABASE_URL = 'https://test-project.supabase.co';
    process.env.SUPABASE_PUBLISHABLE_KEY = 'test-key';
    process.env.ADMIN_EMAIL = 'admin@example.com';
    delete process.env.INTEGRATIONS_PASSWORD;
    globalThis.fetch = async (url, options) => {
      const value = String(url);
      if (value.endsWith('/auth/v1/user')) return Response.json({ id: 'admin', email: 'admin@example.com', email_confirmed_at: '2026-01-01' });
      if (value.includes('/auth/v1/token')) return JSON.parse(options.body).password === 'correct-password' ? Response.json({ user: { email: 'admin@example.com' } }) : Response.json({}, { status: 400 });
      throw new Error('Unexpected external request');
    };
    const output = path.join(directory, 'router.cjs');
    globalThis.__integrationTestPool = { query: async (sql, params) => {
      if (sql.startsWith('SELECT')) return { rows: encryptedConfig ? [{ encrypted_config: encryptedConfig }] : [] };
      assert.ok(sql.startsWith('INSERT INTO public.api_integrations'));
      encryptedConfig = params[0]; return { rows: [] };
    } };
    await build({ entryPoints: [path.resolve('src/routes/integrations.ts')], outfile: output, bundle: true, platform: 'node', format: 'cjs', logLevel: 'silent', plugins: [{ name: 'mock-db', setup(build) {
      build.onResolve({ filter: /^@workspace\/db$/ }, () => ({ path: 'db', namespace: 'mock-db' }));
      build.onLoad({ filter: /.*/, namespace: 'mock-db' }, () => ({ contents: 'export const pool = globalThis.__integrationTestPool;', loader: 'js' }));
    } }] });
    const router = require(output).default;
    const app = express(); app.use(express.json()); app.use(router);
    server = app.listen(0, '127.0.0.1'); await new Promise(resolve => server.once('listening', resolve));
    const base = `http://127.0.0.1:${server.address().port}/admin/integrations`;
    const call = (suffix = '', options = {}) => localFetch(base + suffix, { ...options, headers: { 'Content-Type': 'application/json', Authorization: 'Bearer test-session', ...options.headers } });
    assert.equal((await localFetch(base)).status, 401);
    assert.equal((await call()).status, 403);
    assert.equal((await call('/unlock', { method: 'POST', body: JSON.stringify({ password: 'wrong' }) })).status, 401);
    const unlock = await call('/unlock', { method: 'POST', body: JSON.stringify({ password: '123678' }) });
    assert.equal(unlock.status, 200); const { token } = await unlock.json();
    const headers = { 'X-Integrations-Token': token };
    const initial = await (await call('', { headers })).json();
    assert.equal(initial.supabaseUrl, process.env.SUPABASE_URL);
    assert.equal(initial.supabaseKey, process.env.SUPABASE_PUBLISHABLE_KEY);
    const values = { resendKey: 'secret-resend-fixture', resendFrom: 'sender@example.com', supabaseUrl: 'https://test-project.supabase.co', supabaseKey: 'secret-anon-fixture', supabaseServiceKey: '', twilioSid: '', twilioToken: 'secret-twilio-fixture', twilioFrom: '' };
    assert.equal((await call('', { method: 'PUT', headers, body: JSON.stringify(values) })).status, 200);
    const saved = await (await call('', { headers })).json();
    assert.equal(saved.resendKey, ''); assert.equal(saved.twilioToken, ''); assert.equal(saved.configured.resendKey, true);
    assert.equal(saved.supabaseKey, values.supabaseKey);
    const encrypted = Buffer.from(encryptedConfig, 'base64');
    assert.equal(encrypted.includes(Buffer.from(values.resendKey)), false);
    assert.equal(encrypted.includes(Buffer.from(values.supabaseKey)), false);
    const master = await readFile(path.join(directory, 'data/master.key'));
    const decipher = createDecipheriv('aes-256-gcm', master, encrypted.subarray(0, 12));
    decipher.setAuthTag(encrypted.subarray(12, 28));
    const stored = JSON.parse(Buffer.concat([decipher.update(encrypted.subarray(28)), decipher.final()]).toString());
    assert.deepEqual(Object.keys(stored).sort(), ['supabaseKey', 'supabaseServiceKey', 'supabaseUrl']);
    assert.equal(stored.supabaseKey, values.supabaseKey);
    assert.equal((await call('', { method: 'PUT', headers, body: JSON.stringify({ ...values, resendKey: '', twilioToken: '' }) })).status, 200);
    assert.equal((await (await call('', { headers })).json()).configured.resendKey, true);
    assert.equal((await (await call('', { headers })).json()).supabaseKey, values.supabaseKey);
    assert.equal((await call('', { headers: { ...headers, Authorization: 'Bearer different-session' } })).status, 403);
    assert.equal((await call('', { method: 'PUT', headers, body: JSON.stringify({ ...values, supabaseUrl: 'https://localhost/' }) })).status, 400);
    assert.equal((await call('/lock', { method: 'POST', headers })).status, 200);
    assert.equal((await call('', { headers })).status, 403);
    process.env.INTEGRATIONS_PASSWORD = 'custom-integration-password';
    assert.equal((await call('/unlock', { method: 'POST', body: JSON.stringify({ password: '123678' }) })).status, 401);
    assert.equal((await call('/unlock', { method: 'POST', body: JSON.stringify({ password: 'custom-integration-password' }) })).status, 200);
  } finally {
    globalThis.fetch = originalFetch;
    delete globalThis.__integrationTestPool;
    for (const key of Object.keys(process.env)) if (!(key in oldEnv)) delete process.env[key];
    Object.assign(process.env, oldEnv);
    if (server) await new Promise(resolve => server.close(resolve));
    await rm(directory, { recursive: true, force: true });
  }
});
