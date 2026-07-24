/**
 * Libera facturas Telegram atascadas en estado `procesando` sin OCR completado.
 * Uso: node scripts/reparar-canal-procesando-atascado.mjs
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

const { data: rows, error } = await sb
  .from('ci_facturas_canal_pendientes')
  .select('id, chat_label, estado, extracted, document_storage_path, created_at, updated_at')
  .eq('estado', 'procesando')
  .order('updated_at', { ascending: false })
  .limit(100);

if (error) {
  console.error(error.message);
  process.exit(1);
}

const msg =
  'OCR interrumpido (timeout). Reenvíe la foto con /facturas o confirme de nuevo en Telegram.';

let n = 0;
for (const row of rows ?? []) {
  if (row.extracted) continue;
  const nuevoEstado = 'recibido';
  const { error: updErr } = await sb
    .from('ci_facturas_canal_pendientes')
    .update({
      estado: nuevoEstado,
      mensaje_error: msg,
      updated_at: new Date().toISOString(),
    })
    .eq('id', row.id)
    .eq('estado', 'procesando');

  if (!updErr) {
    n += 1;
    console.log(`✓ ${row.id} (${row.chat_label ?? '?'}) → ${nuevoEstado}`);
  } else {
    console.warn(`✗ ${row.id}: ${updErr.message}`);
  }
}

console.log(`\nReparadas: ${n} / ${rows?.length ?? 0} en procesando`);
