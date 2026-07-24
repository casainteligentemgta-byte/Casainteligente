/**
 * Libera facturas Telegram atascadas en `procesando`:
 * - Con OCR + contabilidad/PI → confirmado
 * - Con OCR sin confirmar → extraido
 * - Sin OCR → recibido (reintento usuario)
 *
 * Uso: node scripts/liberar-facturas-canal-atascadas.mjs
 */
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

const msgSinOcr =
  'OCR interrumpido (timeout). Reenvíe la foto con /facturas o confirme de nuevo en Telegram.';

const { data: rows, error } = await sb
  .from('ci_facturas_canal_pendientes')
  .select(
    'id, chat_label, estado, extracted, document_storage_path, purchase_invoice_id, created_at, updated_at',
  )
  .eq('estado', 'procesando')
  .order('updated_at', { ascending: false })
  .limit(200);

if (error) {
  console.error(error.message);
  process.exit(1);
}

if (!rows?.length) {
  console.log('No hay facturas en procesando.');
  process.exit(0);
}

console.log(`Encontradas ${rows.length} en procesando\n`);

const piIds = [...new Set(rows.map((r) => r.purchase_invoice_id).filter(Boolean))];
const ccByPi = new Map();
if (piIds.length) {
  const { data: compras } = await sb
    .from('contabilidad_compras')
    .select('id, purchase_invoice_id')
    .in('purchase_invoice_id', piIds);
  for (const c of compras ?? []) {
    if (c.purchase_invoice_id) ccByPi.set(c.purchase_invoice_id, c.id);
  }
}

let ok = 0;
let fail = 0;

for (const row of rows) {
  const hasExtracted = row.extracted != null && typeof row.extracted === 'object';
  const hasPi = Boolean(row.purchase_invoice_id);
  const hasContabilidad = hasPi && ccByPi.has(row.purchase_invoice_id);

  let nuevoEstado;
  let patch = { updated_at: new Date().toISOString() };

  if (hasExtracted && (hasContabilidad || hasPi)) {
    nuevoEstado = 'confirmado';
    patch.estado = nuevoEstado;
    patch.mensaje_error = null;
  } else if (hasExtracted) {
    nuevoEstado = 'extraido';
    patch.estado = nuevoEstado;
    patch.mensaje_error = null;
  } else {
    nuevoEstado = 'recibido';
    patch.estado = nuevoEstado;
    patch.mensaje_error = msgSinOcr;
  }

  const { error: updErr } = await sb
    .from('ci_facturas_canal_pendientes')
    .update(patch)
    .eq('id', row.id)
    .eq('estado', 'procesando');

  if (!updErr) {
    ok += 1;
    const ex = row.extracted ?? {};
    console.log(
      `✓ ${row.id} (${row.chat_label ?? '?'}) → ${nuevoEstado}` +
        (ex.invoice_number ? ` [${ex.invoice_number}]` : ''),
    );
  } else {
    fail += 1;
    console.warn(`✗ ${row.id} (${row.chat_label ?? '?'}): ${updErr.message}`);
  }
}

console.log(`\nLiberadas: ${ok} / ${rows.length} (fallos: ${fail})`);
