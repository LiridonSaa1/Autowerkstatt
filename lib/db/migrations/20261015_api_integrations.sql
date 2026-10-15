BEGIN;
CREATE TABLE IF NOT EXISTS public.api_integrations (
  id integer PRIMARY KEY CHECK (id = 1),
  encrypted_config text NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.api_integrations ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.api_integrations FROM PUBLIC, anon, authenticated;
COMMIT;
