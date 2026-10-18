import { pool } from '@workspace/db';
import { createHash, randomUUID } from 'node:crypto';
import { serverKinds, uuid, type ActivityEvent, type EventKind } from './checkout-activity';

// Explicit schema migration: scripts/checkout-activity-schema.sql. No runtime DDL.
const columns = `id, session_id AS "sessionId", kind, occurred_at AS "occurredAt", source,
  vin, country, internal, bot, code, reference`;
export async function insertActivity(event: ActivityEvent) {
  await pool.query(`INSERT INTO checkout_activity_events
    (id, session_id, kind, occurred_at, source, vin, country, internal, bot, code, reference)
    VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) ON CONFLICT DO NOTHING`,
  [event.id, event.sessionId, event.kind, event.occurredAt, event.source, event.vin,
    event.country, event.internal, event.bot, event.code, event.reference]);
}

/** Call ONLY after creating a payment on the server, verifying a signed provider
 * webhook, or committing an order. Never call this from a public event endpoint.
 * Reference must be a stable provider payment/order ID; only its hash is stored.
 * Reuse the original session ID from checkout metadata in each webhook handler. */
export async function recordCheckoutFact(input: {
  kind: typeof serverKinds[number]; sessionId: string; reference: string;
  vin?: string; country?: string; internal?: boolean; bot?: boolean;
}) {
  if (!uuid.safeParse(input.sessionId).success || !input.reference || input.reference.length > 256) throw new Error('Invalid checkout fact');
  if (!serverKinds.includes(input.kind)) throw new Error('Unsupported checkout fact');
  const reference = createHash('sha256').update(input.reference).digest('hex');
  await insertActivity({ id: randomUUID(), sessionId: input.sessionId, kind: input.kind,
    occurredAt: new Date().toISOString(), source: 'server', reference,
    vin: input.vin && /^[A-HJ-NPR-Z0-9]{17}$/.test(input.vin.toUpperCase()) ? input.vin.toUpperCase() : null,
    country: input.country && /^[A-Z]{2}$/.test(input.country) ? input.country : null,
    internal: input.internal ?? false, bot: input.bot ?? false, code: null });
}

export type Filters = { from: string; to: string; country?: string; vin?: string; hideInternal: string; hideBots: string; page: number };
export async function listActivity(filters: Filters, connection: Pick<typeof pool, 'query'> = pool) {
  const args: unknown[] = [filters.from, filters.to];
  const where = [`occurred_at >= ($1::date::timestamp AT TIME ZONE 'Europe/Berlin')`, `occurred_at < (($2::date + 1)::timestamp AT TIME ZONE 'Europe/Berlin')`];
  if (filters.hideInternal === 'true') where.push('NOT EXISTS (SELECT 1 FROM checkout_activity_events flags WHERE flags.session_id=checkout_activity_events.session_id AND flags.internal)');
  if (filters.hideBots === 'true') where.push('NOT EXISTS (SELECT 1 FROM checkout_activity_events flags WHERE flags.session_id=checkout_activity_events.session_id AND flags.bot)');
  const sessionConditions: string[] = [];
  if (filters.country) { args.push(filters.country); sessionConditions.push(`session_id IN (SELECT session_id FROM scoped WHERE country = $${args.length})`); }
  // Match sessions by VIN, then keep all their steps within the selected period.
  if (filters.vin) { args.push(`${filters.vin}%`); sessionConditions.push(`session_id IN (SELECT session_id FROM scoped WHERE vin LIKE $${args.length})`); }
  const vinCondition = sessionConditions.length ? `WHERE ${sessionConditions.join(' AND ')}` : '';
  const scope = `WITH scoped AS (SELECT * FROM checkout_activity_events WHERE ${where.join(' AND ')}),
    filtered AS (SELECT * FROM scoped ${vinCondition})`;
  // A single database snapshot keeps totals and paginated rows consistent.
  const result = await connection.query(`${scope}, grouped AS (
    SELECT session_id AS "sessionId", min(occurred_at) AS "firstAt", max(occurred_at) AS "lastAt",
      count(*)::int AS "eventCount", array_remove(array_agg(DISTINCT vin), NULL) AS vins,
      array_remove(array_agg(DISTINCT country), NULL) AS countries,
      bool_or(internal) AS internal, bool_or(bot) AS bot,
      bool_or(kind='payment_confirmed' AND source='server') AS confirmed,
      bool_or(kind='payment_failed' AND source='server') AS failed,
      bool_or(kind='payment_started' AND source='server') AS started,
      bool_or(kind='order_saved' AND source='server') AS "orderSaved"
    FROM filtered GROUP BY session_id
  ), paged AS (SELECT * FROM grouped ORDER BY "lastAt" DESC, "sessionId" LIMIT 25 OFFSET $${args.length + 1})
  SELECT json_build_object(
    'sessions', (SELECT count(*)::int FROM grouped),
    'visits', count(DISTINCT session_id) FILTER (WHERE kind='visit'),
    'vinSearches', count(*) FILTER (WHERE kind='vin_search_started'),
    'paymentAttempts', count(*) FILTER (WHERE kind='payment_started' AND source='server'),
    'purchases', count(DISTINCT reference) FILTER (WHERE kind='payment_confirmed' AND source='server'),
    'orders', count(DISTINCT reference) FILTER (WHERE kind='order_saved' AND source='server'),
    'errors', count(*) FILTER (WHERE kind IN ('vin_search_failed','checkout_error') OR (kind='payment_failed' AND source='server'))
  ) AS summary, COALESCE((SELECT json_agg(paged) FROM paged), '[]'::json) AS sessions FROM filtered`,
  [...args, (filters.page - 1) * 25]);
  return { ...result.rows[0], page: filters.page, pageSize: 25, timezone: 'Europe/Berlin' };
}

export async function sessionActivity(sessionId: string, cursor?: string) {
  const result = await pool.query(`SELECT ${columns} FROM checkout_activity_events
    WHERE session_id=$1 AND ($2::uuid IS NULL OR (occurred_at,id) >
      (SELECT occurred_at,id FROM checkout_activity_events WHERE id=$2::uuid AND session_id=$1))
    ORDER BY occurred_at, id LIMIT 501`, [sessionId, cursor || null]);
  return result.rows.map(row => ({ ...row, occurredAt: new Date(row.occurredAt).toISOString() })) as ActivityEvent[];
}
