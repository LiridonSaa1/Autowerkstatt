import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';
import { mkdir, readFile, writeFile, rename } from 'node:fs/promises';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { pool } from '@workspace/db';
export type IntegrationConfig = { brevoKey: string; brevoFrom: string; supabaseUrl: string; supabaseKey: string; supabaseServiceKey: string; twilioSid: string; twilioToken: string; twilioFrom: string };
const defaults: IntegrationConfig = { brevoKey: '', brevoFrom: '', supabaseUrl: '', supabaseKey: '', supabaseServiceKey: '', twilioSid: '', twilioToken: '', twilioFrom: '' };
function serverDirectory() {
  // Both src/lib/integrations.ts and dist/index.mjs belong to this package.
  // The working directory can differ between desktop and package-script launches.
  let current = path.dirname(fileURLToPath(import.meta.url));
  while (true) {
    try {
      if (JSON.parse(readFileSync(path.join(current, 'package.json'), 'utf8')).name === '@workspace/api-server') return current;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
    }
    const parent = path.dirname(current);
    if (parent === current) throw new Error('Das API-Verzeichnis konnte nicht ermittelt werden. Setzen Sie INTEGRATIONS_DATA_DIR.');
    current = parent;
  }
}
const serverRoot = process.env.INTEGRATIONS_DATA_DIR ? null : serverDirectory();
const directory = process.env.INTEGRATIONS_DATA_DIR
  ? path.resolve(process.env.INTEGRATIONS_DATA_DIR)
  : path.join(serverRoot!, '.local/integrations');
// Read existing workspace-root credentials as well, without moving or replacing them.
const readDirectories = [...new Set([directory, ...(serverRoot ? [path.resolve(serverRoot, '../..', '.local/integrations')] : [])])];

export class IntegrationDecryptionError extends Error {
  constructor() {
    super('Die gespeicherten API-Zugangsdaten konnten nicht entschlüsselt werden. Stellen Sie die ursprüngliche master.key im Integrationsverzeichnis wieder her. Vorhandene Zugangsdaten wurden nicht verändert.');
    this.name = 'IntegrationDecryptionError';
  }
}
async function key() {
  await mkdir(directory, { recursive: true, mode: 0o700 });
  const file = path.join(directory, 'master.key');
  try {
    const value = await readFile(file);
    if (value.length !== 32) throw new IntegrationDecryptionError();
    return value;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
    try { await writeFile(file, randomBytes(32), { flag: 'wx', mode: 0o600 }); } catch (e) { if ((e as NodeJS.ErrnoException).code !== 'EEXIST') throw e; }
    return readFile(file);
  }
}
export async function readIntegrations(): Promise<IntegrationConfig> {
  const fallback = { ...defaults, brevoKey: process.env.BREVO_API_KEY || '', brevoFrom: process.env.BREVO_SENDER_EMAIL || '', supabaseUrl: process.env.SUPABASE_URL || '', supabaseKey: process.env.SUPABASE_PUBLISHABLE_KEY || '', supabaseServiceKey: process.env.SUPABASE_SERVICE_ROLE_KEY || '' };
  let local: Partial<IntegrationConfig> = {};
  for (const location of readDirectories) {
    let data: Buffer;
    try { data = await readFile(path.join(location, 'credentials.enc')); } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
      continue;
    }
    try {
      local = await decrypt(data);
      break;
    } catch {
      // Ignore stale local credentials if key changed
    }
  }
  let remote: Partial<IntegrationConfig> = {};
  try {
    const result = await pool.query<{ encrypted_config: string }>('SELECT encrypted_config FROM public.api_integrations WHERE id = 1');
    if (result.rows[0]?.encrypted_config) {
      remote = await decrypt(Buffer.from(result.rows[0].encrypted_config, 'base64'));
    }
  } catch {
    // Ignore stale remote credentials if key changed
  }
  // Ignore legacy provider fields: an old Resend key is never a Brevo key.
  const currentLocal = Object.fromEntries(Object.keys(defaults).filter(field => typeof local[field as keyof IntegrationConfig] === 'string').map(field => [field, local[field as keyof IntegrationConfig]]));
  return { ...fallback, ...currentLocal, supabaseUrl: remote.supabaseUrl || local.supabaseUrl || fallback.supabaseUrl, supabaseKey: remote.supabaseKey || local.supabaseKey || fallback.supabaseKey, supabaseServiceKey: remote.supabaseServiceKey || local.supabaseServiceKey || fallback.supabaseServiceKey };
}
async function decrypt(data: Buffer): Promise<Partial<IntegrationConfig>> {
  if (data.length < 29) throw new IntegrationDecryptionError();
  for (const location of readDirectories) {
    let candidate: Buffer;
    try { candidate = await readFile(path.join(location, 'master.key')); } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
      continue;
    }
    if (candidate.length !== 32) continue;
    try {
      const decipher = createDecipheriv('aes-256-gcm', candidate, data.subarray(0, 12));
      decipher.setAuthTag(data.subarray(12, 28));
      const config = JSON.parse(Buffer.concat([decipher.update(data.subarray(28)), decipher.final()]).toString('utf8'));
      if (!config || typeof config !== 'object' || Array.isArray(config) || Object.values(config).some(value => typeof value !== 'string')) continue;
      return config;
    } catch {
      // Only an authenticated payload is accepted. Never create a key on reads.
    }
  }
  throw new IntegrationDecryptionError();
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
export async function brevoConfig() {
  const saved = await readIntegrations();
  return { key: saved.brevoKey || process.env.BREVO_API_KEY || '', from: saved.brevoFrom || process.env.BREVO_SENDER_EMAIL || '' };
}
