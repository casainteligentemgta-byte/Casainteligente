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
const payload = JSON.parse(fs.readFileSync(path.join(root, 'tmp', 'cco_v4_from_csv.json'), 'utf8'));
const csvGastoIds = new Set(
  payload.transacciones.filter((t: any) => String(t.clase).toUpperCase() === 'GASTO').map((t: any) => t.origen_v4_id),
);
const csvIngIds = new Set(
  payload.transacciones.filter((t: any) => String(t.clase).toUpperCase() === 'INGRESO').map((t: any) => t.origen_v4_id),
);

const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
  auth: { persistSession: false },
});

async function all(table: string, sel: string, apply: (q: any) => any) {
  const rows: any[] = [];
  let from = 0;
  for (;;) {
    let q = sb.from(table).select(sel).range(from, from + 999);
    q = apply(q);
    const { data, error } = await q;
    if (error) throw new Error(error.message);
    rows.push(...(data || []));
    if (!data || data.length < 1000) break;
    from += 1000;
  }
  return rows;
}

const r2 = (n: number) => Math.round(n * 100) / 100;

async function main() {
  const compras = await all(
    'contabilidad_compras',
    'id,monto_usd,honorarios_usd,origen_v4_id,invoice_number',
    (q) => q.eq('proyecto_id', PID).eq('origen', 'cco_v4_import'),
  );
  const inCsv = compras.filter((c) => csvGastoIds.has(c.origen_v4_id));
  const orphan = compras.filter((c) => !csvGastoIds.has(c.origen_v4_id));
  console.log({
    csv_gasto_ids: csvGastoIds.size,
    db_v4: compras.length,
    matched_csv: inCsv.length,
    orphan_sqlite_old: orphan.length,
    usd_matched: r2(inCsv.reduce((s, c) => s + Number(c.monto_usd || 0), 0)),
    usd_orphan: r2(orphan.reduce((s, c) => s + Number(c.monto_usd || 0), 0)),
    hon_matched: r2(inCsv.reduce((s, c) => s + Number(c.honorarios_usd || 0), 0)),
  });

  const ings = await all(
    'ci_inyecciones_capital',
    'id,monto_usd,referencia_bancaria,origen_fondo,fecha_ingreso',
    (q) => q.eq('proyecto_id', PID).eq('creado_por', 'cco_v4_import'),
  );
  const byFechaMonto = new Map<string, number>();
  for (const i of ings) {
    const k = `${String(i.fecha_ingreso).slice(0, 10)}|${Number(i.monto_usd).toFixed(2)}`;
    byFechaMonto.set(k, (byFechaMonto.get(k) || 0) + 1);
  }
  const multi = [...byFechaMonto.entries()].filter(([, n]) => n > 1);
  console.log({
    csv_ing_ids: csvIngIds.size,
    db_ings: ings.length,
    usd_ings: r2(ings.reduce((s, i) => s + Number(i.monto_usd || 0), 0)),
    grupos_fecha_monto_duplicados: multi.length,
    max_dup: multi.length ? Math.max(...multi.map(([, n]) => n)) : 0,
  });
  // refs matching CSV pattern V4-<hashid>
  const withCsvRef = ings.filter((i) => {
    const m = String(i.referencia_bancaria || '').match(/^V4-(\d+)$/);
    return m && csvIngIds.has(Number(m[1]));
  });
  console.log({
    ings_ref_en_csv: withCsvRef.length,
    usd_ref_csv: r2(withCsvRef.reduce((s, i) => s + Number(i.monto_usd || 0), 0)),
  });
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
