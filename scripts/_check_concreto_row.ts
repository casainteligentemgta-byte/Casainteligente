process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
import fs from 'fs';
import path from 'path';
import { createClient } from '@supabase/supabase-js';
import { mapCsvRowToRegistrosGastos, parseRegistrosGastosCsv } from '../lib/contabilidad/cco/importCsvToRegistrosGastos';

const root = path.join(__dirname, '..');
for (const line of fs.readFileSync(path.join(root, '.env.local'), 'utf8').split(/\r?\n/)) {
  const m = line.match(/^([^#=]+)=(.*)$/);
  if (!m) continue;
  let v = m[2].trim();
  if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
  if (process.env[m[1].trim()] === undefined) process.env[m[1].trim()] = v;
}

const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
  auth: { persistSession: false },
});

async function main() {
  const { data } = await sb
    .from('registros_gastos')
    .select('descripcion,monto_base_usd,honorarios,costo_total,porcentaje_admin')
    .eq('proyecto_id', '171694ed-0ecb-4ec5-82f5-82b980cb261f')
    .ilike('descripcion', '%CONCRETO ABONO%')
    .limit(2);

  const csv = fs.readFileSync(path.join(root, 'tmp', 'RANCHO_20072026.csv'), 'utf8');
  const { rows } = parseRegistrosGastosCsv(csv, 'x');
  const parsed = rows.find((r) => String(r.descripcion).includes('CONCRETO ABONO'));

  console.log(JSON.stringify({ db: data, parsed }, null, 2));
}

main().catch(console.error);
