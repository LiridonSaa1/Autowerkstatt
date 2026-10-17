import http from 'node:http';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { mkdtemp, readFile, rm, mkdir, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { createDecipheriv, createCipheriv, randomBytes } from 'node:crypto';
import { pathToFileURL } from 'node:url';
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
  let brevoResponse = { status: 401, body: { code: 'unauthorized', message: 'Key not found' } };
  try {
    process.env.INTEGRATIONS_DATA_DIR = path.join(directory, 'data');
    process.env.SUPABASE_URL = 'https://test-project.supabase.co';
    process.env.SUPABASE_PUBLISHABLE_KEY = 'test-key';
    process.env.ADMIN_EMAIL = 'admin@example.com';
    delete process.env.INTEGRATIONS_PASSWORD;
    globalThis.fetch = async (url, options) => {
      const value = String(url);
      if (value === 'https://api.brevo.com/v3/account') return Response.json(brevoResponse.body, { status: brevoResponse.status });
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
    const values = { brevoKey: 'secret-brevo-fixture', brevoFrom: 'sender@example.com', supabaseUrl: 'https://test-project.supabase.co', supabaseKey: 'secret-anon-fixture', supabaseServiceKey: '', twilioSid: '', twilioToken: 'secret-twilio-fixture', twilioFrom: '' };
    assert.equal((await call('', { method: 'PUT', headers, body: JSON.stringify(values) })).status, 200);
    const saved = await (await call('', { headers })).json();
    assert.equal(saved.brevoKey, ''); assert.equal(saved.twilioToken, ''); assert.equal(saved.configured.brevoKey, true);
    assert.equal(saved.supabaseKey, values.supabaseKey);
    const invalidKey = await call('/test/brevo', { method: 'POST', headers });
    assert.equal(invalidKey.status, 400);
    assert.match((await invalidKey.json()).error, /Brevo:.*API-v3/);
    brevoResponse = { status: 403, body: { code: 'permission_denied', message: 'Not allowed' } };
    const restrictedKey = await call('/test/brevo', { method: 'POST', headers });
    assert.equal(restrictedKey.status, 400);
    assert.match((await restrictedKey.json()).error, /Zugriff wurde verweigert/);
    brevoResponse = { status: 200, body: { data: [] } };
    assert.equal((await call('/test/brevo', { method: 'POST', headers })).status, 200);
    const encrypted = Buffer.from(encryptedConfig, 'base64');
    assert.equal(encrypted.includes(Buffer.from(values.brevoKey)), false);
    assert.equal(encrypted.includes(Buffer.from(values.supabaseKey)), false);
    const master = await readFile(path.join(directory, 'data/master.key'));
    const decipher = createDecipheriv('aes-256-gcm', master, encrypted.subarray(0, 12));
    decipher.setAuthTag(encrypted.subarray(12, 28));
    const stored = JSON.parse(Buffer.concat([decipher.update(encrypted.subarray(28)), decipher.final()]).toString());
    assert.deepEqual(Object.keys(stored).sort(), ['supabaseKey', 'supabaseServiceKey', 'supabaseUrl']);
    assert.equal(stored.supabaseKey, values.supabaseKey);
    assert.equal((await call('', { method: 'PUT', headers, body: JSON.stringify({ ...values, brevoKey: '', twilioToken: '' }) })).status, 200);
    assert.equal((await (await call('', { headers })).json()).configured.brevoKey, true);
    assert.equal((await (await call('', { headers })).json()).supabaseKey, values.supabaseKey);
    assert.equal((await call('', { headers: { ...headers, Authorization: 'Bearer different-session' } })).status, 403);
    assert.equal((await call('', { method: 'PUT', headers, body: JSON.stringify({ ...values, supabaseUrl: 'https://localhost/' }) })).status, 400);
    // Unreadable storage falls back to environment values without changing ciphertext.
    await writeFile(path.join(directory, 'data/master.key'), randomBytes(32));
    const before = encryptedConfig;
    const unreadable = await call('', { headers });
    assert.equal(unreadable.status, 200);
    assert.equal(unreadable.headers.get('content-type').includes('application/json'), true);
    assert.equal((await unreadable.json()).supabaseKey, process.env.SUPABASE_PUBLISHABLE_KEY);
    assert.equal(encryptedConfig, before);
    await writeFile(path.join(directory, 'data/master.key'), master);
    assert.equal((await call('', { headers })).status, 200);
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

test('stable package storage reads both existing master keys regardless of launch directory', async () => {
  const directory = await mkdtemp(path.join(tmpdir(), 'service-car-integration-path-'));
  const originalDirectory = process.env.INTEGRATIONS_DATA_DIR;
  const originalPool = globalThis.__integrationPathPool;
  try {
    delete process.env.INTEGRATIONS_DATA_DIR;
    const apiRoot = path.join(directory, 'artifacts/api-server');
    const canonical = path.join(apiRoot, '.local/integrations');
    const legacy = path.join(directory, '.local/integrations');
    await mkdir(canonical, { recursive: true }); await mkdir(legacy, { recursive: true });
    await writeFile(path.join(apiRoot, 'package.json'), JSON.stringify({ name: '@workspace/api-server' }));
    const canonicalKey = randomBytes(32); const legacyKey = randomBytes(32);
    await writeFile(path.join(canonical, 'master.key'), canonicalKey);
    await writeFile(path.join(legacy, 'master.key'), legacyKey);
    const encrypt = (config, key) => {
      const iv = randomBytes(12); const cipher = createCipheriv('aes-256-gcm', key, iv);
      const data = Buffer.concat([cipher.update(JSON.stringify(config)), cipher.final()]);
      return Buffer.concat([iv, cipher.getAuthTag(), data]);
    };
    let remote = encrypt({ supabaseKey: 'canonical-fixture' }, canonicalKey).toString('base64');
    await writeFile(path.join(legacy, 'credentials.enc'), encrypt({ brevoKey: 'legacy-brevo-fixture', resendKey: 'retired-provider-secret' }, legacyKey));
    globalThis.__integrationPathPool = { query: async () => ({ rows: [{ encrypted_config: remote }] }) };
    const output = path.join(directory, 'storage.cjs');
    await build({ entryPoints: [path.resolve('src/lib/integrations.ts')], outfile: output, bundle: true, platform: 'node', format: 'cjs', logLevel: 'silent', define: { 'import.meta.url': JSON.stringify(pathToFileURL(path.join(apiRoot, 'dist/index.mjs')).href) }, plugins: [{ name: 'mock-db', setup(build) {
      build.onResolve({ filter: /^@workspace\/db$/ }, () => ({ path: 'db', namespace: 'mock-db' }));
      build.onLoad({ filter: /.*/, namespace: 'mock-db' }, () => ({ contents: 'export const pool = globalThis.__integrationPathPool;', loader: 'js' }));
    } }] });
    const storage = require(output);
    let config = await storage.readIntegrations();
    assert.equal(config.supabaseKey, 'canonical-fixture');
    assert.equal(config.brevoKey, 'legacy-brevo-fixture');
    assert.equal('resendKey' in config, false);
    remote = encrypt({ supabaseKey: 'legacy-fixture' }, legacyKey).toString('base64');
    config = await storage.readIntegrations();
    assert.equal(config.supabaseKey, 'legacy-fixture');
    await rm(path.join(canonical, 'master.key'));
    remote = encrypt({ supabaseKey: 'unavailable-fixture' }, canonicalKey).toString('base64');
    assert.notEqual((await storage.readIntegrations()).supabaseKey, 'unavailable-fixture');
    // Reads never replace a missing key with a new random key.
    await assert.rejects(readFile(path.join(canonical, 'master.key')), { code: 'ENOENT' });
    assert.deepEqual(await readFile(path.join(legacy, 'master.key')), legacyKey);
  } finally {
    if (originalDirectory === undefined) delete process.env.INTEGRATIONS_DATA_DIR;
    else process.env.INTEGRATIONS_DATA_DIR = originalDirectory;
    if (originalPool === undefined) delete globalThis.__integrationPathPool;
    else globalThis.__integrationPathPool = originalPool;
    await rm(directory, { recursive: true, force: true });
  }
});
