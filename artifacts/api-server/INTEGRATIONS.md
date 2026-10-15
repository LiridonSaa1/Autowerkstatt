# API integrations

Open Admin > Integrimet API and enter the integrations password (default: `123678`). The server validates it; `INTEGRATIONS_PASSWORD` overrides the default without changing the administrator login password. All endpoints require the existing admin bearer session; read, save and test additionally require a 10-minute unlock token bound to that session. The token remains in memory in the browser. Attempts are limited to five per minute per session.

Credentials are encrypted with AES-256-GCM on the server, under `INTEGRATIONS_DATA_DIR` (default `.local/integrations`, relative to the API working directory). The generated `master.key` and `credentials.enc` must both be retained in a private persistent volume. Keep this directory out of static hosting and backups available to clients. It is ignored by Git. This implementation targets one API instance; multiple instances require shared storage and a shared unlock/rate-limit store.

Supabase URL and keys are returned into inputs only after admin login and the integrations unlock gate; password inputs have show/hide controls. Resend and Twilio secrets remain masked. Leaving secret fields blank preserves the saved value. Tests use saved values and do not send email or SMS.

Supabase configuration is stored as AES-256-GCM ciphertext in `public.api_integrations` in the database configured by `DATABASE_URL`. Apply `lib/db/migrations/20261015_api_integrations.sql` before using the panel. RLS is enabled and public, anon and authenticated grants are revoked. Only the API database connection accesses this table. Other provider credentials stay encrypted in the server file. Retain the existing private `master.key` to decrypt database values after a restart or deployment. Existing server Supabase environment variables populate inputs when no value has been saved. The local legacy encrypted file is read for compatibility.

Resend credentials are used for offers and contact replies. If no Resend key is saved or configured in RESEND_API_KEY, the existing Brevo configuration remains the fallback. RESEND_FROM_EMAIL is the optional environment fallback sender. Use a verified sender domain.

Supabase fields store and test an API connection, including an optional server-only service key. They do not replace the running login project, execute database migrations or replace DATABASE_URL. Existing SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, ADMIN_EMAIL and frontend VITE_SUPABASE_* are needed to bootstrap admin login. Twilio credentials can be stored and checked; automatic SMS workflows are separate.

Validation: `node --test tests/integrations.test.mjs` from artifacts/api-server. Uses fake credentials and mocked external providers; tests password gate, unauthorized access, session binding, masked reads, blank-secret preservation, URL restrictions, encryption at rest, and locking.

Provider references:
- https://resend.com/docs/api-reference/emails/send-email
- https://supabase.com/docs/reference/javascript/auth-signinwithpassword
- https://www.twilio.com/docs/usage/requests-to-twilio
