/**
 * Repara procuras en en_compra sin purchase_invoice_id.
 * Uso: npx tsx scripts/reparar-procura-en-compra-sin-factura.ts [ticket]
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createClient } from '@supabase/supabase-js';

const ticketFiltro = process.argv[2]?.trim();
const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');

function parseEnvFile(content: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const line of content.split(/\r?\n/)) {
    const t = line.trim();
    if (!t || t.startsWith('#')) continue;
    const i = t.indexOf('=');
    if (i === -1) continue;
    const key = t.slice(0, i).trim();
    let val = t.slice(i + 1).trim();
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    out[key] = val;
  }
  return out;
}

async function main(): Promise<void> {
  const envPath = path.join(root, '.env.local');
  const env = parseEnvFile(fs.readFileSync(envPath, 'utf8'));
  const url = env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const key = env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!url || !key) throw new Error('Faltan variables Supabase');

  const sb = createClient(url, key, { auth: { persistSession: false } });

  let q = sb
    .from('ci_procuras')
    .select('id,ticket,estado,via_rapida,purchase_invoice_id')
    .eq('estado', 'en_compra')
    .is('purchase_invoice_id', null);

  if (ticketFiltro) q = q.eq('ticket', ticketFiltro);

  const { data: filas, error } = await q;
  if (error) throw new Error(error.message);

  if (!filas?.length) {
    console.log(ticketFiltro ? `✅ ${ticketFiltro} no requiere reparación.` : '✅ Sin procuras en_compra sin factura.');
    return;
  }

  for (const row of filas) {
    const nuevoEstado = row.via_rapida ? 'aprobada_directa' : 'aprobada';
    const motivo = 'Corrección: en_compra sin factura — queda pendiente de factura';

    const { error: histErr } = await sb.from('ci_procura_estados_historial').insert({
      procura_id: row.id,
      estado_anterior: 'en_compra',
      estado_nuevo: nuevoEstado,
      motivo,
    });
    if (histErr) throw new Error(histErr.message);

    const { error: upErr } = await sb
      .from('ci_procuras')
      .update({
        estado: nuevoEstado,
        motivo_ultimo: motivo,
        updated_at: new Date().toISOString(),
      })
      .eq('id', row.id);
    if (upErr) throw new Error(upErr.message);

    console.log(`✅ ${row.ticket}: en_compra → ${nuevoEstado}`);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
