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
  const rows: any[] = [];
  let from = 0;
  for (;;) {
    const { data, error } = await sb
      .from('registros_gastos')
      .select('clase,monto_base_usd,monto_orig,moneda,tasa,honorarios,costo_total,porcentaje_admin,descripcion')
      .eq('proyecto_id', PID)
      .range(from, from + 999);
    if (error) throw error;
    rows.push(...(data || []));
    if (!data || data.length < 1000) break;
    from += 1000;
  }

  let ing = 0;
  let gNet = 0;
  let hon = 0;
  let costo = 0;
  for (const r of rows) {
    const c = String(r.clase ?? '').toUpperCase();
    const base = Number(r.monto_base_usd) || 0;
    if (c === 'INGRESO') ing += base;
    else if (c === 'GASTO') {
      gNet += base;
      hon += Number(r.honorarios) || 0;
      costo += Number(r.costo_total) || 0;
    }
  }
  console.log({
    ingresos: Math.round(ing * 100) / 100,
    gastosNetos: Math.round(gNet * 100) / 100,
    honorarios: Math.round(hon * 100) / 100,
    costoTotal: Math.round(costo * 100) / 100,
    totalRows: rows.length
  });
}

main().catch(console.error);