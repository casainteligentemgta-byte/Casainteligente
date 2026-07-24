/**
 * Compras con origen TELEGRAM en contabilidad_compras.
 * Uso: node scripts/check-compras-telegram.mjs
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const env = Object.fromEntries(
  fs
    .readFileSync(path.join(root, '.env.local'), 'utf8')
    .split(/\r?\n/)
    .filter((l) => l && !l.startsWith('#') && l.includes('='))
    .map((l) => {
      const i = l.indexOf('=');
      return [l.slice(0, i).trim(), l.slice(i + 1).trim()];
    }),
);

const url = (env.NEXT_PUBLIC_SUPABASE_URL ?? '').replace(/\/$/, '');
const sr = env.SUPABASE_SERVICE_ROLE_KEY ?? '';

async function q(table, params) {
  const r = await fetch(`${url}/rest/v1/${table}?${params}`, {
    headers: { apikey: sr, Authorization: `Bearer ${sr}` },
  });
  return r.json();
}

const canal = await q(
  'ci_facturas_canal_pendientes',
  'select=id,estado,created_at&order=created_at.desc&limit=20',
);
const compras = await q(
  'contabilidad_compras',
  'select=id,origen,fecha,invoice_number,supplier_name,created_at&origen=eq.TELEGRAM&order=created_at.desc&limit=20',
);

console.log('Canal (todas):', Array.isArray(canal) ? canal.length : canal);
if (Array.isArray(canal)) console.log(JSON.stringify(canal, null, 2));

console.log('\ncontabilidad_compras origen=TELEGRAM:', Array.isArray(compras) ? compras.length : compras);
if (Array.isArray(compras)) console.log(JSON.stringify(compras, null, 2));
