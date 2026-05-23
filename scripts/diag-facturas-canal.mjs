/**
 * Diagnóstico: facturas Telegram en BD y API Supabase REST.
 * Uso: node scripts/diag-facturas-canal.mjs
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import postgres from 'postgres';

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
const anon = env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '';

console.log('=== Diagnóstico facturas canal ===\n');
console.log('URL:', url || '(falta)');
console.log('Service role:', sr ? `${sr.slice(0, 20)}…` : '(falta)');
console.log('Anon:', anon ? `${anon.slice(0, 20)}…` : '(falta)');

async function restList(key, label) {
  const r = await fetch(
    `${url}/rest/v1/ci_facturas_canal_pendientes?select=id,estado,canal,created_at&order=created_at.desc&limit=10`,
    {
      headers: {
        apikey: key,
        Authorization: `Bearer ${key}`,
      },
    },
  );
  const text = await r.text();
  console.log(`\nREST ${label}: HTTP ${r.status}`);
  try {
    const j = JSON.parse(text);
    if (Array.isArray(j)) {
      console.log('  filas:', j.length);
      console.log(JSON.stringify(j, null, 2));
    } else {
      console.log(' ', JSON.stringify(j).slice(0, 400));
    }
  } catch {
    console.log(' ', text.slice(0, 400));
  }
}

if (url && sr) await restList(sr, 'service_role');
if (url && anon) await restList(anon, 'anon');

const dbUrl = env.DATABASE_POOLER_URL || env.DATABASE_URL;
if (dbUrl) {
  const sql = postgres(dbUrl, { ssl: 'require', max: 1 });
  try {
    const rows = await sql`
      select id, canal, estado, chat_label, created_at::text, left(coalesce(mensaje_error,''), 80) as err
      from ci_facturas_canal_pendientes
      order by created_at desc
      limit 15
    `;
    console.log('\nPostgres directo:', rows.length, 'filas');
    console.log(JSON.stringify(rows, null, 2));
  } catch (e) {
    console.error('\nPostgres error:', e.message);
  } finally {
    await sql.end();
  }
} else {
  console.log('\nSin DATABASE_URL para consulta directa');
}
