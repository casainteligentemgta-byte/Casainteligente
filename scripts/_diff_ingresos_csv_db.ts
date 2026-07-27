import fs from 'fs';
import path from 'path';
import { parseRegistrosGastosCsv } from '../lib/contabilidad/cco/importCsvToRegistrosGastos';

process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
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
  const csvPath = path.join(root, 'tmp', 'RANCHO_20072026.csv');
  const { rows: csvRows } = parseRegistrosGastosCsv(fs.readFileSync(csvPath, 'utf8'), PID);
  const csvIng = csvRows
    .filter((r) => String(r.clase).toUpperCase() === 'INGRESO')
    .map((r) => ({
      desc: String(r.descripcion ?? ''),
      base: Number(r.monto_base_usd) || 0,
      fecha: String(r.fecha ?? '').slice(0, 10),
    }));

  const dbRows: Record<string, unknown>[] = [];
  let from = 0;
  for (;;) {
    const { data, error } = await sb
      .from('registros_gastos')
      .select('descripcion,monto_base_usd,fecha,clase')
      .eq('proyecto_id', PID)
      .eq('clase', 'INGRESO')
      .range(from, from + 999);
    if (error) throw error;
    dbRows.push(...((data as Record<string, unknown>[]) || []));
    if (!data || data.length < 1000) break;
    from += 1000;
  }

  const csvSet = new Set(csvIng.map((r) => `${r.fecha}|${r.desc}|${r.base}`));
  const dbSet = new Set(
    dbRows.map((r) => {
      const fecha = String(r.fecha ?? '').slice(0, 10);
      return `${fecha}|${String(r.descripcion ?? '')}|${Number(r.monto_base_usd) || 0}`;
    }),
  );

  const onlyDb = dbRows
    .map((r) => ({
      fecha: String(r.fecha ?? '').slice(0, 10),
      desc: String(r.descripcion ?? ''),
      base: Number(r.monto_base_usd) || 0,
    }))
    .filter((r) => !csvSet.has(`${r.fecha}|${r.desc}|${r.base}`));

  const onlyCsv = csvIng.filter((r) => !dbSet.has(`${r.fecha}|${r.desc}|${r.base}`));

  console.log(
    JSON.stringify(
      {
        csvIngCount: csvIng.length,
        dbIngCount: dbRows.length,
        csvSum: csvIng.reduce((s, r) => s + r.base, 0),
        dbSum: dbRows.reduce((s, r) => s + (Number(r.monto_base_usd) || 0), 0),
        onlyInDb: onlyDb,
        onlyInCsv: onlyCsv.slice(0, 10),
      },
      null,
      2,
    ),
  );
}

main().catch(console.error);
