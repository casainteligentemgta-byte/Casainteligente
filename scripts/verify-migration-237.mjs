import { readFileSync } from 'fs';
import { resolve } from 'path';

function loadEnv() {
  const raw = readFileSync(resolve(process.cwd(), '.env.local'), 'utf8');
  for (const line of raw.split('\n')) {
    const m = line.match(/^([^#=]+)=(.*)$/);
    if (m) process.env[m[1].trim()] = m[2].trim().replace(/^"|"$/g, '');
  }
}

loadEnv();

const base = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!base || !key) {
  console.error('Faltan NEXT_PUBLIC_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const headers = {
  apikey: key,
  Authorization: `Bearer ${key}`,
  'Content-Type': 'application/json',
};

async function rest(path, opts = {}) {
  const res = await fetch(`${base}/rest/v1/${path}`, { headers, ...opts });
  const text = await res.text();
  let json = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = text;
  }
  return { ok: res.ok, status: res.status, json, text };
}

async function rpc(name, body) {
  const res = await fetch(`${base}/rest/v1/rpc/${name}`, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  });
  const text = await res.text();
  let json = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = text;
  }
  return { ok: res.ok, status: res.status, json, text };
}

const checks = [];

// D-08: column exists (HEAD select one row)
const d08 = await rest(
  'ci_recepciones_campo?select=contabilidad_sync_pendiente,contabilidad_sync_error,contabilidad_sync_intentos,contabilidad_sync_at&limit=1',
);
checks.push({
  id: 'D-08 columnas sync',
  ok: d08.ok,
  detail: d08.ok ? '4 columnas accesibles' : String(d08.json?.message ?? d08.text).slice(0, 120),
});

// 235 procura_id
const p235 = await rest('ci_recepciones_campo?select=procura_id&limit=1');
checks.push({
  id: '235 procura_id',
  ok: p235.ok,
  detail: p235.ok ? 'ok' : String(p235.json?.message ?? p235.text).slice(0, 80),
});

// D-09 FSM via dummy RPC call on transicion (can't call easily) - test procesar_procuras_lote ambiguity
const ppl = await rpc('procesar_procuras_lote', {
  p_ids: ['00000000-0000-4000-8000-000000000001'],
  p_nuevo_estado: 'cancelada',
  p_motivo: 'test-verify-237',
});
const pplAmbiguo = /could not choose|PGRST203|not unique/i.test(String(ppl.text));
checks.push({
  id: 'procesar_procuras_lote RPC',
  ok: ppl.ok || (!pplAmbiguo && /procura|Transición|Estado|Debe indicar/i.test(String(ppl.text))),
  warn: pplAmbiguo,
  detail: pplAmbiguo
    ? 'AMBIGUO — aplicar migración 238'
    : ppl.ok
      ? 'RPC responde OK'
      : String(ppl.json?.message ?? ppl.text).slice(0, 100),
  fix: pplAmbiguo ? '238_repair_procesar_procuras_lote_overload.sql' : null,
});

// 236 RPCs
for (const [fn, body, label] of [
  ['ci_vincular_procura_compra', { p_purchase_invoice_id: null, p_auto_match: false }, '236 ci_vincular_procura_compra'],
  ['ci_procura_actualizar_recepcion', { p_recepcion_id: null, p_procura_id: null }, '235 ci_procura_actualizar_recepcion'],
]) {
  const r = await rpc(fn, body);
  const exists = r.status !== 404 && !/does not exist|42883/i.test(String(r.text));
  checks.push({
    id: label,
    ok: exists,
    detail: exists ? 'disponible' : String(r.json?.message ?? r.text).slice(0, 80),
  });
}

const ingreso = await rpc('ci_completar_ingreso_almacen_compra', {
  p_purchase_invoice_id: '00000000-0000-4000-8000-000000000001',
  p_numero_factura: 'VERIFY-237',
  p_proveedor_rif: 'J000000000',
  p_proveedor_nombre: 'Verify 237',
  p_fecha_emision: '2026-01-01',
  p_subtotal: 1,
  p_impuesto: 0,
  p_total: 1,
  p_ubicacion_destino_id: '00000000-0000-4000-8000-000000000002',
  p_lineas: [{ material_id: '00000000-0000-4000-8000-000000000003', cantidad: 1 }],
});
const ingresoOk = ingreso.status !== 404 && !/does not exist|42883/i.test(String(ingreso.text));
checks.push({
  id: '236 ci_completar_ingreso_almacen_compra',
  ok: ingresoOk,
  detail: ingresoOk ? 'disponible' : String(ingreso.json?.message ?? ingreso.text).slice(0, 80),
});

// D-11 inv_stock_apply_delta ambiguity
const stock = await rpc('inv_stock_apply_delta', {
  p_ubicacion_id: '00000000-0000-4000-8000-000000000001',
  p_material_id: '00000000-0000-4000-8000-000000000002',
  p_delta_disponible: 0,
  p_delta_reservada: 0,
  p_delta_transito_entrante: 0,
  p_tipo_movimiento: 'ajuste',
  p_referencia_tipo: null,
  p_referencia_id: null,
  p_documento_id: null,
  p_notas: 'verify-237',
});
const stockAmbiguo = /could not choose|PGRST203/i.test(String(stock.text));
checks.push({
  id: 'inv_stock_apply_delta (D-11)',
  ok: !stockAmbiguo,
  detail: stockAmbiguo ? 'AMBIGUO — reaplicar DROP overload 5 params' : 'firma única (ok o error negocio)',
});

console.log(`\n=== Verificación remota Supabase ===\n`);
let fails = 0;
for (const c of checks) {
  const icon = c.ok ? '✅' : '❌';
  if (!c.ok) fails++;
  console.log(`${icon} ${c.id}: ${c.detail}${c.fix ? `\n   → ${c.fix}` : ''}`);
}
console.log(`\n${checks.length - fails}/${checks.length} OK\n`);
process.exit(fails ? 1 : 0);
