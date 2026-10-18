import { z } from 'zod/v4';

export const clientKinds = ['visit', 'vin_search_started', 'vin_search_succeeded', 'vin_search_failed', 'checkout_started', 'checkout_error'] as const;
export const serverKinds = ['payment_started', 'payment_failed', 'payment_confirmed', 'order_saved'] as const;
export const eventKinds = [...clientKinds, ...serverKinds] as const;
export type EventKind = typeof eventKinds[number];
export const uuid = z.uuid();
export const clientEventSchema = z.object({
  id: uuid, sessionId: uuid, kind: z.enum(clientKinds),
  vin: z.string().trim().toUpperCase().regex(/^[A-HJ-NPR-Z0-9]{17}$/).optional(),
  // No free-form messages, URL query strings, payment payloads or personal details.
  code: z.enum(['network_error', 'invalid_vin', 'not_found', 'provider_error', 'validation_error']).optional(),
  internal: z.boolean().optional(),
}).strict();
export type ActivityEvent = {
  id: string; sessionId: string; kind: EventKind; occurredAt: string;
  source: 'client' | 'server'; vin: string | null; country: string | null;
  internal: boolean; bot: boolean; code: string | null; reference: string | null;
};

export const isTrusted = (event: Pick<ActivityEvent, 'source'>) => event.source === 'server';
export function summarize(events: ActivityEvent[]) {
  const unique = [...new Map(events.map(event => [event.id, event])).values()];
  const count = (kind: EventKind, trusted = false) => unique.filter(event => event.kind === kind && (!trusted || isTrusted(event))).length;
  return {
    sessions: new Set(unique.map(event => event.sessionId)).size,
    visits: new Set(unique.filter(event => event.kind === 'visit').map(event => event.sessionId)).size,
    vinSearches: count('vin_search_started'), paymentAttempts: count('payment_started', true),
    purchases: new Set(unique.filter(event => event.kind === 'payment_confirmed' && isTrusted(event)).map(event => event.reference || event.id)).size,
    orders: new Set(unique.filter(event => event.kind === 'order_saved' && isTrusted(event)).map(event => event.reference || event.id)).size,
    errors: unique.filter(event => ['vin_search_failed', 'checkout_error', 'payment_failed'].includes(event.kind) && (event.kind !== 'payment_failed' || isTrusted(event))).length,
  };
}

export function describeSession(events: ActivityEvent[], now = Date.now()) {
  const timeline = [...new Map(events.map(event => [event.id, event])).values()]
    .sort((a, b) => a.occurredAt.localeCompare(b.occurredAt) || a.id.localeCompare(b.id));
  const has = (kind: EventKind) => timeline.some(event => event.kind === kind && (!serverKinds.includes(kind as typeof serverKinds[number]) || isTrusted(event)));
  const paymentStatus = has('payment_confirmed') ? 'confirmed' : has('payment_failed') ? 'failed' : has('payment_started') ? 'started' : 'none';
  const orderSaved = has('order_saved');
  const last = timeline.at(-1);
  const inactive = Boolean(last && now - Date.parse(last.occurredAt) > 30 * 60_000);
  const hypothesis = paymentStatus === 'confirmed' || !inactive ? null
    : paymentStatus === 'failed' ? 'Möglicher Abbruch nach einem Zahlungsfehler; tatsächlicher Grund unbekannt.'
    : has('vin_search_failed') ? 'Möglicher Abbruch nach der FIN-Suche; tatsächlicher Grund unbekannt.'
    : 'Seit über 30 Minuten kein weiteres Ereignis. Ein Abbruch ist möglich, aber nicht bestätigt.';
  return { timeline, paymentStatus, orderSaved, inactive, hypothesis };
}

export function groupSessions(events: ActivityEvent[]) {
  const groups = new Map<string, ActivityEvent[]>();
  for (const event of events) groups.set(event.sessionId, [...(groups.get(event.sessionId) || []), event]);
  return [...groups].map(([sessionId, items]) => ({ sessionId, ...describeSession(items) }));
}

export function parseActivityFilters(input: unknown) {
  const date = z.iso.date();
  return z.object({ from: date, to: date, country: z.string().regex(/^[A-Z]{2}$/).optional(),
    vin: z.string().trim().toUpperCase().regex(/^[A-HJ-NPR-Z0-9]{1,17}$/).optional(),
    hideInternal: z.enum(['true', 'false']).default('true'), hideBots: z.enum(['true', 'false']).default('true'),
    page: z.coerce.number().int().min(1).max(10000).default(1),
  }).refine(value => value.from <= value.to && Date.parse(value.to) - Date.parse(value.from) <= 92 * 86400_000,
    'Bitte einen Zeitraum von höchstens 93 Tagen wählen.').safeParse(input);
}
