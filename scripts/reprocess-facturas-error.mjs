/**
 * Reintenta OCR Gemini en facturas canal con estado error.
 * Uso: node scripts/reprocess-facturas-error.mjs
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createClient } from '@supabase/supabase-js';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');

function parseEnv(content) {
  const out = {};
  for (const line of content.split(/\r?\n/)) {
    const t = line.trim();
    if (!t || t.startsWith('#')) continue;
    const i = t.indexOf('=');
    if (i === -1) continue;
    let val = t.slice(i + 1).trim();
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    out[t.slice(0, i).trim()] = val;
  }
  return out;
}

const env = parseEnv(fs.readFileSync(path.join(root, '.env.local'), 'utf8'));
const url = env.NEXT_PUBLIC_SUPABASE_URL?.replace(/\/$/, '');
const key = env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error('Faltan NEXT_PUBLIC_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(url, key);
const BUCKET = 'procurement-documents';

async function main() {
  const { data: rows, error } = await supabase
    .from('ci_facturas_canal_pendientes')
    .select('id, document_storage_path, document_mime_type, document_file_name')
    .in('estado', ['error', 'procesando', 'pendiente'])
    .order('created_at', { ascending: false })
    .limit(20);

  if (error) throw error;
  if (!rows?.length) {
    console.log('No hay facturas para reprocesar.');
    return;
  }

  console.log(`Reprocesando ${rows.length} factura(s)…\n`);

  const { processInvoiceFromCanal } = await import('../lib/canal/processInvoiceFromCanal.ts');

  for (const row of rows) {
    if (!row.document_storage_path) {
      console.log('⏭️', row.id, 'sin archivo en storage');
      continue;
    }

    const { data: blob, error: dlErr } = await supabase.storage
      .from(BUCKET)
      .download(row.document_storage_path);
    if (dlErr || !blob) {
      console.log('❌', row.id, 'download:', dlErr?.message);
      continue;
    }

    const buffer = Buffer.from(await blob.arrayBuffer());
    const mimeType = row.document_mime_type || 'image/jpeg';
    const fileName = row.document_file_name || 'factura.jpg';

    console.log('▶', row.id, fileName);

    try {
      await processInvoiceFromCanal({
        canal: 'telegram',
        pendingId: row.id,
        chatId: 'reprocess',
        buffer,
        mimeType,
        fileName,
        sendReply: async () => {},
      });
      console.log('✅', row.id);
    } catch (e) {
      console.log('❌', row.id, e.message);
    }
  }

  const { data: after } = await supabase
    .from('ci_facturas_canal_pendientes')
    .select('id, estado')
    .order('created_at', { ascending: false })
    .limit(10);
  console.log('\nEstado final:', JSON.stringify(after, null, 2));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
