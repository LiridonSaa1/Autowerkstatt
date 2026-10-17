import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
const require = createRequire(import.meta.url);
const { build } = require('esbuild');

test('email delivery uses Brevo headers and payload and handles missing configuration', async () => {
  const directory = await mkdtemp(path.join(tmpdir(), 'service-car-brevo-'));
  const originalFetch = globalThis.fetch;
  try {
    const output = path.join(directory, 'email.cjs');
    await build({ entryPoints: [path.resolve('src/lib/send-email.ts')], outfile: output, bundle: true, platform: 'node', format: 'cjs', logLevel: 'silent', plugins: [{ name: 'mock-config', setup(build) {
      build.onResolve({ filter: /^\.\/integrations$/ }, () => ({ path: 'integrations', namespace: 'fixture' }));
      build.onLoad({ filter: /.*/, namespace: 'fixture' }, () => ({ contents: 'export const brevoConfig = async () => globalThis.__brevoEmailFixture;', loader: 'js' }));
    } }] });
    const { sendEmail } = require(output);
    const input = { name: 'Customer', email: 'customer@example.com', subject: 'Ihr Angebot', message: 'Angebotstext', senderName: 'Werkstatt', fallbackEmail: 'fallback@example.com' };
    globalThis.__brevoEmailFixture = { key: 'brevo-fixture', from: 'sender@example.com' };
    let request;
    globalThis.fetch = async (url, options) => { request = { url, options }; return Response.json({ messageId: 'fixture' }, { status: 201 }); };
    await sendEmail(input);
    assert.equal(request.url, 'https://api.brevo.com/v3/smtp/email');
    assert.equal(request.options.headers['api-key'], 'brevo-fixture');
    assert.equal(request.options.headers.Authorization, undefined);
    assert.deepEqual(JSON.parse(request.options.body), { sender: { name: 'Werkstatt', email: 'sender@example.com' }, to: [{ name: 'Customer', email: 'customer@example.com' }], subject: 'Ihr Angebot', textContent: 'Angebotstext' });
    await sendEmail({ ...input, replyTo: { name: 'Visitor', email: 'visitor@example.com' } });
    assert.deepEqual(JSON.parse(request.options.body).replyTo, { name: 'Visitor', email: 'visitor@example.com' });
    globalThis.__brevoEmailFixture = { key: '', from: 'sender@example.com' };
    await assert.rejects(sendEmail(input), /Brevo API Key/);
    globalThis.__brevoEmailFixture = { key: 'brevo-fixture', from: '' };
    await sendEmail(input);
    assert.equal(JSON.parse(request.options.body).sender.email, input.fallbackEmail);
    globalThis.fetch = async () => Response.json({ code: 'unauthorized' }, { status: 401 });
    await assert.rejects(sendEmail(input), /Brevo hat den Versand abgelehnt/);
  } finally {
    globalThis.fetch = originalFetch;
    delete globalThis.__brevoEmailFixture;
    await rm(directory, { recursive: true, force: true });
  }
});
