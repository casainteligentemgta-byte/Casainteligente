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

const { data: canal, error } = await sb
  .from('ci_facturas_canal_pendientes')
  .select('id,estado,purchase_invoice_id,ubicacion_destino_id,extracted,canal,created_at')
  .order('created_at', { ascending: false })
  .limit(50);

if (error) {
  console.error(error);
  process.exit(1);
}

console.log('=== ci_facturas_canal_pendientes (transito-like) ===');
for (const r of canal ?? []) {
  const ex = r.extracted ?? {};
  const prov = String(ex.supplier_name ?? ex.proveedor ?? '');
  const num = String(ex.invoice_number ?? ex.numero ?? '');
  const enTransito = ['extraido', 'aprobado_sistema', 'confirmado', 'pendiente', 'procesando'].includes(
    r.estado,
  );
  if (!enTransito) continue;
  const puedeIngreso =
    r.estado === 'confirmado' && Boolean(r.purchase_invoice_id) && Boolean(r.ubicacion_destino_id);
  const puedeConfirmar = ['extraido', 'aprobado_sistema'].includes(r.estado);
  console.log(
    JSON.stringify({
      id: r.id,
      estado: r.estado,
      pi: r.purchase_invoice_id,
      ubi: r.ubicacion_destino_id,
      prov,
      num,
      canal: r.canal,
      puedeIngreso,
      puedeConfirmar,
    }),
  );
}

const { data: ingresados } = await sb
  .from('contabilidad_compras')
  .select('purchase_invoice_id, supplier_name, invoice_number, ingresado_almacen_at')
  .not('purchase_invoice_id', 'is', null)
  .not('ingresado_almacen_at', 'is', null);

console.log('\n=== ingresado_almacen_at ===', ingresados?.length ?? 0);
for (const r of ingresados ?? []) {
  if (/cines|vela|unidos/i.test(String(r.supplier_name ?? '') + String(r.invoice_number ?? ''))) {
    console.log(JSON.stringify(r));
  }
}

// Simula filtro ingresofactura
let count = 0;
for (const r of canal ?? []) {
  const estado = String(r.estado ?? '');
  const pi = String(r.purchase_invoice_id ?? '').trim();
  const ubi = String(r.ubicacion_destino_id ?? '').trim();
  const ex = r.extracted ?? {};
  const prov = String(ex.supplier_name ?? ex.proveedor ?? '');
  const num = String(ex.invoice_number ?? ex.numero ?? '');
  if (!['extraido', 'aprobado_sistema', 'confirmado'].includes(estado)) continue;
  const acc =
    estado === 'confirmado' && pi && ubi
      ? 'ingreso_almacen'
      : ['extraido', 'aprobado_sistema'].includes(estado)
        ? 'confirmar'
        : null;
  if (!acc || (!prov && !num)) continue;
  count += 1;
  if (/cines|vela/i.test(prov)) {
    console.log('\n✅ CINES en lista ingresofactura:', { prov, num, acc, estado });
  }
}
console.log('\nTotal ingresofactura simulado:', count);
