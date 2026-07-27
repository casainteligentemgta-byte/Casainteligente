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

const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
  auth: { persistSession: false },
});
const PID = '171694ed-0ecb-4ec5-82f5-82b980cb261f';

async function main() {
  const { data, error } = await sb
    .from('registros_gastos')
    .select('id,descripcion,monto_base_usd,monto_orig,moneda,tasa,costo_total,honorarios,fecha')
    .eq('proyecto_id', PID)
    .eq('clase', 'INGRESO')
    .order('fecha', { ascending: true });
  if (error) throw error;

  const rows = data || [];
  let sumBase = 0;
  let sumCosto = 0;
  const suspicious: typeof rows = [];
  for (const r of rows) {
    const base = Number(r.monto_base_usd) || 0;
    const costo = Number(r.costo_total) || 0;
    sumBase += base;
    sumCosto += costo;
    if (Math.abs(base - costo) > 0.01 || base > 100000 || costo > 100000) {
      suspicious.push(r);
    }
  }
  console.log('count', rows.length, 'sumBase', sumBase, 'sumCosto', sumCosto);
  console.log('last5', rows.slice(-5).map((r) => ({ d: r.descripcion?.slice(0, 40), b: r.monto_base_usd, c: r.costo_total })));
  console.log('suspicious', suspicious.length);
  for (const r of suspicious.slice(0, 10)) {
    console.log({ d: r.descripcion, b: r.monto_base_usd, c: r.costo_total, hon: r.honorarios });
  }
}

main().catch(console.error);
