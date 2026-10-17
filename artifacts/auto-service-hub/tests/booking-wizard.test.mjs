import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { mkdir } from 'node:fs/promises';
import { test } from 'node:test';
const { chromium } = createRequire(import.meta.url)('playwright');

test('booking steps, validation, preserved details, submission and mobile layout', async () => {
  const browser = await chromium.launch({ channel: 'msedge', headless: true });
  const page = await browser.newPage({ viewport: { width: 1280, height: 1000 } });
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.clock.setFixedTime(new Date('2026-10-16T10:00:00Z'));
  let sent = null;
  let schedule = {
    weekly: Array.from({ length: 7 }, (_, i) => ({ enabled: i < 6, start: '09:00', end: '17:00', breakStart: '', breakEnd: '' })),
    intervalMinutes: 60, advanceDays: 180, firstDate: '', lastDate: '', holidays: [],
  };
  const services = [{ id: 'inspection', name: 'Inspektion', category: 'Wartung', description: 'Fahrzeugcheck', priceLabel: 'ab 149 €', durationMinutes: 60, icon: 'system-service' }];
  await page.route('**/api/**', async (route) => {
    const url = new URL(route.request().url());
    let data = [];
    if (url.pathname === '/api/services') data = services;
    if (url.pathname === '/api/shop' || url.pathname === '/api/admin/settings') data = { name: 'KFZ-Service', tagline: 'Ihr Partner', openingHours: 'Mo–Fr 09:00–17:00', phone: '', whatsapp: '', address: '', city: '', emergencyPhone: '', mapUrl: '' };
    if (url.pathname === '/api/availability') data = [{ date: '2026-10-20', open: false, reason: 'Betriebsferien', slots: [] }, { date: '2026-10-19', open: true, slots: [{ time: '09:00', available: true }, { time: '10:00', available: false }, { time: '11:00', available: true }] }];
    if (url.pathname === '/api/appointments') { sent = route.request().postDataJSON(); data = { referenceCode: 'AS-TEST-123', message: 'OK' }; }
    if (url.pathname === '/api/admin/summary') data = { pendingAppointments: 0, totalAppointments: 0, upcomingAppointments: 0, pendingReviews: 0, blockedSlots: 0 };
    if (url.pathname === '/api/admin/booking-schedule') { if (route.request().method() === 'PUT') schedule = route.request().postDataJSON(); data = schedule; }
    await route.fulfill({ json: data });
  });
  try {
    await page.goto(process.env.BOOKING_TEST_URL || 'http://127.0.0.1:5173/');
    const wizard = page.locator('#rezervo');
    await wizard.scrollIntoViewIfNeeded();
    await page.waitForFunction(() => document.querySelector('#rezervo button[aria-pressed]'));
    assert.equal(await wizard.getByRole('button', { name: 'Weiter', exact: true }).isDisabled(), true);
    await wizard.getByRole('button', { name: /Inspektion/ }).click();
    await mkdir('test-results', { recursive: true });
    await wizard.screenshot({ path: 'test-results/booking-services.png' });
    await wizard.getByRole('button', { name: 'Weiter', exact: true }).click();
    await wizard.getByRole('button', { name: 'Dienstag, 20. Oktober — Betriebsferien', exact: true }).click({ force: true });
    await wizard.getByRole('status').waitFor();
    assert.match(await wizard.getByRole('status').textContent(), /Betriebsferien/);
    assert.equal(await wizard.getByRole('button', { name: 'Weiter', exact: true }).isDisabled(), true);
    await wizard.getByRole('button', { name: 'Montag, 19. Oktober', exact: true }).click();
    assert.equal(await wizard.getByRole('button', { name: '10:00 · Belegt', exact: true }).isDisabled(), true);
    await wizard.getByRole('button', { name: '09:00', exact: true }).click();
    await wizard.screenshot({ path: 'test-results/booking-calendar.png' });
    await wizard.getByRole('button', { name: 'Weiter', exact: true }).click();
    await wizard.getByRole('button', { name: 'Weiter', exact: true }).click();
    assert.equal(await wizard.getByRole('heading', { name: 'Fahrzeug- & Kontaktdaten' }).isVisible(), true);
    const details = { customerName: 'Max Mustermann', phone: '+49 12345678', email: 'max@example.com', vehicleMake: 'BMW', vehicleModel: '320d', vehicleYear: '2020', licensePlate: 'B-AB 123', notes: 'Bitte Bremsen prüfen.' };
    for (const [name, value] of Object.entries(details)) await wizard.locator(`[name="${name}"]`).fill(value);
    await wizard.screenshot({ path: 'test-results/booking-contact.png' });
    await wizard.getByRole('button', { name: 'Weiter', exact: true }).click();
    assert.equal(await wizard.getByText('BMW 320d · 2020', { exact: true }).isVisible(), true);
    await wizard.getByRole('button', { name: 'Zurück', exact: true }).click();
    assert.equal(await wizard.locator('[name="customerName"]').inputValue(), details.customerName);
    await wizard.getByRole('button', { name: 'Weiter', exact: true }).click();
    await wizard.screenshot({ path: 'test-results/booking-confirmation.png' });
    await page.setViewportSize({ width: 390, height: 844 });
    await wizard.screenshot({ path: 'test-results/booking-mobile.png' });
    assert.equal(await wizard.evaluate((element) => element.scrollWidth <= element.clientWidth), true);
    await wizard.getByRole('button', { name: 'Terminanfrage senden', exact: true }).click();
    await wizard.getByText('AS-TEST-123', { exact: true }).waitFor();
    assert.equal(sent.serviceId, 'inspection');
    assert.equal(sent.appointmentDate, '2026-10-19');
    assert.equal(sent.appointmentTime, '09:00');
    assert.equal(sent.vehicleYear, 2020);
    assert.equal(sent.customerName, details.customerName);

    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.goto((process.env.BOOKING_TEST_URL || 'http://127.0.0.1:5173/') + 'admin');
    await page.getByRole('button', { name: 'Verfügbarkeit', exact: true }).click();
    await page.getByRole('heading', { name: 'Arbeitszeiten & Buchungskalender' }).waitFor();
    await page.getByLabel('Montag Von', { exact: true }).fill('08:00');
    await page.getByRole('button', { name: 'Zeitraum hinzufügen', exact: true }).click();
    await page.getByLabel('Bezeichnung', { exact: true }).fill('Weihnachten');
    await page.getByLabel('Von', { exact: true }).fill('2026-12-24');
    await page.getByLabel('Bis', { exact: true }).fill('2026-12-26');
    await page.getByRole('button', { name: 'Kalender speichern', exact: true }).click();
    await page.getByText('Arbeitszeiten und freie Termine wurden aktualisiert.', { exact: true }).waitFor();
    assert.equal(schedule.weekly[0].start, '08:00');
    assert.deepEqual(schedule.holidays, [{ from: '2026-12-24', to: '2026-12-26', label: 'Weihnachten' }]);
    await page.screenshot({ path: 'test-results/booking-admin.png', fullPage: true });
    assert.deepEqual(errors, []);
  } finally { await browser.close(); }
});
