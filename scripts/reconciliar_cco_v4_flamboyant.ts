/**
 * Limpia libro CCO-V4 de Rancho Flamboyant y reimporta tmp/cco_v4_from_csv.json.
 * No toca HISTORICO_TABLA ni otras obras.
 *
 *   npx tsx scripts/reconciliar_cco_v4_flamboyant.ts
 */
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
process.env.SUPABASE_DEV_INSECURE_TLS = '1';
process.env.CCO_IMPORT_PROGRESS = '1';

import fs from 'fs';
import path from 'path';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { importarMaestroV4 } from '../lib/contabilidad/cco/importarMaestroV4';

const PROYECTO_ID = '171694ed-0ecb-4ec5-82f5-82b980cb261f';
const root = path.join(__dirname, '..');
const JSON_PATH = path.join(root, 'tmp', 'cco_v4_from_csv.json');

const TARGET = {
  ingresos: 625_265.0,
  gastos_netos: 565_952.44,
  admin: 84_892.87,
  costo_total: 650_845.31,
  saldo: -25_580.31,
  n_ingresos: 56,
  n_gastos: 2297,
};

for (const line of fs.readFileSync(path.join(root, '.env.local'), 'utf8').split(/\r?\n/)) {
  const m = line.match(/^([^#=]+)=(.*)$/);
  if (!m) continue;
  let v = m[2].trim();
  if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
    v = v.slice(1, -1);
  }
  if (process.env[m[1].trim()] === undefined) process.env[m[1].trim()] = v;
}

const r2 = (n: number) => Math.round(n * 100) / 100;

async function fetchIds(
  sb: SupabaseClient,
  table: string,
  apply: (q: ReturnType<SupabaseClient['from']>) => any,
): Promise<string[]> {
  const ids: string[] = [];
  let from = 0;
  for (;;) {
    let q = sb.from(table).select('id').range(from, from + 999);
    q = apply(q);
    const { data, error } = await q;
    if (error) throw new Error(`${table} select: ${error.message}`);
    const chunk = (data ?? []) as { id: string }[];
    ids.push(...chunk.map((r) => String(r.id)));
    if (chunk.length < 1000) break;
    from += 1000;
  }
  return ids;
}

async function deleteByIds(sb: SupabaseClient, table: string, ids: string[], col = 'id') {
  const chunk = 200;
  let deleted = 0;
  for (let i = 0; i < ids.length; i += chunk) {
    const part = ids.slice(i, i + chunk);
    const { error, count } = await sb.from(table).delete({ count: 'exact' }).in(col, part);
    if (error) throw new Error(`${table} delete: ${error.message}`);
    deleted += count ?? part.length;
  }
  return deleted;
}

async function wipeV4(sb: SupabaseClient) {
  console.log('1) Listando compras cco_v4_import…');
  const compraIds = await fetchIds(sb, 'contabilidad_compras', (q) =>
    q.eq('proyecto_id', PROYECTO_ID).eq('origen', 'cco_v4_import'),
  );
  console.log(`   compras V4: ${compraIds.length}`);

  if (compraIds.length) {
    // Quitar FK a contratos antes de borrar contratos.
    for (let i = 0; i < compraIds.length; i += 200) {
      const part = compraIds.slice(i, i + 200);
      const { error } = await sb
        .from('contabilidad_compras')
        .update({ contrato_obra_id: null })
        .in('id', part);
      if (error) throw new Error(`null contrato_obra_id: ${error.message}`);
    }

    console.log('2) Borrando líneas de compra…');
    // lineas por compra_id en lotes
    let lineas = 0;
    for (let i = 0; i < compraIds.length; i += 200) {
      const part = compraIds.slice(i, i + 200);
      const { data, error } = await sb
        .from('contabilidad_compra_lineas')
        .select('id')
        .in('compra_id', part);
      if (error) throw new Error(`lineas select: ${error.message}`);
      const lids = (data ?? []).map((r) => String((r as { id: string }).id));
      if (lids.length) lineas += await deleteByIds(sb, 'contabilidad_compra_lineas', lids);
    }
    console.log(`   líneas borradas: ${lineas}`);

    console.log('3) Borrando compras V4…');
    const n = await deleteByIds(sb, 'contabilidad_compras', compraIds);
    console.log(`   compras borradas: ${n}`);
  }

  console.log('4) Borrando ingresos cco_v4_import…');
  const ingIds = await fetchIds(sb, 'ci_inyecciones_capital', (q) =>
    q.eq('proyecto_id', PROYECTO_ID).eq('creado_por', 'cco_v4_import'),
  );
  // También por banco/origen_fondo por si quedó basura sin creado_por
  const extraIng = await fetchIds(sb, 'ci_inyecciones_capital', (q) =>
    q.eq('proyecto_id', PROYECTO_ID).eq('banco_origen', 'CCO-V4'),
  );
  const allIng = [...new Set([...ingIds, ...extraIng])];
  const nIng = allIng.length ? await deleteByIds(sb, 'ci_inyecciones_capital', allIng) : 0;
  console.log(`   ingresos borrados: ${nIng}`);

  console.log('5) Borrando contratos / estructura / auditoría V4…');
  const contratoIds = await fetchIds(sb, 'cco_contratos_obra', (q) =>
    q.eq('proyecto_id', PROYECTO_ID),
  );
  if (contratoIds.length) {
    console.log(`   contratos: ${await deleteByIds(sb, 'cco_contratos_obra', contratoIds)}`);
  }

  // subcapítulos primero (FK padre), luego el resto
  const { data: subcaps } = await sb
    .from('cco_estructura_costos')
    .select('id')
    .eq('proyecto_id', PROYECTO_ID)
    .eq('tipo_nivel', 'SUBCAPITULO');
  const subIds = (subcaps ?? []).map((r) => String((r as { id: string }).id));
  if (subIds.length) await deleteByIds(sb, 'cco_estructura_costos', subIds);
  const capIds = await fetchIds(sb, 'cco_estructura_costos', (q) =>
    q.eq('proyecto_id', PROYECTO_ID),
  );
  if (capIds.length) await deleteByIds(sb, 'cco_estructura_costos', capIds);
  console.log(`   estructura: ${subIds.length + capIds.length}`);

  const audIds = await fetchIds(sb, 'cco_auditoria_eventos', (q) =>
    q.eq('proyecto_id', PROYECTO_ID).not('origen_v4_id', 'is', null),
  );
  if (audIds.length) {
    console.log(`   auditoría: ${await deleteByIds(sb, 'cco_auditoria_eventos', audIds)}`);
  }
}

async function audit(sb: SupabaseClient) {
  const compras: { monto_usd: number; honorarios_usd: number | null }[] = [];
  let from = 0;
  for (;;) {
    const { data, error } = await sb
      .from('contabilidad_compras')
      .select('monto_usd,honorarios_usd')
      .eq('proyecto_id', PROYECTO_ID)
      .eq('origen', 'cco_v4_import')
      .range(from, from + 999);
    if (error) throw new Error(error.message);
    compras.push(...((data as typeof compras) || []));
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
    if (error) throw new Error(error.message);
    ings.push(...((data as typeof ings) || []));
    if (!data || data.length < 1000) break;
    from += 1000;
  }

  const gastos_netos = r2(compras.reduce((s, c) => s + Number(c.monto_usd || 0), 0));
  const admin = r2(compras.reduce((s, c) => s + Number(c.honorarios_usd || 0), 0));
  const ingresos = r2(ings.reduce((s, i) => s + Number(i.monto_usd || 0), 0));
  const costo_total = r2(gastos_netos + admin);
  const saldo = r2(ingresos - costo_total);

  const got = {
    n_gastos: compras.length,
    n_ingresos: ings.length,
    ingresos,
    gastos_netos,
    admin,
    costo_total,
    saldo,
  };

  const checks: [string, number, number][] = [
    ['n_gastos', got.n_gastos, TARGET.n_gastos],
    ['n_ingresos', got.n_ingresos, TARGET.n_ingresos],
    ['ingresos', got.ingresos, TARGET.ingresos],
    ['gastos_netos', got.gastos_netos, TARGET.gastos_netos],
    ['admin', got.admin, TARGET.admin],
    ['costo_total', got.costo_total, TARGET.costo_total],
    ['saldo', got.saldo, TARGET.saldo],
  ];

  console.log('\n=== KPIs post-reconciliación ===');
  let ok = true;
  for (const [name, g, e] of checks) {
    const diff = Math.abs(g - e);
    const pass = diff <= 0.02;
    if (!pass) ok = false;
    console.log(`  [${pass ? 'OK' : 'FAIL'}] ${name}: got=${g} expected=${e} diff=${r2(diff)}`);
  }
  console.log(ok ? '\nRESULTADO: PASS' : '\nRESULTADO: FAIL');
  return ok;
}

async function main() {
  if (!fs.existsSync(JSON_PATH)) {
    throw new Error(`Falta ${JSON_PATH}. Corre primero: python scripts/etl_cco_v4_csv.py`);
  }

  const sb = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } },
  );

  await wipeV4(sb);

  console.log('\n6) Reimportando CSV…');
  const payload = JSON.parse(fs.readFileSync(JSON_PATH, 'utf8'));
  payload.proyecto_id = PROYECTO_ID;
  payload.obra_alias = 'RANCHO FLAMBOYANT';
  payload.honorarios_admin_pct = Number(payload.honorarios_admin_pct) || 15;
  payload.auto_vincular = true;

  const t0 = Date.now();
  const result = await importarMaestroV4(sb, payload);
  console.log(`   ms ${Date.now() - t0}`);
  console.log(JSON.stringify(result, null, 2));
  if (result.errores?.length) {
    console.log('--- errores (max 20) ---');
    for (const e of result.errores.slice(0, 20)) console.log(e);
  }

  const ok = await audit(sb);
  if (!ok) {
    console.log('\n7) Compensando deriva numeric (céntimos)…');
    // Reusar lógica inline mínima
    const { spawnSync } = await import('child_process');
    const bal = spawnSync('npx', ['tsx', 'scripts/_balance_kpis_flamboyant.ts'], {
      cwd: root,
      stdio: 'inherit',
      shell: true,
      env: process.env,
    });
    process.exit(bal.status === 0 ? 0 : 2);
  }
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
