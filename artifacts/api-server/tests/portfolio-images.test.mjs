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
test('portfolio uploads require admin, validate images, enforce size and serve saved bytes', async () => {
  const directory = await mkdtemp(path.join(tmpdir(), 'service-car-upload-'));
  const oldEnv = { ...process.env }; const originalFetch = globalThis.fetch; let server;
  try {
    process.env.PORTFOLIO_UPLOAD_DIR = path.join(directory, 'uploads');
    process.env.SUPABASE_URL = 'https://test.supabase.co'; process.env.SUPABASE_PUBLISHABLE_KEY = 'fixture'; process.env.ADMIN_EMAIL = 'admin@example.com';
    globalThis.fetch = async () => Response.json({ id: 'fixture', email: 'admin@example.com', email_confirmed_at: '2026-01-01' });
    const output = path.join(directory, 'router.cjs');
    await build({ entryPoints: [path.resolve('src/routes/portfolio-images.ts')], outfile: output, bundle: true, platform: 'node', format: 'cjs', logLevel: 'silent' });
    const app = express(); app.use('/api', require(output).default);
    server = app.listen(0, '127.0.0.1'); await new Promise(resolve => server.once('listening', resolve));
    const base = `http://127.0.0.1:${server.address().port}`;
    const call = (url, body, headers = {}) => new Promise((resolve, reject) => {
      const req = http.request(base + url, { method: body ? 'POST' : 'GET', headers }, response => { const chunks = []; response.on('data', chunk => chunks.push(chunk)); response.on('end', () => resolve({ status: response.statusCode, headers: response.headers, body: Buffer.concat(chunks) })); });
      req.on('error', reject); if (body) req.write(body); req.end();
    });
    const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aJb8AAAAASUVORK5CYII=', 'base64');
    const endpoint = '/api/admin/portfolio-image'; const headers = { Authorization: 'Bearer fixture', 'Content-Type': 'image/png' };
    assert.equal((await call(endpoint, png, { 'Content-Type': 'image/png' })).status, 401);
    assert.equal((await call(endpoint, Buffer.from('<svg></svg>'), headers)).status, 400);
    assert.equal((await call(endpoint, png, { ...headers, 'Content-Type': 'image/jpeg' })).status, 400);
    assert.equal((await call(endpoint, Buffer.alloc(8 * 1024 * 1024 + 1), headers)).status, 413);
    const saved = await call(endpoint, png, headers); assert.equal(saved.status, 201);
    const { imageUrl } = JSON.parse(saved.body.toString()); assert.match(imageUrl, /^\/api\/portfolio-images\/[a-f0-9-]+\.png$/);
    const image = await call(imageUrl); assert.equal(image.status, 200); assert.deepEqual(image.body, png); assert.equal(image.headers['x-content-type-options'], 'nosniff');
  } finally {
    globalThis.fetch = originalFetch;
    for (const key of Object.keys(process.env)) if (!(key in oldEnv)) delete process.env[key]; Object.assign(process.env, oldEnv);
    if (server) await new Promise(resolve => server.close(resolve)); await rm(directory, { recursive: true, force: true });
  }
});
