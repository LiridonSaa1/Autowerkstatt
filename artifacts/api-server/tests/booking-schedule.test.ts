import assert from 'node:assert/strict';
import { test } from 'node:test';
import { bookingScheduleSchema, businessNow, defaultBookingSchedule, scheduleSlots, scheduleClosureReason } from '../src/lib/booking-schedule.ts';

const now = new Date('2026-10-16T06:00:00Z');
const schedule = () => structuredClone(defaultBookingSchedule);

test('unavailable dates explain holidays, rest days, past dates and booking limits', () => {
  const s = schedule();
  s.holidays = [{ from: '2026-10-19', to: '2026-10-21', label: 'Betriebsferien' }];
  assert.equal(scheduleClosureReason(s, '2026-10-19', now), 'Betriebsferien');
  assert.equal(scheduleClosureReason(s, '2026-10-21', now), 'Betriebsferien');
  assert.equal(scheduleClosureReason(s, '2026-10-18', now), 'Ruhetag');
  assert.equal(scheduleClosureReason(s, '2026-10-15', now), 'Vergangen');
  assert.equal(scheduleClosureReason(s, '2026-10-22', now), null);
  s.advanceDays = 2;
  assert.equal(scheduleClosureReason(s, '2026-10-22', now), 'Nicht freigegeben');
});

test('weekly hours and interval determine the available starts', () => {
  const s = schedule();
  s.weekly[0] = { enabled: true, start: '08:00', end: '10:30', breakStart: '', breakEnd: '' };
  assert.deepEqual(scheduleSlots(s, '2026-10-19', now), ['08:00', '09:00']);
});
test('closed weekdays cannot be booked; Sunday can be explicitly opened', () => {
  const s = schedule();
  assert.deepEqual(scheduleSlots(s, '2026-10-18', now), []);
  s.weekly[6] = { enabled: true, start: '10:00', end: '11:00', breakStart: '', breakEnd: '' };
  assert.deepEqual(scheduleSlots(s, '2026-10-18', now), ['10:00']);
});
test('slots overlapping a break are excluded, including partial overlaps', () => {
  const s = schedule();
  s.weekly[0].breakStart = '11:30'; s.weekly[0].breakEnd = '13:30';
  const slots = scheduleSlots(s, '2026-10-19', now);
  assert.ok(!slots.includes('11:00') && !slots.includes('12:00') && !slots.includes('13:00'));
  assert.ok(slots.includes('10:00') && slots.includes('14:00'));
});
test('holiday ranges exclude both start and end dates', () => {
  const s = schedule();
  s.holidays = [{ from: '2026-10-19', to: '2026-10-21', label: 'Betriebsferien' }];
  for (const date of ['2026-10-19', '2026-10-20', '2026-10-21']) assert.deepEqual(scheduleSlots(s, date, now), []);
  assert.ok(scheduleSlots(s, '2026-10-22', now).length);
});
test('date limits and advance booking horizon are enforced', () => {
  const s = schedule();
  s.firstDate = '2026-10-19'; s.lastDate = '2026-10-22';
  assert.deepEqual(scheduleSlots(s, '2026-10-17', now), []);
  assert.ok(scheduleSlots(s, '2026-10-19', now).length);
  assert.ok(scheduleSlots(s, '2026-10-22', now).length);
  assert.deepEqual(scheduleSlots(s, '2026-10-23', now), []);
  s.advanceDays = 2;
  assert.deepEqual(scheduleSlots(s, '2026-10-19', now), []);
});
test('past dates and elapsed times in Berlin are unavailable', () => {
  assert.deepEqual(scheduleSlots(schedule(), '2026-10-15', now), []);
  const afternoon = new Date('2026-10-16T12:30:00Z');
  assert.deepEqual(scheduleSlots(schedule(), '2026-10-16', afternoon), ['15:00', '16:00']);
  assert.deepEqual(businessNow(afternoon), { date: '2026-10-16', time: '14:30' });
  assert.deepEqual(businessNow(new Date('2026-10-25T01:30:00Z')), { date: '2026-10-25', time: '02:30' });
});
test('invalid schedules are rejected before saving', () => {
  const s = schedule();
  s.weekly[0].end = '08:00';
  assert.equal(bookingScheduleSchema.safeParse(s).success, false);
  const halfBreak = schedule(); halfBreak.weekly[0].breakStart = '12:00';
  assert.equal(bookingScheduleSchema.safeParse(halfBreak).success, false);
  const holiday = schedule(); holiday.holidays = [{ from: '2026-02-30', to: '2026-03-01', label: 'Invalid' }];
  assert.equal(bookingScheduleSchema.safeParse(holiday).success, false);
  assert.equal(bookingScheduleSchema.safeParse({ ...schedule(), intervalMinutes: 0 }).success, false);
});
