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

const suppliers = [
  'Mantenimiento Los Robles',
  'BARCELONA',
  'BRAJC',
  'CINES',
];

const { data: compras } = await sb
  .from('contabilidad_compras')
  .select('*')
  .order('created_at', { ascending: false })
  .limit(50);

console.log('=== contabilidad matches ===');
for (const c of compras ?? []) {
  const blob = JSON.stringify(c);
  if (suppliers.some((s) => blob.toUpperCase().includes(s.toUpperCase()))) {
    console.log({
      id: c.id,
      num: c.invoice_number,
      sup: c.supplier_name,
      estado: c.estado,
      pi: c.purchase_invoice_id,
      ing: c.ingresado_almacen_at,
    });
  }
}

const { data: cf } = await sb
  .from('compras_facturas')
  .select('*')
  .order('created_at', { ascending: false })
  .limit(50);

console.log('\n=== compras_facturas matches ===');
for (const f of cf ?? []) {
  const blob = JSON.stringify(f);
  if (suppliers.some((s) => blob.toUpperCase().includes(s.toUpperCase()))) {
    console.log({
      id: f.id,
      num: f.numero_factura,
      sup: f.proveedor_nombre,
      estado: f.estado,
      pi: f.purchase_invoice_id,
      reg: f.registrada_at,
    });
  }
}

const { data: pend } = await sb
  .from('ci_facturas_canal_pendientes')
  .select('id,estado,purchase_invoice_id,ubicacion_destino_id,extracted,updated_at');

console.log('\n=== pendientes full ===');
for (const p of pend ?? []) {
  const ex = p.extracted ?? {};
  console.log({
    id: p.id,
    num: ex.invoice_number,
    sup: ex.supplier_name,
    estado: p.estado,
    pi: p.purchase_invoice_id,
    ubi: p.ubicacion_destino_id,
    updated: p.updated_at,
  });
}
