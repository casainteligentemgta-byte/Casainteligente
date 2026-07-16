import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import postgres from 'postgres';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const envPath = path.join(root, '.env.local');
const env = fs.readFileSync(envPath, 'utf8');
const get = (k) => {
  const m = env.match(new RegExp(`^${k}=(.+)$`, 'm'));
  return m ? m[1].trim().replace(/^["']|["']$/g, '') : '';
};
const url = get('DATABASE_URL') || get('SUPABASE_DB_URL');
if (!url) {
  console.error('Falta DATABASE_URL en .env.local');
  process.exit(1);
}
const sql = postgres(url, { ssl: 'require' });
const q = fs.readFileSync(
  path.join(root, 'supabase/migrations/175_partidas_precio_unitario.sql'),
  'utf8',
);
await sql.unsafe(q);
await sql.end();
console.log('Migration 175 aplicada.');
