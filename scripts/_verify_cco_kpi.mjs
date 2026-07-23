import fs from 'fs';
import { createClient } from '@supabase/supabase-js';

const env = {};
for (const line of fs.readFileSync('.env.local', 'utf8').split(/\r?\n/)) {
  const t = line.trim();
  if (!t || t.startsWith('#')) continue;
  const i = t.indexOf('=');
  if (i < 0) continue;
  let k = t.slice(0, i).trim();
  let v = t.slice(i + 1).trim().replace(/^["']+|["']+$/g, '');
  env[k] = v;
}

const FLAM = '171694ed-0ecb-4ec5-82f5-82b980cb261f';
const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

async function fetchAll(build) {
  const all = [];
  let from = 0;
  const page = 1000;
  for (;;) {
    const { data, error } = await build().range(from, from + page - 1);
    if (error) throw error;
    if (!data?.length) break;
    all.push(...data);
    if (data.length < page) break;
    from += page;
  }
  return all;
}

const { data: cfg } = await sb
  .from('cco_proyecto_config')
  .select('honorarios_admin_pct,devaluacion_pct')
  .eq('proyecto_id', FLAM)
  .maybeSingle();

const compras = await fetchAll(() =>
  sb
    .from('contabilidad_compras')
    .select('monto_usd,origen,origen_v4_id')
    .eq('proyecto_id', FLAM)
    .neq('imputacion', 'entidad')
    .neq('origen', 'HISTORICO_TABLA')
    .order('fecha')
    .order('id'),
);

const inyAll = await fetchAll(() =>
  sb
    .from('ci_inyecciones_capital')
    .select('monto_usd,creado_por,origen_fondo,banco_origen')
    .eq('proyecto_id', FLAM)
    .order('fecha_ingreso')
    .order('id'),
);

const tieneV4 = compras.some((r) => r.origen === 'cco_v4_import' || r.origen_v4_id != null);
const iny = tieneV4
  ? inyAll.filter(
      (r) =>
        r.creado_por === 'cco_v4_import' ||
        /^CCO-V4\b/i.test(String(r.origen_fondo || '')) ||
        String(r.banco_origen || '').toUpperCase() === 'CCO-V4',
    )
  : inyAll;

let gastos = 0;
for (const r of compras) gastos += Number(r.monto_usd) || 0;
let ingresos = 0;
for (const r of iny) ingresos += Number(r.monto_usd) || 0;
const pct = Number(cfg?.honorarios_admin_pct) || 15;
const deval = Number(cfg?.devaluacion_pct) || 0;
const admin = gastos * (pct / 100);
const costo = gastos + admin;
const saldo = ingresos - costo;
const f =
  deval > 0 ? 1 / (1 + deval / 100) : deval < 0 ? 1 + deval / 100 : 1;
const fSafe = f > 0 ? f : 1;
const round = (n) => Math.round(n * 100) / 100;

console.log({
  compras: compras.length,
  iny: iny.length,
  tieneV4,
  deval,
  oficial: {
    ingresos: round(ingresos),
    gastos: round(gastos),
    admin: round(admin),
    costo: round(costo),
    saldo: round(saldo),
  },
  real: {
    ingresos: round(ingresos * fSafe),
    gastos: round(gastos * fSafe),
    admin: round(admin * fSafe),
    costo: round(costo * fSafe),
    saldo: round(saldo * fSafe),
  },
  expected: {
    ingresos: 465057.15,
    gastos: 408033.81,
    admin: 61205.07,
    costo: 469238.88,
    saldo: -4181.73,
  },
});
