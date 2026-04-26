import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';

const outputPath = process.env.UOADROP_RUNTIME_CONFIG_OUT
  ? resolve(process.env.UOADROP_RUNTIME_CONFIG_OUT)
  : resolve(process.cwd(), 'resources/runtime-config.json');

const supabaseUrl = String(process.env.VITE_SUPABASE_URL ?? '').trim();
const supabaseAnonKey = String(process.env.VITE_SUPABASE_ANON_KEY ?? '').trim();
const supabaseServiceRoleKey = String(process.env.SUPABASE_SERVICE_ROLE_KEY ?? '').trim();

if (!supabaseUrl || !supabaseAnonKey || !supabaseServiceRoleKey) {
  console.error('Missing one or more required env vars: VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const payload = {
  supabaseUrl,
  supabaseAnonKey,
  supabaseServiceRoleKey,
};

await mkdir(dirname(outputPath), { recursive: true });
await writeFile(outputPath, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
console.log(`[UOADrop] Wrote runtime config to ${outputPath}`);
