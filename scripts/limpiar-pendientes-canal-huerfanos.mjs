/**
 * Elimina pendientes canal huérfanos/erróneos (sin purchase_invoice_id).
 * Uso: node scripts/limpiar-pendientes-canal-huerfanos.mjs [--dry-run]
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createClient } from '@supabase/supabase-js';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const dryRun = process.argv.includes('--dry-run');

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

/** IDs a conservar (facturas con acción pendiente real). */
const CONSERVAR = new Set(['c188a87a-05e1-4f7d-9e4e-5551318d89fe']);

const env = parseEnvFile(fs.readFileSync(path.join(root, '.env.local'), 'utf8'));
const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);

const { data: rows, error } = await sb
  .from('ci_facturas_canal_pendientes')
  .select('id,estado,purchase_invoice_id,extracted,created_at')
  .in('estado', ['extraido', 'aprobado_sistema', 'confirmado', 'pendiente', 'procesando'])
  .order('created_at', { ascending: false });

if (error) {
  console.error(error);
  process.exit(1);
}

const candidatos = (rows ?? []).filter((r) => {
  if (CONSERVAR.has(r.id)) return false;
  const pi = String(r.purchase_invoice_id ?? '').trim();
  if (pi) return false;
  return true;
});

console.log(dryRun ? '=== DRY RUN ===' : '=== ELIMINANDO ===');
for (const r of candidatos) {
  const ex = r.extracted ?? {};
  const label = `${ex.supplier_name ?? '?'} · #${ex.invoice_number ?? 'S/N'} [${r.estado}]`;
  console.log('-', label, r.id);

  if (!dryRun) {
    const { error: delErr } = await sb.from('ci_facturas_canal_pendientes').delete().eq('id', r.id);
    if (delErr) {
      console.error('  ERROR:', delErr.message);
      process.exit(1);
    }
    console.log('  eliminado');
  }
}

console.log('\nTotal:', candidatos.length);

const { data: restantes } = await sb
  .from('ci_facturas_canal_pendientes')
  .select('id,estado,extracted')
  .order('created_at', { ascending: false });

console.log('\n=== Pendientes restantes ===');
for (const r of restantes ?? []) {
  const ex = r.extracted ?? {};
  console.log('-', ex.supplier_name, ex.invoice_number, r.estado, r.id.slice(0, 8));
}
