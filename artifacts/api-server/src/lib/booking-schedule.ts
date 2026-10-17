import { z } from 'zod/v4';

const time = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/);
const date = z.iso.date();
const daySchema = z.object({
  enabled: z.boolean(),
  start: time,
  end: time,
  breakStart: z.union([time, z.literal('')]),
  breakEnd: z.union([time, z.literal('')]),
}).refine((day) => !day.enabled || day.start < day.end, 'Beginn muss vor dem Ende liegen.')
  .refine((day) => !day.enabled || (!day.breakStart && !day.breakEnd) ||
    Boolean(day.breakStart && day.breakEnd && day.breakStart >= day.start && day.breakEnd <= day.end && day.breakStart < day.breakEnd),
  'Prüfen Sie die Pausenzeiten.');

export const bookingScheduleSchema = z.object({
  weekly: z.array(daySchema).length(7), // Monday through Sunday
  intervalMinutes: z.number().int().min(15).max(240),
  advanceDays: z.number().int().min(1).max(730),
  firstDate: z.union([date, z.literal('')]),
  lastDate: z.union([date, z.literal('')]),
  holidays: z.array(z.object({ from: date, to: date, label: z.string().trim().min(1).max(120) })
    .refine((holiday) => holiday.from <= holiday.to, 'Prüfen Sie den Ferienzeitraum.')).max(200),
}).refine((schedule) => !schedule.firstDate || !schedule.lastDate || schedule.firstDate <= schedule.lastDate,
  'Das Enddatum muss nach dem Startdatum liegen.');

export type BookingSchedule = z.infer<typeof bookingScheduleSchema>;

export const defaultBookingSchedule: BookingSchedule = {
  weekly: Array.from({ length: 7 }, (_, index) => ({
    enabled: index < 6, start: '09:00', end: index === 5 ? '13:00' : '17:00', breakStart: '', breakEnd: '',
  })),
  intervalMinutes: 60,
  advanceDays: 180,
  firstDate: '',
  lastDate: '',
  holidays: [],
};

export function businessNow(now = new Date()) {
  const parts = new Intl.DateTimeFormat('en', {
    timeZone: 'Europe/Berlin', year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
  }).formatToParts(now);
  const p = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return { date: `${p.year}-${p.month}-${p.day}`, time: `${p.hour}:${p.minute}` };
}

const minutes = (value: string) => Number(value.slice(0, 2)) * 60 + Number(value.slice(3));

export function scheduleClosureReason(schedule: BookingSchedule, dateKey: string, now = new Date()): string | null {
  const holiday = schedule.holidays.find((item) => dateKey >= item.from && dateKey <= item.to);
  if (holiday) return holiday.label;
  const today = businessNow(now);
  if (dateKey < today.date) return 'Vergangen';
  const weekday = (new Date(`${dateKey}T12:00:00Z`).getUTCDay() + 6) % 7;
  if (!schedule.weekly[weekday]?.enabled) return 'Ruhetag';
  const lastAllowed = new Date(`${today.date}T12:00:00Z`);
  lastAllowed.setUTCDate(lastAllowed.getUTCDate() + schedule.advanceDays);
  if ((schedule.firstDate && dateKey < schedule.firstDate) || (schedule.lastDate && dateKey > schedule.lastDate) || dateKey > lastAllowed.toISOString().slice(0, 10)) return 'Nicht freigegeben';
  if (!scheduleSlots(schedule, dateKey, now).length) return dateKey === today.date ? 'Heute keine Termine mehr' : 'Keine Zeitfenster';
  return null;
}

export function scheduleSlots(schedule: BookingSchedule, dateKey: string, now = new Date()): string[] {
  const today = businessNow(now);
  const lastAllowed = new Date(`${today.date}T12:00:00Z`);
  lastAllowed.setUTCDate(lastAllowed.getUTCDate() + schedule.advanceDays);
  if (dateKey < today.date || dateKey > lastAllowed.toISOString().slice(0, 10) ||
    (schedule.firstDate && dateKey < schedule.firstDate) || (schedule.lastDate && dateKey > schedule.lastDate) ||
    schedule.holidays.some((holiday) => dateKey >= holiday.from && dateKey <= holiday.to)) return [];
  const weekday = (new Date(`${dateKey}T12:00:00Z`).getUTCDay() + 6) % 7;
  const day = schedule.weekly[weekday];
  if (!day?.enabled) return [];
  const slots: string[] = [];
  for (let start = minutes(day.start); start + schedule.intervalMinutes <= minutes(day.end); start += schedule.intervalMinutes) {
    const end = start + schedule.intervalMinutes;
    if (day.breakStart && day.breakEnd && start < minutes(day.breakEnd) && end > minutes(day.breakStart)) continue;
    const slot = `${String(Math.floor(start / 60)).padStart(2, '0')}:${String(start % 60).padStart(2, '0')}`;
    if (dateKey === today.date && slot <= today.time) continue;
    slots.push(slot);
  }
  return slots;
}
