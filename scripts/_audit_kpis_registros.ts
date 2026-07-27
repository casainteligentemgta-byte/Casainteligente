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

const r2 = (n: number) => Math.round(n * 100) / 100;

async function main() {
  const rows: Record<string, unknown>[] = [];
  let from = 0;
  for (;;) {
    const { data, error } = await sb
      .from('registros_gastos')
      .select('clase,monto_base_usd,honorarios,costo_total,monto_orig,moneda,tasa,tasa_binance')
      .eq('proyecto_id', PID)
      .range(from, from + 999);
    if (error) throw error;
    rows.push(...((data as Record<string, unknown>[]) || []));
    if (!data || data.length < 1000) break;
    from += 1000;
  }

  let ing = 0;
  let gNet = 0;
  let gHon = 0;
  let gCosto = 0;
  let nIng = 0;
  let nGas = 0;

  for (const r of rows) {
    const c = String(r.clase ?? '').toUpperCase();
    const base = Number(r.monto_base_usd) || 0;
    const hon = Number(r.honorarios) || 0;
    const costo = Number(r.costo_total) || base + hon;
    if (c === 'INGRESO') {
      ing += base || costo;
      nIng++;
    } else if (c === 'GASTO') {
      gNet += base;
      gHon += hon;
      gCosto += costo;
      nGas++;
    }
  }

  const adminFlat = gNet * 0.15;
  console.log(
    JSON.stringify(
      {
        nIng,
        nGas,
        ingresos: r2(ing),
        gastosNetos: r2(gNet),
        adminHonorariosCol: r2(gHon),
        adminFlat15: r2(adminFlat),
        costoHonorariosCol: r2(gNet + gHon),
        costoFlat15: r2(gNet + adminFlat),
        saldoHonCol: r2(ing - (gNet + gHon)),
        saldoFlat15: r2(ing - (gNet + adminFlat)),
        oldExpected: {
          ing: 625265,
          net: 565952.44,
          admin: 84892.87,
          costo: 650845.31,
          saldo: -25580.31,
        },
      },
      null,
      2,
    ),
  );
}

main().catch(console.error);
