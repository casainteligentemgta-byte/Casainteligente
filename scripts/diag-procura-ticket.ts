/**
 * Diagnóstico de una procura por ticket.
 * Uso: npx tsx scripts/diag-procura-ticket.ts PR-2026-00030
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createClient } from '@supabase/supabase-js';

const ticket = process.argv[2]?.trim() || 'PR-2026-00030';
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
  if (!fs.existsSync(envPath)) throw new Error('Falta .env.local');
  const env = parseEnvFile(fs.readFileSync(envPath, 'utf8'));
  const url = env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const key = env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!url || !key) throw new Error('Faltan variables Supabase');

  const sb = createClient(url, key, { auth: { persistSession: false } });

  const { data: p, error } = await sb
    .from('ci_procuras')
    .select(
      'id,ticket,estado,via_rapida,purchase_invoice_id,created_at,updated_at,cantidad_compra,cantidad_despacho,stock_almacen_detectado,observaciones,material_txt',
    )
    .eq('ticket', ticket)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!p) {
    console.log(`No existe ${ticket}`);
    return;
  }

  console.log('\n=== PROCURA ===');
  console.log(JSON.stringify(p, null, 2));

  const { data: hist } = await sb
    .from('ci_procura_estados_historial')
    .select('estado_anterior,estado_nuevo,motivo,created_at')
    .eq('procura_id', p.id)
    .order('created_at', { ascending: true });
  console.log('\n=== HISTORIAL ESTADOS ===');
  for (const h of hist ?? []) {
    console.log(`  ${h.created_at}  ${h.estado_anterior} → ${h.estado_nuevo}  ${h.motivo ?? ''}`);
  }

  const { data: vinc } = await sb
    .from('ci_procura_compras_vinculo')
    .select('*')
    .eq('procura_id', p.id);
  console.log('\n=== VINCULO COMPRA ===');
  console.log(JSON.stringify(vinc, null, 2));

  if (p.purchase_invoice_id) {
    const { data: pi } = await sb
      .from('purchase_invoices')
      .select('id,invoice_number,status,created_at,supplier_name')
      .eq('id', p.purchase_invoice_id)
      .maybeSingle();
    console.log('\n=== PURCHASE INVOICE ===');
    console.log(JSON.stringify(pi, null, 2));
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
