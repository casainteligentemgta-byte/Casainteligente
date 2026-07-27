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
    'origen,monto_usd,origen_v4_id,invoice_number,honorarios_usd',
    (q) => q.eq('proyecto_id', PID),
  );
  const byOrigen: Record<string, { n: number; usd: number }> = {};
  for (const c of compras) {
    const o = String(c.origen || '(null)');
    byOrigen[o] = byOrigen[o] || { n: 0, usd: 0 };
    byOrigen[o].n += 1;
    byOrigen[o].usd += Number(c.monto_usd || 0);
  }
  console.log(
    'compras by origen',
    Object.fromEntries(Object.entries(byOrigen).map(([k, v]) => [k, { n: v.n, usd: r2(v.usd) }])),
  );

  const v4 = compras.filter((c) => c.origen === 'cco_v4_import');
  const ids = v4.map((c) => c.origen_v4_id).filter((x) => x != null);
  console.log({
    v4_rows: v4.length,
    with_id: ids.length,
    unique_ids: new Set(ids).size,
    v4_usd: r2(v4.reduce((s, c) => s + Number(c.monto_usd || 0), 0)),
    v4_hon: r2(v4.reduce((s, c) => s + Number(c.honorarios_usd || 0), 0)),
  });

  // duplicates by origen_v4_id
  const map = new Map<number, number>();
  for (const id of ids) map.set(Number(id), (map.get(Number(id)) || 0) + 1);
  const dups = [...map.entries()].filter(([, n]) => n > 1).slice(0, 10);
  console.log('dup origen_v4_id sample', dups);

  const ings = await all(
    'ci_inyecciones_capital',
    'monto_usd,creado_por,origen_fondo,banco_origen,referencia_bancaria,fecha_ingreso',
    (q) => q.eq('proyecto_id', PID),
  );
  const groups: Record<string, { n: number; usd: number }> = {};
  for (const i of ings) {
    const por = String(i.creado_por || '');
    const fondo = String(i.origen_fondo || '');
    const banco = String(i.banco_origen || '');
    let g = 'other';
    if (por === 'cco_v4_import') g = 'creado_por=cco_v4_import';
    else if (/^CCO-V4\b/i.test(fondo)) g = 'origen_fondo^CCO-V4';
    else if (banco === 'CCO-V4') g = 'banco=CCO-V4';
    groups[g] = groups[g] || { n: 0, usd: 0 };
    groups[g].n += 1;
    groups[g].usd += Number(i.monto_usd || 0);
  }
  console.log(
    'ingresos groups',
    Object.fromEntries(Object.entries(groups).map(([k, v]) => [k, { n: v.n, usd: r2(v.usd) }])),
  );

  const only = ings.filter((i) => String(i.creado_por || '') === 'cco_v4_import');
  console.log('solo creado_por', only.length, r2(only.reduce((s, i) => s + Number(i.monto_usd || 0), 0)));

  // Simulate dashboard filter (no HISTORICO)
  const dashCompras = compras.filter((c) => String(c.origen || '') !== 'HISTORICO_TABLA');
  const dashUsd = r2(dashCompras.reduce((s, c) => s + Number(c.monto_usd || 0), 0));
  console.log('dashboard-like compras (no HISTORICO)', dashCompras.length, dashUsd);

  const dashIng = ings.filter((i) => {
    const por = String(i.creado_por || '');
    const fondo = String(i.origen_fondo || '');
    const banco = String(i.banco_origen || '');
    return por === 'cco_v4_import' || /^CCO-V4\b/i.test(fondo) || banco === 'CCO-V4';
  });
  console.log(
    'dashboard-like ingresos V4',
    dashIng.length,
    r2(dashIng.reduce((s, i) => s + Number(i.monto_usd || 0), 0)),
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
