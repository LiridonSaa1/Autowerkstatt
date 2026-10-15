import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';
import { mkdir, readFile, writeFile, rename } from 'node:fs/promises';
import path from 'node:path';
import { pool } from '@workspace/db';
export type IntegrationConfig = { resendKey: string; resendFrom: string; supabaseUrl: string; supabaseKey: string; supabaseServiceKey: string; twilioSid: string; twilioToken: string; twilioFrom: string };
const defaults: IntegrationConfig = { resendKey: '', resendFrom: '', supabaseUrl: '', supabaseKey: '', supabaseServiceKey: '', twilioSid: '', twilioToken: '', twilioFrom: '' };
const directory = path.resolve(process.env.INTEGRATIONS_DATA_DIR || '.local/integrations');
async function key() {
  await mkdir(directory, { recursive: true, mode: 0o700 });
  const file = path.join(directory, 'master.key');
  try { return await readFile(file); } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
    try { await writeFile(file, randomBytes(32), { flag: 'wx', mode: 0o600 }); } catch (e) { if ((e as NodeJS.ErrnoException).code !== 'EEXIST') throw e; }
    return readFile(file);
  }
}
export async function readIntegrations(): Promise<IntegrationConfig> {
  const fallback = { ...defaults, supabaseUrl: process.env.SUPABASE_URL || '', supabaseKey: process.env.SUPABASE_PUBLISHABLE_KEY || '', supabaseServiceKey: process.env.SUPABASE_SERVICE_ROLE_KEY || '' };
  let local: Partial<IntegrationConfig> = {};
  try { local = await decrypt(await readFile(path.join(directory, 'credentials.enc'))); } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
  }
  const result = await pool.query<{ encrypted_config: string }>('SELECT encrypted_config FROM public.api_integrations WHERE id = 1');
  const remote = result.rows[0] ? await decrypt(Buffer.from(result.rows[0].encrypted_config, 'base64')) : {};
  return { ...fallback, ...local, supabaseUrl: remote.supabaseUrl || local.supabaseUrl || fallback.supabaseUrl, supabaseKey: remote.supabaseKey || local.supabaseKey || fallback.supabaseKey, supabaseServiceKey: remote.supabaseServiceKey || local.supabaseServiceKey || fallback.supabaseServiceKey };
}
async function decrypt(data: Buffer): Promise<Partial<IntegrationConfig>> {
  const decipher = createDecipheriv('aes-256-gcm', await key(), data.subarray(0, 12));
  decipher.setAuthTag(data.subarray(12, 28));
  return JSON.parse(Buffer.concat([decipher.update(data.subarray(28)), decipher.final()]).toString('utf8'));
}
async function encrypt(config: object) {
  const iv = randomBytes(12); const cipher = createCipheriv('aes-256-gcm', await key(), iv);
  const encrypted = Buffer.concat([cipher.update(JSON.stringify(config), 'utf8'), cipher.final()]);
  return Buffer.concat([iv, cipher.getAuthTag(), encrypted]);
}
export async function saveSupabaseConfig(config: Pick<IntegrationConfig, 'supabaseUrl' | 'supabaseKey' | 'supabaseServiceKey'>) {
  // Explicit allowlist: no other provider credentials are transferred.
  const payload = (await encrypt({ supabaseUrl: config.supabaseUrl, supabaseKey: config.supabaseKey, supabaseServiceKey: config.supabaseServiceKey })).toString('base64');
  await pool.query('INSERT INTO public.api_integrations (id, encrypted_config) VALUES (1, $1) ON CONFLICT (id) DO UPDATE SET encrypted_config = EXCLUDED.encrypted_config, updated_at = now()', [payload]);
}
export async function saveIntegrations(config: IntegrationConfig) {
  await saveSupabaseConfig(config);
  const { supabaseUrl, supabaseKey, supabaseServiceKey, ...local } = config;
  const temporary = path.join(directory, `${randomBytes(12).toString('hex')}.tmp`);
  await writeFile(temporary, await encrypt(local), { mode: 0o600 });
  await rename(temporary, path.join(directory, 'credentials.enc'));
}
export async function resendConfig() {
  const saved = await readIntegrations();
  return { key: saved.resendKey || process.env.RESEND_API_KEY || '', from: saved.resendFrom || process.env.RESEND_FROM_EMAIL || '' };
}
