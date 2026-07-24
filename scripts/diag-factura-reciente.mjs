import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createClient } from '@supabase/supabase-js';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const env = Object.fromEntries(
  fs
    .readFileSync(path.join(root, '.env.local'), 'utf8')
    .split(/\r?\n/)
    .filter((l) => l.trim() && !l.startsWith('#') && l.includes('='))
    .map((l) => {
      const i = l.indexOf('=');
      let val = l.slice(i + 1).trim();
      if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
        val = val.slice(1, -1);
      }
      return [l.slice(0, i).trim(), val];
    }),
);

const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

const NEO_CHAT = 8684897057;
const hace24h = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

const { data: canal, error: e1 } = await sb
  .from('ci_facturas_canal_pendientes')
  .select(
    'id,estado,chat_id,chat_label,proyecto_id,ubicacion_destino_id,purchase_invoice_id,created_at,updated_at,mensaje_error,extracted',
  )
  .gte('created_at', hace24h)
  .order('created_at', { ascending: false })
  .limit(20);

if (e1) console.error('canal error', e1.message);

console.log('=== Canal ultimas 24h ===', canal?.length ?? 0);
for (const p of canal ?? []) {
  const ex = p.extracted ?? {};
  console.log(
    JSON.stringify({
      id: p.id,
      estado: p.estado,
      chat: p.chat_label || p.chat_id,
      neo: p.chat_id === NEO_CHAT,
      factura: ex.invoice_number,
      proveedor: ex.supplier_name,
      proyecto_id: p.proyecto_id,
      pi: p.purchase_invoice_id,
      err: p.mensaje_error,
      created: p.created_at,
    }),
  );
}

const { data: compras, error: e2 } = await sb
  .from('contabilidad_compras')
  .select(
    'id,origen,fecha,invoice_number,supplier_name,proyecto_id,estado,purchase_invoice_id,created_at',
  )
  .gte('created_at', hace24h)
  .order('created_at', { ascending: false })
  .limit(20);

if (e2) console.error('compras error', e2.message);

console.log('\n=== contabilidad_compras ultimas 24h ===', compras?.length ?? 0);
for (const c of compras ?? []) {
  console.log(
    JSON.stringify({
      id: c.id,
      origen: c.origen,
      factura: c.invoice_number,
      proveedor: c.supplier_name,
      proyecto_id: c.proyecto_id,
      pi: c.purchase_invoice_id,
      estado: c.estado,
      created: c.created_at,
    }),
  );
}

const { data: neoCanal } = await sb
  .from('ci_facturas_canal_pendientes')
  .select('id,estado,created_at,extracted,mensaje_error,purchase_invoice_id')
  .eq('chat_id', NEO_CHAT)
  .order('created_at', { ascending: false })
  .limit(5);

console.log('\n=== Neo ultimas 5 en canal ===');
for (const p of neoCanal ?? []) {
  const ex = p.extracted ?? {};
  console.log(
    JSON.stringify({
      id: p.id,
      estado: p.estado,
      factura: ex.invoice_number,
      proveedor: ex.supplier_name,
      pi: p.purchase_invoice_id,
      err: p.mensaje_error,
      created: p.created_at,
    }),
  );
}

const { data: estados } = await sb
  .from('ci_telegram_estados')
  .select('chat_id,contexto,pending_factura_id,updated_at')
  .eq('chat_id', String(NEO_CHAT))
  .maybeSingle();

console.log('\n=== Estado Telegram Neo ===', estados);

const stuckId = 'e531d82d-e238-48a6-90c1-201732133747';
const { data: stuck } = await sb
  .from('ci_facturas_canal_pendientes')
  .select('*')
  .eq('id', stuckId)
  .maybeSingle();
console.log('\n=== Factura Neo atascada (detalle) ===');
console.log(
  JSON.stringify(
    stuck
      ? {
          id: stuck.id,
          estado: stuck.estado,
          extracted: stuck.extracted,
          document_storage_path: stuck.document_storage_path,
          mensaje_error: stuck.mensaje_error,
          updated_at: stuck.updated_at,
        }
      : null,
    null,
    2,
  ),
);
