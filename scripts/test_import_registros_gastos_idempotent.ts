/**
 * Prueba idempotencia del import CSV diario → registros_gastos.
 * Sube el mismo CSV dos veces y exige el mismo conteo.
 *
 *   npx tsx scripts/test_import_registros_gastos_idempotent.ts
 *   npx tsx scripts/test_import_registros_gastos_idempotent.ts --csv "ruta/al.csv"
 */
import { createClient } from '@supabase/supabase-js';
import { readFileSync, existsSync } from 'fs';
import { importCsvToRegistrosGastos, parseRegistrosGastosCsv } from '../lib/contabilidad/cco/importCsvToRegistrosGastos';

function loadEnv() {
  for (const p of ['.env.local', '.env']) {
    if (!existsSync(p)) continue;
    for (const line of readFileSync(p, 'utf8').split(/\r?\n/)) {
      const m = line.match(/^([^#=]+)=(.*)$/);
      if (!m) continue;
      const key = m[1].trim();
      if (process.env[key]) continue;
      process.env[key] = m[2].trim().replace(/^["']|["']$/g, '');
    }
  }
}

function sampleCsv(): string {
  return [
    'CLASE,FECHA,PROVEEDOR,TIPO,CAPITULO,SUBCAPITULO,DESCRIPCION,MONEDA,MONTO BASE USD,COSTO TOTAL,HONORARIOS,ESTADO',
    'GASTO,2024-01-10,Proveedor A,MATERIALES,MODULO A,CONCRETO,Concreto 3000 psi,USD,100.5,115.575,15.075,PAGADO',
    'GASTO,2024-01-11,Proveedor B,MATERIALES,MODULO A,ACERO,Cabilla 3/8,USD,200,230,30,PAGADO',
    'INGRESO,2024-01-05,,,,Capital socio,USD,1000,1000,0,PAGADO',
    'GASTO,2024-01-12,Proveedor A,MATERIALES,MODULO B,CEMENTO,Cemento gris,USD,50,57.5,7.5,PAGADO',
  ].join('\n');
}

async function main() {
  loadEnv();
  const args = process.argv.slice(2);
  const csvIdx = args.indexOf('--csv');
  const csvPath = csvIdx >= 0 ? args[csvIdx + 1] : null;
  const csvText = csvPath && existsSync(csvPath) ? readFileSync(csvPath, 'utf8') : sampleCsv();

  const parsed = parseRegistrosGastosCsv(csvText);
  console.log(
    JSON.stringify({
      step: 'parse',
      rows: parsed.rows.length,
      skipped: parsed.skipped,
      source: csvPath ?? 'sample',
    }),
  );
  if (!parsed.rows.length) {
    console.error('FAIL: CSV sin filas');
    process.exit(1);
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    console.log(JSON.stringify({ step: 'skip_live', reason: 'missing supabase env', parseOk: true }));
    process.exit(0);
  }

  const supabase = createClient(url, key, { auth: { persistSession: false } });

  const first = await importCsvToRegistrosGastos(supabase, csvText);
  console.log(JSON.stringify({ step: 'import_1', ...first }));

  const second = await importCsvToRegistrosGastos(supabase, csvText);
  console.log(JSON.stringify({ step: 'import_2', ...second }));

  const { count, error } = await supabase
    .from('registros_gastos')
    .select('id', { count: 'exact', head: true });
  if (error) throw error;

  const expected = parsed.rows.length;
  const ok =
    first.totalEnTabla === expected &&
    second.totalEnTabla === expected &&
    count === expected &&
    first.totalEnTabla === second.totalEnTabla;

  console.log(
    JSON.stringify({
      step: 'assert',
      expected,
      countAfterSecond: count,
      firstTotal: first.totalEnTabla,
      secondTotal: second.totalEnTabla,
      mode1: first.mode,
      mode2: second.mode,
      ok,
    }),
  );

  if (!ok) {
    console.error(
      `FAIL: se esperaban ${expected} filas tras 2 imports; count=${count}, t1=${first.totalEnTabla}, t2=${second.totalEnTabla}`,
    );
    process.exit(1);
  }

  console.log('PASS: mismo CSV dos veces → mismo conteo (sin duplicar).');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
