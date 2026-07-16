import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createClient } from '@supabase/supabase-js';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');

function parseEnvFile(content) {
  const out = {};
  for (const line of content.split(/\r?\n/)) {
    const t = line.trim();
    if (!t || t.startsWith('#')) continue;
    const i = t.indexOf('=');
    if (i === -1) continue;
    let val = t.slice(i + 1).trim();
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1);
    }
    out[t.slice(0, i).trim()] = val;
  }
  return out;
}

const env = parseEnvFile(fs.readFileSync(path.join(root, '.env.local'), 'utf8'));
const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);

const panelEstados = [
  'extraido',
  'pendiente',
  'procesando',
  'error',
  'confirmado',
  'rechazado',
];
const recepcionFilter = [
  'extraido',
  'aprobado_sistema',
  'confirmado',
  'pendiente',
  'procesando',
];

const { data: allCanal } = await sb
  .from('ci_facturas_canal_pendientes')
  .select('id,estado,purchase_invoice_id,ubicacion_destino_id,extracted,canal,created_at')
  .order('created_at', { ascending: false })
  .limit(100);

function label(row) {
  const ex = row.extracted ?? {};
  return `${ex.supplier_name ?? '?'} · #${ex.invoice_number ?? 'S/N'} [${row.estado}]`;
}

console.log('=== WEB API panel_canal (raw) ===');
const panelRaw = (allCanal ?? []).filter((r) => panelEstados.includes(r.estado));
for (const r of panelRaw) console.log('-', label(r), r.id.slice(0, 8));
console.log('count:', panelRaw.length);

console.log('\n=== WEB recepcion (panel + client filter) ===');
const recepcion = (allCanal ?? []).filter((r) => recepcionFilter.includes(r.estado));
for (const r of recepcion) console.log('-', label(r), r.id.slice(0, 8));
console.log('count:', recepcion.length);

console.log('\n=== TELEGRAM ingresofactura logic ===');
const tgEstados = ['extraido', 'aprobado_sistema', 'confirmado'];
const ingresados = new Set();
const { data: comprasIng } = await sb
  .from('contabilidad_compras')
  .select('purchase_invoice_id, ingresado_almacen_at')
  .not('purchase_invoice_id', 'is', null)
  .not('ingresado_almacen_at', 'is', null);
for (const r of comprasIng ?? []) {
  const pi = String(r.purchase_invoice_id ?? '').trim();
  if (pi) ingresados.add(pi);
}

const tgList = [];
for (const row of allCanal ?? []) {
  const estado = String(row.estado ?? '');
  if (!tgEstados.includes(estado)) continue;
  const pi = String(row.purchase_invoice_id ?? '').trim();
  const ubi = String(row.ubicacion_destino_id ?? '').trim();
  const acc =
    estado === 'confirmado' && pi && ubi
      ? 'ingreso_almacen'
      : ['extraido', 'aprobado_sistema'].includes(estado)
        ? 'confirmar'
        : null;
  if (!acc) continue;
  if (pi && ingresados.has(pi)) continue;
  const ex = row.extracted ?? {};
  const prov = String(ex.supplier_name ?? ex.proveedor ?? '').trim();
  const num = String(ex.invoice_number ?? ex.numero ?? '').trim();
  if (!prov && !num) continue;
  tgList.push({ label: `${prov} · #${num}`, estado, acc, id: row.id });
  console.log('-', `${prov} · #${num}`, estado, acc);
}
console.log('count:', tgList.length);

console.log('\n=== ONLY IN TELEGRAM (not in web recepcion) ===');
const recepcionIds = new Set(recepcion.map((r) => r.id));
for (const t of tgList) {
  if (!recepcionIds.has(t.id)) console.log('EXTRA:', t.label, t.estado);
}
