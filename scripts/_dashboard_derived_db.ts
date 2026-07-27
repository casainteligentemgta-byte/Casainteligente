process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
import fs from 'fs';
import path from 'path';
import { createClient } from '@supabase/supabase-js';
import { applyDerivedCsvMontos } from '../lib/contabilidad/cco/parseCsvMaestro';

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
  const rows: Record<string, unknown>[] = [];
  let from = 0;
  for (;;) {
    const { data, error } = await sb
      .from('registros_gastos')
      .select('clase,monto_base_usd,monto_orig,moneda,tasa,honorarios,costo_total,porcentaje_admin,descripcion')
      .eq('proyecto_id', '171694ed-0ecb-4ec5-82f5-82b980cb261f')
      .range(from, from + 999);
    if (error) throw error;
    rows.push(...((data as Record<string, unknown>[]) || []));
    if (!data || data.length < 1000) break;
    from += 1000;
  }

  let ingStored = 0;
  let ingDerived = 0;
  let honStored = 0;
  let honDerived = 0;
  let nIng = 0;
  for (const r of rows) {
    const clase = String(r.clase).toUpperCase();
    const d = applyDerivedCsvMontos(r as Parameters<typeof applyDerivedCsvMontos>[0], 15);
    if (clase === 'INGRESO') {
      nIng++;
      ingStored += Number(r.monto_base_usd) || 0;
      ingDerived += Number(d.monto_base_usd) || 0;
    } else if (clase === 'GASTO') {
      honStored += Number(r.honorarios) || 0;
      honDerived += Number(d.honorarios) || 0;
    }
  }
  const r2 = (n: number) => Math.round(n * 100) / 100;
  console.log({
    nIng,
    ingStored: r2(ingStored),
    ingDerived: r2(ingDerived),
    honStored: r2(honStored),
    honDerived: r2(honDerived),
  });
}

main().catch(console.error);
