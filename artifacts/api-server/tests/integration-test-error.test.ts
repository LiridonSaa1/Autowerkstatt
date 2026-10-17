import { test } from 'node:test';
import assert from 'node:assert/strict';
import { integrationTestError } from '../src/lib/integration-test-error.ts';
test('Brevo authentication and permission failures have distinct instructions', () => {
  assert.match(integrationTestError('brevo', 401, {}), /API-v3.*SMTP-Schlüssel/);
  assert.match(integrationTestError('brevo', 403, {}), /Berechtigungen.*IP-Adressen/);
});
test('provider responses never expose raw account data', () => {
  for (const provider of ['brevo', 'supabase', 'twilio']) {
    assert.ok(!integrationTestError(provider, 400, { message: 'SECRET_VALUE' }).includes('SECRET_VALUE'));
    assert.match(integrationTestError(provider, 429, null), /Zu viele Anfragen/);
    assert.match(integrationTestError(provider, 503, null), /vorübergehend/);
  }
});