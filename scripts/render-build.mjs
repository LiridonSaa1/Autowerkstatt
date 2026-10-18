import { spawnSync } from 'node:child_process';

for (const name of ['VITE_SUPABASE_URL', 'VITE_SUPABASE_PUBLISHABLE_KEY']) {
  if (!process.env[name]) throw new Error(`${name} must be configured in Render before building.`);
}
for (const workspace of ['@workspace/api-server', '@workspace/auto-service-hub']) {
  const result = spawnSync(process.platform === 'win32' ? 'pnpm.cmd' : 'pnpm', ['--filter', workspace, 'run', 'build'], {
    stdio: 'inherit',
    shell: process.platform === 'win32',
    env: { ...process.env, BASE_PATH: '/', PORT: process.env.PORT || '10000' },
  });
  if (result.status !== 0) process.exit(result.status || 1);
}
// Additive, idempotent schema migration for checkout analytics. Fail deploy rather
// than publishing a panel whose database table is missing.
const migration = spawnSync(process.execPath, ['scripts/checkout-activity-migrate.mjs'], { stdio: 'inherit', env: process.env });
if (migration.status !== 0) process.exit(migration.status || 1);
