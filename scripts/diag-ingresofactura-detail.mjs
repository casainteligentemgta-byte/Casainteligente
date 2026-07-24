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

const nums = ['00000583', '1589', '00156096', '00002689'];

const { data: compras } = await sb
  .from('contabilidad_compras')
  .select('id,invoice_number,supplier_name,estado,purchase_invoice_id,ingresado_almacen_at,origen,created_at')
  .order('created_at', { ascending: false })
  .limit(200);

console.log('=== contabilidad_compras (matching nums) ===');
for (const c of compras ?? []) {
  const num = String(c.invoice_number ?? '');
  if (nums.some((n) => num.includes(n) || n.includes(num))) {
    console.log(JSON.stringify(c));
  }
}

const { data: facturas } = await sb
  .from('compras_facturas')
  .select('id,numero_factura,proveedor_nombre,estado,purchase_invoice_id,registrada_at')
  .limit(200);

console.log('\n=== compras_facturas (matching) ===');
for (const f of facturas ?? []) {
  const num = String(f.numero_factura ?? '');
  if (nums.some((n) => num.includes(n) || n.includes(num))) {
    console.log(JSON.stringify(f));
  }
}

const { data: pendientes } = await sb
  .from('ci_facturas_canal_pendientes')
  .select('id,estado,purchase_invoice_id,ubicacion_destino_id,proyecto_id,entidad_id,mensaje_error,updated_at,extracted')
  .in('estado', ['extraido', 'aprobado_sistema', 'confirmado', 'pendiente', 'procesando', 'error', 'rechazado', 'ingresado', 'archivado'])
  .order('created_at', { ascending: false });

console.log('\n=== all pendientes with actionability ===');
for (const p of pendientes ?? []) {
  const ex = p.extracted ?? {};
  const prov = ex.supplier_name ?? '?';
  const num = ex.invoice_number ?? '?';
  const pi = p.purchase_invoice_id;
  const ubi = p.ubicacion_destino_id;
  console.log(
    JSON.stringify({
      prov,
      num,
      estado: p.estado,
      pi: pi ? pi.slice(0, 8) : null,
      ubi: ubi ? ubi.slice(0, 8) : null,
      proyecto: p.proyecto_id?.slice(0, 8),
      updated: p.updated_at?.slice(0, 10),
    }),
  );
}
