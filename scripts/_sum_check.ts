process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
import fs from 'fs';
import path from 'path';
import { createClient } from '@supabase/supabase-js';

const root = path.join(__dirname, '..');
for (const line of fs.readFileSync(path.join(root, '.env.local'), 'utf8').split(/\r?\n/)) {
  const m = line.match(/^([^#=]+)=(.*)$/);
  if (!m) continue;
  let v = m[2].trim();
  if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
  if (process.env[m[1].trim()] === undefined) process.env[m[1].trim()] = v;
}

const PID = '171694ed-0ecb-4ec5-82f5-82b980cb261f';
const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
  auth: { persistSession: false },
});

async function main() {
  const { data, error } = await sb
    .from('contabilidad_compras')
    .select('monto_usd.sum(), honorarios_usd.sum(), id.count()')
    .eq('proyecto_id', PID)
    .eq('origen', 'cco_v4_import')
    .single();
  console.log('agg', error?.message, data);

  const { data: ing } = await sb
    .from('ci_inyecciones_capital')
    .select('monto_usd.sum(), id.count()')
    .eq('proyecto_id', PID)
    .eq('creado_por', 'cco_v4_import')
    .single();
  console.log('ing', ing);

  // Compare: sum from JSON payload directly
  const payload = JSON.parse(fs.readFileSync(path.join(root, 'tmp', 'cco_v4_from_csv.json'), 'utf8'));
  let g = 0;
  let h = 0;
  let n = 0;
  for (const t of payload.transacciones) {
    if (String(t.clase).toUpperCase() !== 'GASTO') continue;
    g += Number(t.monto_base_usd) || 0;
    h += Number(t.honorarios) || 0;
    n += 1;
  }
  console.log('json sum', { n, g, h, gRound: Math.round(g * 100) / 100, hRound: Math.round(h * 100) / 100 });
}

main().catch(console.error);
