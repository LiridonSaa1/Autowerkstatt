# Checkout activity

Open `/admin/checkout-activity` or **Checkout-Aktivität** in the admin navigation. All list, timeline and internal-traffic APIs use the existing server-side Supabase administrator check. No analytics data is embedded in the public bundle. Filters are saved in the URL (date, country, VIN prefix and internal/bot visibility); dates use Europe/Berlin.

## Database and deployment

Run `node --env-file=.env scripts/checkout-activity-migrate.mjs` locally. The migration adds only the analytics table and indexes, and is idempotent. `scripts/render-build.mjs` also runs it after a successful build, so the Render database user needs CREATE TABLE/INDEX permission. Existing business data is unchanged.

Run `node --env-file=.env scripts/checkout-activity-migrate.mjs --prune` to remove analytics older than 90 days. Schedule it daily in the hosting environment if a 90-day retention policy is desired. It is not an automatic destructive startup action.

## What is actually connected

The public homepage records visits. A random session ID is stored in sessionStorage with 30 minutes of inactivity expiry; there is no fingerprint, user account ID or cross-device identity. Two tabs/devices can represent different sessions; reloads in the same tab preserve the session. Do Not Track is respected. Browser events are observations and can be blocked, lost, or fabricated; they are never proof of payment.

This repository currently has **no VIN lookup checkout, Stripe integration, or purchase/order flow**. Service appointments are not purchases and are not presented as paid orders. Historic events cannot be reconstructed. The panel intentionally shows zero payment facts until a real payment backend is connected.

To instrument a future VIN lookup, call `trackCheckoutActivity('vin_search_started', { vin })`, then `vin_search_succeeded` or `vin_search_failed` with an allowlisted error code. Record `checkout_started` only when an actual purchase checkout is opened. No form field listeners infer VIN searches, and no full URLs or arbitrary error messages are collected.

On the server, use `recordCheckoutFact` from `checkout-activity-store.ts`:

1. Preserve the original `activitySession().id` with the checkout on your server and in provider metadata. Validate it as a UUID; preserve internal/bot flags too.
2. After creating a provider payment, record `payment_started` with its stable payment reference. A redirect to Stripe is not a confirmation.
3. In a **signature-verified provider webhook**, reconcile the payment with that checkout. Only a verified paid status records `payment_confirmed`; a definitive failure records `payment_failed`. Handle asynchronous payment methods explicitly. This helper does not implement webhook verification or reconcile Stripe for you.
4. Record `order_saved` only after the order database transaction commits. Reuse a stable order ID. Payment confirmation and order persistence can arrive in either order.

References are hashed before storage. A unique `(kind, reference)` index deduplicates repeated webhook facts. Client event UUIDs deduplicate retries. A saved order alone is never a confirmed purchase; a confirmed payment without a saved order is highlighted for investigation. Counts include events inside the selected period; opening a timeline intentionally shows the whole session, paginated in batches of 500.

## Country, internal traffic and bots

Country is unknown by default. Set `ACTIVITY_TRUSTED_COUNTRY_HEADER` only when your trusted edge proxy strips and overwrites that header. Never trust a browser-supplied country or infer location from its language. Country and VIN filters match sessions, retaining their other steps even if those events have no VIN/country.

Localhost traffic and successfully authenticated admin visits are marked internal. Opening an admin page marks earlier events for that tab's session internal as well. Bots are identified heuristically from user agent, not with certainty. Hiding internal/bot sessions excludes their entire recorded session. A client may self-label traffic internal but cannot create a server-confirmed payment. Set `ACTIVITY_PUBLIC_ORIGIN` to the exact public origin if a reverse proxy changes the Host header. The in-memory ingest limiter is per instance and should be replaced with shared rate limiting at larger scale.

Only event IDs, session IDs, event kind, server ingestion time, VIN when needed, optional country, flags, allowlisted error code, and hashed payment/order reference are stored. Card numbers, CVC, payment secrets, names, emails, raw IP addresses and arbitrary payloads are not accepted. Telemetry does not block the booking flow. Determine consent requirements for your deployment before enabling broader tracking.

## Verification

From `artifacts/api-server`:

- `node --test tests/checkout-activity.test.mjs` — grouping, timeline ordering, status semantics, statistics, filter validation and payload privacy.
- `node --test tests/checkout-activity-api.test.mjs` — admin authorization, forged facts, cross-origin rejection and ingest throttling.
- `node --env-file=../../.env --test tests/checkout-activity-db.test.mjs` — PostgreSQL date boundaries, filters, pagination, reference deduplication and SQL totals. Uses a temporary table and rolled-back transaction; no business data changes.

From `artifacts/auto-service-hub`, with Vite running on port 5173 and Edge installed:

- `node --test tests/checkout-activity.test.mjs` — timelines, persistent filters, admin error state and layout at 375/768/1440px. Uses API fixtures, not real payments.
