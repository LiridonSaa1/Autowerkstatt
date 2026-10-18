/** Browser observations only. Payment/order facts are accepted only from server integrations. */
type ClientKind = 'visit' | 'vin_search_started' | 'vin_search_succeeded' | 'vin_search_failed' | 'checkout_started' | 'checkout_error';
type ErrorCode = 'network_error' | 'invalid_vin' | 'not_found' | 'provider_error' | 'validation_error';
const key = 'checkout-activity-session-v1';
let memory: { id: string; last: number; internal?: boolean } | undefined;
export function activitySession() {
  try {
    const stored = JSON.parse(sessionStorage.getItem(key) || 'null');
    if (stored && typeof stored.id === 'string' && /^[0-9a-f-]{36}$/i.test(stored.id) && Number.isFinite(stored.last)) {
      memory = { id: stored.id, last: stored.last, internal: stored.internal === true };
    }
  } catch { /* Private browsing: in-memory session. */ }
  if (!memory || Date.now() - memory.last > 30 * 60_000) memory = { id: crypto.randomUUID(), last: Date.now(), internal: memory?.internal };
  memory.last = Date.now();
  try { sessionStorage.setItem(key, JSON.stringify(memory)); } catch { /* No persistent storage needed. */ }
  return memory;
}
export function markActivityInternal() {
  const session = activitySession();
  session.internal = true;
  try { sessionStorage.setItem(key, JSON.stringify(session)); } catch { /* In-memory fallback. */ }
  return session.id;
}
export async function trackCheckoutActivity(kind: ClientKind, options: { vin?: string; code?: ErrorCode; id?: string } = {}) {
  // Do not turn telemetry failure into checkout failure or send full URLs/form values.
  if (navigator.doNotTrack === '1') return;
  const session = activitySession();
  const vin = options.vin?.trim().toUpperCase();
  try {
    await fetch(`${import.meta.env.BASE_URL}api/activity/events`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, keepalive: true,
      body: JSON.stringify({ id: options.id || crypto.randomUUID(), sessionId: session.id, kind,
        ...(vin && /^[A-HJ-NPR-Z0-9]{17}$/.test(vin) ? { vin } : {}), code: options.code, internal: session.internal || false }),
    });
  } catch { /* Best-effort browser observation, never authoritative. */ }
}
