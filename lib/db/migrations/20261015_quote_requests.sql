CREATE TABLE IF NOT EXISTS quote_requests (
 id serial PRIMARY KEY, name text NOT NULL, email text NOT NULL, phone text NOT NULL,
 vehicle text NOT NULL, parts text NOT NULL, preferred_date text NOT NULL DEFAULT '',
 status text NOT NULL DEFAULT 'new', sent_at timestamptz, created_at timestamptz NOT NULL DEFAULT now()
);
