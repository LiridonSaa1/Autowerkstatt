import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
const require = createRequire(import.meta.url);
const { build } = require('esbuild');

test('all form notifications use the current business settings recipient and customer reply-to', async () => {
  const directory = await mkdtemp(path.join(tmpdir(), 'service-car-notifications-'));
  const sent = []; const failures = [];
  try {
    globalThis.__notificationSettings = { name: 'Werkstatt', email: 'office@example.com' };
    globalThis.__notificationSend = async (input) => { sent.push(input); };
    globalThis.__notificationLog = (input) => failures.push(input);
    const output = path.join(directory, 'notifications.cjs');
    await build({ entryPoints: [path.resolve('src/lib/business-notifications.ts')], outfile: output, bundle: true, platform: 'node', format: 'cjs', logLevel: 'silent', plugins: [{ name: 'fixtures', setup(build) {
      build.onResolve({ filter: /^\.\.\/routes\/settings$|^\.\/send-email$|^\.\/logger$/ }, args => ({ path: args.path, namespace: 'fixture' }));
      build.onLoad({ filter: /.*/, namespace: 'fixture' }, args => ({ contents: args.path.endsWith('settings') ? 'export const readSettings=async()=>globalThis.__notificationSettings;' : args.path.endsWith('send-email') ? 'export const sendEmail=async input=>globalThis.__notificationSend(input);' : 'export const logger={error:input=>globalThis.__notificationLog(input)};', loader: 'js' }));
    } }] });
    const { notifyBusiness } = require(output);
    const customer = { name: 'Customer', email: 'customer@example.com' };
    const forms = [
      { kind: 'appointment', customer, phone: '+4912345678', referenceCode: 'AS-123', date: '2026-11-02', time: '09:00', service: 'Inspektion', vehicle: 'BMW 320d, 2020', notes: 'Bremsen prüfen' },
      { kind: 'quote', customer, id: 7, phone: '+4912345678', vehicle: 'Audi A4', parts: 'Öl und Filter', preferredDate: '2026-11-03' },
      { kind: 'contact', customer, subject: 'Öffnungszeiten?', message: 'Bitte melden Sie sich.' },
    ];
    for (const form of forms) assert.equal(await notifyBusiness(form), true);
    assert.equal(sent.length, 3);
    for (const message of sent) {
      assert.equal(message.email, 'office@example.com');
      assert.equal(message.senderName, 'Werkstatt');
      assert.deepEqual(message.replyTo, customer);
      assert.match(message.message, /customer@example.com/);
    }
    assert.match(sent[0].message, /AS-123.*\nWunschtermin: 2026-11-02 · 09:00 Uhr/);
    assert.match(sent[0].message, /Inspektion/);
    assert.match(sent[1].message, /Öl und Filter/);
    assert.match(sent[2].message, /Bitte melden Sie sich/);
    globalThis.__notificationSettings.email = 'new-office@example.com';
    await notifyBusiness(forms[0]);
    assert.equal(sent.at(-1).email, 'new-office@example.com');
    globalThis.__notificationSettings.email = '';
    assert.equal(await notifyBusiness(forms[0]), false);
    assert.equal(sent.length, 4);
    globalThis.__notificationSettings.email = 'office@example.com';
    globalThis.__notificationSend = async () => { throw new Error('fixture provider failure'); };
    assert.equal(await notifyBusiness(forms[1]), false);
    assert.equal(failures.length, 2);
    assert.deepEqual(Object.keys(failures[0]), ['notificationType']);
  } finally {
    delete globalThis.__notificationSettings; delete globalThis.__notificationSend; delete globalThis.__notificationLog;
    await rm(directory, { recursive: true, force: true });
  }
});
