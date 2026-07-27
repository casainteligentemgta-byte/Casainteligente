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
      .select('clase,monto_base_usd,monto_orig,moneda,tasa,tasa_binance,honorarios,costo_total,porcentaje_admin,descripcion')
      .eq('proyecto_id', PID)
      .range(from, from + 999);
    if (error) throw error;
    rows.push(...(data || []));
    if (!data || data.length < 1000) break;
    from += 1000;
  }

  let total_ingresos_bcv = 0;
  let total_ingresos_reales = 0;
  let gastos_netos_bcv = 0;
  let admin_bcv = 0;
  let costo_total_bcv = 0;

  for (const r of rows) {
    const c = String(r.clase ?? '').toUpperCase();
    const base = Number(r.monto_base_usd) || 0;
    
    if (c === 'INGRESO') {
      total_ingresos_bcv += base;
      
      const moneda = String(r.moneda ?? '').trim().toUpperCase();
      const monto_orig = Number(r.monto_orig) || 0;
      let ingreso_real = monto_orig;
      
      if (moneda !== 'USD' && moneda !== '') {
        const tasa_bin = Number(r.tasa_binance) || 0;
        const tasa = Number(r.tasa) || 0;
        const tasa_real = tasa_bin > 0 ? tasa_bin : tasa;
        if (tasa_real > 0) {
          ingreso_real = monto_orig / tasa_real;
        }
      }
      total_ingresos_reales += ingreso_real;
    } else if (c === 'GASTO') {
      gastos_netos_bcv += base;
      admin_bcv += Number(r.honorarios) || 0;
      costo_total_bcv += Number(r.costo_total) || 0;
    }
  }

  const factor = total_ingresos_bcv > 0 ? total_ingresos_reales / total_ingresos_bcv : 1;
  const devaluacion_pct = (factor - 1.0) * 100.0;

  const gastos_real = gastos_netos_bcv * factor;
  const admin_real = admin_bcv * factor;
  const costo_real = costo_total_bcv * factor;
  const saldo_real = total_ingresos_reales - costo_real;

  const r2 = (n: number) => Math.round(n * 100) / 100;

  console.log({
    ingresos_reales: r2(total_ingresos_reales),
    gastos_reales: r2(gastos_real),
    admin_real: r2(admin_real),
    costo_real: r2(costo_real),
    saldo_real: r2(saldo_real),
    factor,
    devaluacion_pct
  });
}

main().catch(console.error);