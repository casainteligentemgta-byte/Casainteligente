/** Backfill vínculos Flamboyant. npx tsx scripts/backfill_vinculos_flamboyant.ts */
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
process.env.SUPABASE_DEV_INSECURE_TLS = '1';

import fs from 'fs';
import path from 'path';
import { createClient } from '@supabase/supabase-js';
import { backfillVinculosContratos } from '../lib/contabilidad/cco/backfillVinculos';

const PROYECTO_ID = '171694ed-0ecb-4ec5-82f5-82b980cb261f';
const root = path.join(__dirname, '..');

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
  const sb = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } },
  );
  const dry = await backfillVinculosContratos(sb, PROYECTO_ID, { umbral: 40, dryRun: true });
  console.log('DRY RUN', { revisados: dry.revisados, vinculados: dry.vinculados, sinMatch: dry.sinMatch });
  console.log('sample', dry.detalle.slice(0, 8));
  const real = await backfillVinculosContratos(sb, PROYECTO_ID, { umbral: 40, dryRun: false });
  console.log('APPLIED', real);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
