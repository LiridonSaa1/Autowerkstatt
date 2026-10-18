BEGIN;
CREATE TABLE IF NOT EXISTS checkout_activity_events (
  id uuid PRIMARY KEY,
  session_id uuid NOT NULL,
  kind text NOT NULL CHECK (kind IN ('visit','vin_search_started','vin_search_succeeded','vin_search_failed','checkout_started','checkout_error','payment_started','payment_failed','payment_confirmed','order_saved')),
  occurred_at timestamptz NOT NULL DEFAULT now(),
  source text NOT NULL CHECK (source IN ('client','server')),
  vin varchar(17), country varchar(2), internal boolean NOT NULL DEFAULT false,
  bot boolean NOT NULL DEFAULT false, code varchar(32), reference varchar(64),
  CHECK (source='server' OR kind NOT IN ('payment_started','payment_failed','payment_confirmed','order_saved')),
  CHECK (source='client' OR reference IS NOT NULL)
);
CREATE INDEX IF NOT EXISTS checkout_activity_date ON checkout_activity_events (occurred_at DESC);
CREATE INDEX IF NOT EXISTS checkout_activity_session ON checkout_activity_events (session_id, occurred_at, id);
CREATE INDEX IF NOT EXISTS checkout_activity_vin ON checkout_activity_events (vin text_pattern_ops);
CREATE UNIQUE INDEX IF NOT EXISTS checkout_activity_fact ON checkout_activity_events (kind, reference) WHERE source='server';
-- No public/Supabase browser policies: analytics is read through the protected API.
ALTER TABLE checkout_activity_events ENABLE ROW LEVEL SECURITY;
COMMIT;
