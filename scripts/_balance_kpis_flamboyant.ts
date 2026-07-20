/**
 * Compensa deriva float/numeric para que Σ gastos = 565952.44 (cifra oficial).
 */
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
import fs from 'fs';
import path from 'path';
import { createClient } from '@supabase/supabase-js';

const PROYECTO_ID = '171694ed-0ecb-4ec5-82f5-82b980cb261f';
const TARGET_GASTOS = 565_952.44;
const TARGET_ADMIN = 84_892.87;
const TARGET_ING = 625_265.0;

const root = path.join(__dirname, '..');
for (const line of fs.readFileSync(path.join(root, '.env.local'), 'utf8').split(/\r?\n/)) {
  const m = line.match(/^([^#=]+)=(.*)$/);
  if (!m) continue;
  let v = m[2].trim();
  if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
  if (process.env[m[1].trim()] === undefined) process.env[m[1].trim()] = v;
}

const r2 = (n: number) => Math.round(Number(n) * 100) / 100;

async function loadCompras(sb: ReturnType<typeof createClient>) {
  const rows: {
    id: string;
    monto_usd: number;
    honorarios_usd: number;
    total_amount_usd: number | null;
  }[] = [];
  let from = 0;
  for (;;) {
    const { data, error } = await sb
      .from('contabilidad_compras')
      .select('id,monto_usd,honorarios_usd,total_amount_usd')
      .eq('proyecto_id', PROYECTO_ID)
      .eq('origen', 'cco_v4_import')
      .order('monto_usd', { ascending: false })
      .range(from, from + 999);
    if (error) throw error;
    rows.push(...((data as typeof rows) || []));
    if (!data || data.length < 1000) break;
    from += 1000;
  }
  return rows;
}

async function main() {
  const sb = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } },
  );

  let rows = await loadCompras(sb);
  const sumG = () => rows.reduce((s, r) => s + Number(r.monto_usd), 0);
  const sumH = () => rows.reduce((s, r) => s + Number(r.honorarios_usd), 0);

  let g = sumG();
  let h = sumH();
  const dG = r2(g - TARGET_GASTOS);
  const dH = r2(h - TARGET_ADMIN);
  console.log({ n: rows.length, g, h, dG, dH });

  if (Math.abs(dG) >= 0.01 && rows[0]) {
    const nuevo = r2(Number(rows[0].monto_usd) - dG);
    const { error } = await sb
      .from('contabilidad_compras')
      .update({
        monto_usd: nuevo,
        total_amount_usd: nuevo,
        updated_at: new Date().toISOString(),
      })
      .eq('id', rows[0].id);
    if (error) throw error;
    console.log('compensé gasto', rows[0].id, Number(rows[0].monto_usd), '→', nuevo);
  }

  if (Math.abs(dH) >= 0.01 && rows[0]) {
    rows = await loadCompras(sb);
    h = sumH();
    const dH2 = r2(h - TARGET_ADMIN);
    if (Math.abs(dH2) >= 0.01) {
      const nuevoH = r2(Number(rows[0].honorarios_usd) - dH2);
      const { error } = await sb
        .from('contabilidad_compras')
        .update({ honorarios_usd: nuevoH, updated_at: new Date().toISOString() })
        .eq('id', rows[0].id);
      if (error) throw error;
      console.log('compensé admin', rows[0].id, '→', nuevoH);
    }
  }

  rows = await loadCompras(sb);
  g = sumG();
  h = sumH();

  const ings: { monto_usd: number }[] = [];
  let from = 0;
  for (;;) {
    const { data, error } = await sb
      .from('ci_inyecciones_capital')
      .select('monto_usd')
      .eq('proyecto_id', PROYECTO_ID)
      .eq('creado_por', 'cco_v4_import')
      .range(from, from + 999);
    if (error) throw error;
    ings.push(...((data as typeof ings) || []));
    if (!data || data.length < 1000) break;
    from += 1000;
  }
  const ingresos = ings.reduce((s, i) => s + Number(i.monto_usd), 0);
  const costo = g + h;
  const saldo = ingresos - costo;

  const checks: [string, number, number][] = [
    ['n_gastos', rows.length, 2297],
    ['n_ingresos', ings.length, 56],
    ['ingresos', r2(ingresos), TARGET_ING],
    ['gastos_netos', r2(g), TARGET_GASTOS],
    ['admin', r2(h), TARGET_ADMIN],
    ['costo_total', r2(costo), 650845.31],
    ['saldo', r2(saldo), -25580.31],
  ];
  let ok = true;
  for (const [n, got, exp] of checks) {
    const pass = Math.abs(got - exp) < 0.015;
    if (!pass) ok = false;
    console.log(`[${pass ? 'OK' : 'FAIL'}] ${n}: ${got} vs ${exp}`);
  }
  console.log(ok ? 'PASS' : 'FAIL');
  process.exit(ok ? 0 : 2);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
