# Render deployment

The root `render.yaml` deploys the frontend and API together as one free Node web service.

1. Push the current changes to GitHub. Render cannot deploy changes that exist only locally.
2. Choose **New → Blueprint** in Render and select `LiridonSaa1/Service-Car`.
3. Enter the environment values requested by the Blueprint privately. Never commit `.env` files.
4. `DATABASE_URL` must point to a hosted PostgreSQL database, not a database reachable only on your computer.
5. Configure the `VITE_SUPABASE_*` values before building, the corresponding server `SUPABASE_*` values, and `ADMIN_EMAIL`.
6. Add the final onrender.com address to the Supabase authentication Site URL and allowed redirect URLs.

Build: `corepack enable && pnpm install --frozen-lockfile && node scripts/render-build.mjs`

Start: `node --enable-source-maps artifacts/api-server/dist/index.mjs`

Health endpoint: `/api/healthz`

Free Render services sleep when idle and have ephemeral filesystems. Local portfolio uploads and locally encrypted integration credentials do not survive redeploys. Configure integrations with server environment variables on the free plan. Database settings, services and appointments remain in the configured PostgreSQL database.

Optional integration variables: `BREVO_API_KEY`, `BREVO_SENDER_EMAIL`, `SUPABASE_SERVICE_ROLE_KEY`, `OPENAI_API_KEY`.
