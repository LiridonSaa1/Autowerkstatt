export type DateValue = Date | string;

export function calendarDateKey(value: DateValue): string {
  return value instanceof Date ? value.toISOString().slice(0, 10) : value.slice(0, 10);
}

export function formatCalendarDate(
  value: DateValue,
  options: Intl.DateTimeFormatOptions = {},
): string {
  const date = new Date(`${calendarDateKey(value)}T12:00:00Z`);
  return date.toLocaleDateString("de-DE", {
    timeZone: "Europe/Tirane",
    ...options,
  });
}
