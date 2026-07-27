/**
 * Restaura monto_usd / honorarios_usd desde el JSON CSV (sin redondear fila a fila).
 * Los KPIs oficiales redondean el TOTAL, no cada fila.
 */
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
import fs from 'fs';
import path from 'path';
import { createClient } from '@supabase/supabase-js';

const PROYECTO_ID = '171694ed-0ecb-4ec5-82f5-82b980cb261f';
const root = path.join(__dirname, '..');
for (const line of fs.readFileSync(path.join(root, '.env.local'), 'utf8').split(/\r?\n/)) {
  const m = line.match(/^([^#=]+)=(.*)$/);
  if (!m) continue;
  let v = m[2].trim();
  if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
  if (process.env[m[1].trim()] === undefined) process.env[m[1].trim()] = v;
}

/** Redondeo comercial half-up a 2 decimales (como cco_v4_kpis_flamboyant). */
function round2(n: number): number {
  return Math.round((Number(n) + Number.EPSILON) * 100) / 100;
}

// Better half-up via string like Python Decimal
function round2HalfUp(n: number): number {
  const s = Number(n).toFixed(8); // stabilize
  const [i, f = ''] = s.split('.');
  const frac = (f + '00000000').slice(0, 8);
  const third = Number(frac[2] || '0');
  let cents = Number(frac.slice(0, 2));
  if (third >= 5) cents += 1;
  let whole = Number(i);
  if (cents >= 100) {
    cents -= 100;
    whole += 1;
  }
  const sign = n < 0 ? -1 : 1;
  return sign * (Math.abs(whole) + cents / 100);
}

const TARGET = {
  ingresos: 625265,
  gastos: 565952.44,
  admin: 84892.87,
  costo: 650845.31,
  saldo: -25580.31,
};

async function main() {
  const payload = JSON.parse(fs.readFileSync(path.join(root, 'tmp', 'cco_v4_from_csv.json'), 'utf8'));
  const byId = new Map<number, { monto: number; hon: number }>();
  for (const t of payload.transacciones) {
    if (String(t.clase).toUpperCase() !== 'GASTO') continue;
    const base = Number(t.monto_base_usd) || 0;
    const hon =
      t.honorarios != null && Number.isFinite(Number(t.honorarios))
        ? Number(t.honorarios)
        : base * 0.15;
    byId.set(Number(t.origen_v4_id), { monto: base, hon });
  }

  const sb = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } },
  );

  const rows: { id: string; origen_v4_id: number }[] = [];
  let from = 0;
  for (;;) {
    const { data, error } = await sb
      .from('contabilidad_compras')
      .select('id,origen_v4_id')
      .eq('proyecto_id', PROYECTO_ID)
      .eq('origen', 'cco_v4_import')
      .range(from, from + 999);
    if (error) throw error;
    rows.push(...((data as typeof rows) || []));
    if (!data || data.length < 1000) break;
    from += 1000;
  }

  let updated = 0;
  for (const row of rows) {
    const want = byId.get(Number(row.origen_v4_id));
    if (!want) continue;
    const { error } = await sb
      .from('contabilidad_compras')
      .update({
        monto_usd: want.monto,
        total_amount_usd: want.monto,
        honorarios_usd: want.hon,
        updated_at: new Date().toISOString(),
      })
      .eq('id', row.id);
    if (error) throw error;
    updated += 1;
  }
  console.log('restaurados', updated);

  const fresh: { monto_usd: number; honorarios_usd: number }[] = [];
  from = 0;
  for (;;) {
    const { data, error } = await sb
      .from('contabilidad_compras')
      .select('monto_usd,honorarios_usd')
      .eq('proyecto_id', PROYECTO_ID)
      .eq('origen', 'cco_v4_import')
      .range(from, from + 999);
    if (error) throw error;
    fresh.push(...((data as typeof fresh) || []));
    if (!data || data.length < 1000) break;
    from += 1000;
  }
  const ings: { monto_usd: number }[] = [];
  from = 0;
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

  const gastosRaw = fresh.reduce((s, c) => s + Number(c.monto_usd || 0), 0);
  const adminRaw = fresh.reduce((s, c) => s + Number(c.honorarios_usd || 0), 0);
  const ingresosRaw = ings.reduce((s, i) => s + Number(i.monto_usd || 0), 0);
  const gastos = round2HalfUp(gastosRaw);
  const admin = round2HalfUp(adminRaw);
  const ingresos = round2HalfUp(ingresosRaw);
  // Dashboard CI: admin flat 15% sobre gastos (equivale si todos son 15%)
  const adminFlat = round2HalfUp(gastosRaw * 0.15);
  const costo = round2HalfUp(gastosRaw + adminRaw);
  const costoFlat = round2HalfUp(gastosRaw + gastosRaw * 0.15);
  const saldo = round2HalfUp(ingresosRaw - (gastosRaw + adminRaw));
  const saldoFlat = round2HalfUp(ingresosRaw - (gastosRaw + gastosRaw * 0.15));

  console.log({
    n_gastos: fresh.length,
    n_ingresos: ings.length,
    ingresos,
    gastos_netos: gastos,
    admin_col: admin,
    admin_flat15: adminFlat,
    costo_col: costo,
    costo_flat: costoFlat,
    saldo_col: saldo,
    saldo_flat: saldoFlat,
  });

  const checks: [string, number, number][] = [
    ['n_gastos', fresh.length, 2297],
    ['n_ingresos', ings.length, 56],
    ['ingresos', ingresos, TARGET.ingresos],
    ['gastos_netos', gastos, TARGET.gastos],
    ['admin', admin, TARGET.admin],
    ['costo_total', costo, TARGET.costo],
    ['saldo', saldo, TARGET.saldo],
  ];
  let ok = true;
  for (const [n, g, e] of checks) {
    const pass = Math.abs(g - e) < 0.015;
    if (!pass) ok = false;
    console.log(`[${pass ? 'OK' : 'FAIL'}] ${n}: ${g} vs ${e} diff=${Math.abs(g - e)}`);
  }
  console.log(ok ? 'PASS' : 'FAIL');
  process.exit(ok ? 0 : 2);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
