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
  const rows: { monto_usd: number; honorarios_usd: number; origen_v4_id: number }[] = [];
  let from = 0;
  for (;;) {
    const { data, error } = await sb
      .from('contabilidad_compras')
      .select('monto_usd,honorarios_usd,origen_v4_id')
      .eq('proyecto_id', PID)
      .eq('origen', 'cco_v4_import')
      .range(from, from + 999);
    if (error) throw error;
    rows.push(...((data as typeof rows) || []));
    if (!data || data.length < 1000) break;
    from += 1000;
  }

  let g = 0;
  let h = 0;
  for (const r of rows) {
    g += Number(r.monto_usd);
    h += Number(r.honorarios_usd);
  }
  console.log({
    n: rows.length,
    g,
    h,
    gMathRound: Math.round(g * 100) / 100,
    hMathRound: Math.round(h * 100) / 100,
  });

  // Diff vs JSON per id
  const payload = JSON.parse(fs.readFileSync(path.join(root, 'tmp', 'cco_v4_from_csv.json'), 'utf8'));
  const byId = new Map<number, number>();
  for (const t of payload.transacciones) {
    if (String(t.clase).toUpperCase() !== 'GASTO') continue;
    byId.set(Number(t.origen_v4_id), Number(t.monto_base_usd) || 0);
  }
  let drift = 0;
  let nDiff = 0;
  for (const r of rows) {
    const want = byId.get(Number(r.origen_v4_id));
    if (want == null) continue;
    const d = Number(r.monto_usd) - want;
    if (Math.abs(d) > 1e-9) {
      nDiff += 1;
      drift += d;
    }
  }
  console.log({ rows_con_drift: nDiff, drift_total: drift });
}

main().catch(console.error);
