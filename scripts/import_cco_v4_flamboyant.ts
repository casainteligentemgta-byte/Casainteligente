/**
 * Import one-shot CCO V4 → RANCHO FLAMBOYANT
 * npx tsx scripts/import_cco_v4_flamboyant.ts
 */
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
process.env.SUPABASE_DEV_INSECURE_TLS = '1';

import fs from 'fs';
import path from 'path';
import { createClient } from '@supabase/supabase-js';
import { importarMaestroV4 } from '../lib/contabilidad/cco/importarMaestroV4';

const PROYECTO_ID = '171694ed-0ecb-4ec5-82f5-82b980cb261f';
const root = path.join(__dirname, '..');
const JSON_PATH = path.join(root, 'tmp', 'cco_v4_import.json');

for (const line of fs.readFileSync(path.join(root, '.env.local'), 'utf8').split(/\r?\n/)) {
  const m = line.match(/^([^#=]+)=(.*)$/);
  if (!m) continue;
  let v = m[2].trim();
  if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
    v = v.slice(1, -1);
  }
  if (process.env[m[1].trim()] === undefined) process.env[m[1].trim()] = v;
}

async function main() {
  console.log('Cargando', JSON_PATH);
  const payload = JSON.parse(fs.readFileSync(JSON_PATH, 'utf8'));
  payload.proyecto_id = PROYECTO_ID;
  payload.obra_alias = 'RANCHO FLAMBOYANT';
  payload.honorarios_admin_pct = Number(payload.honorarios_admin_pct) || 15;
  payload.auto_vincular = true;
  fs.writeFileSync(JSON_PATH, JSON.stringify(payload));

  const sb = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } },
  );

  console.log('Import →', PROYECTO_ID, 'txs', payload.transacciones?.length);
  const t0 = Date.now();
  const result = await importarMaestroV4(sb, payload);
  console.log('ms', Date.now() - t0);
  console.log(JSON.stringify(result, null, 2));
  if (result.errores?.length) {
    console.log('--- primeros errores ---');
    for (const e of result.errores.slice(0, 20)) console.log(e);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
