/**
 * Prueba idempotencia del import CSV diario → registros_gastos (por obra).
 * Sube el mismo CSV dos veces y exige el mismo conteo de esa obra.
 *
 *   npx tsx scripts/test_import_registros_gastos_idempotent.ts
 *   npx tsx scripts/test_import_registros_gastos_idempotent.ts --csv "ruta/al.csv"
 *   npx tsx scripts/test_import_registros_gastos_idempotent.ts --proyecto UUID
 */
import { createClient } from '@supabase/supabase-js';
import { readFileSync, existsSync } from 'fs';
import {
  importCsvToRegistrosGastos,
  parseRegistrosGastosCsv,
} from '../lib/contabilidad/cco/importCsvToRegistrosGastos';
import {
  buildCsvMaestro,
  formatFechaCsvExport,
} from '../lib/contabilidad/cco/exportCsvMaestro';
import { CSV_MAESTRO_COLUMNS } from '../lib/contabilidad/cco/csvMaestroColumns';
import { mapRowToGastoRegistro } from '../lib/contabilidad/cco/registrosGastos';

const FLAMBOYANT = '171694ed-0ecb-4ec5-82f5-82b980cb261f';

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
    'CLASE,FECHA,PROVEEDOR,TIPO,CAPITULO,SUBCAPITULO,DESCRIPCION,CONTRATO_VINCULADO,MONEDA,TASA,MONTO ORIG,MONTO BASE USD,MONTO PAGADO,FORMA PAGO,LINK FACTURA,LINK COMPROBANTE,ESTADO,HONORARIOS,COSTO TOTAL,% ADMIN,TASA BINANCE,TASA USADA,% BRECHA REAL,POOL_ASIGNADO,AVANCE_FISICO',
    'GASTO,2024-01-10 00:00:00.000000,Proveedor A,MATERIALES,MODULO A,CONCRETO,Concreto 3000 psi,,USD,1.0,100.5,100.5,100.5,TRANSFERENCIA BANCARIA,,,PAGADO,15.075,115.575,15.0,0.0,BCV,0.0,0.0,0.0',
    'GASTO,2024-01-11 00:00:00.000000,Proveedor B,MATERIALES,MODULO A,ACERO,Cabilla 3/8,,USD,1.0,200.0,200.0,200.0,TRANSFERENCIA BANCARIA,,,PAGADO,30.0,230.0,15.0,0.0,BCV,0.0,0.0,0.0',
    'INGRESO,2024-01-05 00:00:00.000000,Capital,,,,Abono 1,,USD,1.0,1000.0,1000.0,1000.0,TRANSFERENCIA BANCARIA,,,PAGADO,0.0,1000.0,0.0,0.0,BCV,0.0,0.0,0.0',
    'PRESUPUESTO_METADATA,2024-01-01 00:00:00.000000,SISTEMA,PRESUPUESTO,MODULO A,,PRESUPUESTO ESTIMADO,,USD,1.0,50000.0,50000.0,0.0,,,,PAGADO,0.0,50000.0,0.0,1.0,BCV,,0.0,400.0',
  ].join('\n');
}

async function main() {
  loadEnv();
  const args = process.argv.slice(2);
  const csvIdx = args.indexOf('--csv');
  const csvPath = csvIdx >= 0 ? args[csvIdx + 1] : null;
  const projIdx = args.indexOf('--proyecto');
  const proyectoId = (projIdx >= 0 ? args[projIdx + 1] : null) || FLAMBOYANT;
  const csvText = csvPath && existsSync(csvPath) ? readFileSync(csvPath, 'utf8') : sampleCsv();

  const parsed = parseRegistrosGastosCsv(csvText, proyectoId);
  console.log(
    JSON.stringify({
      step: 'parse',
      rows: parsed.rows.length,
      skipped: parsed.skipped,
      source: csvPath ?? 'sample',
      proyectoId,
      columnsOk: CSV_MAESTRO_COLUMNS.length === 25,
    }),
  );
  if (!parsed.rows.length) {
    console.error('FAIL: CSV sin filas');
    process.exit(1);
  }

  // Round-trip en memoria: parse → GastoRegistro → CSV → 25 cols header
  const asRegistros = parsed.rows.map((r, i) =>
    mapRowToGastoRegistro({ ...r, id: i + 1 }),
  );
  const exported = buildCsvMaestro(asRegistros);
  const header = exported.split(/\r?\n/)[0];
  const headerOk = header === CSV_MAESTRO_COLUMNS.join(',');
  const fechaSample = formatFechaCsvExport(asRegistros[0]?.fecha);
  console.log(
    JSON.stringify({
      step: 'export_roundtrip_memory',
      headerOk,
      fechaSample,
      exportLines: exported.trim().split(/\r?\n/).length,
    }),
  );
  if (!headerOk) {
    console.error('FAIL: header CSV no coincide con las 25 columnas Streamlit');
    process.exit(1);
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    console.log(
      JSON.stringify({ step: 'skip_live', reason: 'missing supabase env', parseOk: true, headerOk }),
    );
    process.exit(0);
  }

  const supabase = createClient(url, key, { auth: { persistSession: false } });

  const first = await importCsvToRegistrosGastos(supabase, csvText, { proyectoId });
  console.log(JSON.stringify({ step: 'import_1', ...first }));

  const second = await importCsvToRegistrosGastos(supabase, csvText, { proyectoId });
  console.log(JSON.stringify({ step: 'import_2', ...second }));

  const { count, error } = await supabase
    .from('registros_gastos')
    .select('id', { count: 'exact', head: true })
    .eq('proyecto_id', proyectoId);
  if (error) throw error;

  const expected = parsed.rows.length;
  const ok =
    first.totalEnTabla === expected &&
    second.totalEnTabla === expected &&
    count === expected &&
    first.inserted === second.inserted;

  console.log(
    JSON.stringify({
      step: 'verify',
      ok,
      expected,
      count,
      first: first.totalEnTabla,
      second: second.totalEnTabla,
      mode: first.mode,
    }),
  );

  if (!ok) {
    console.error('FAIL: import no es idempotente por obra');
    process.exit(1);
  }
  console.log('PASS');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
