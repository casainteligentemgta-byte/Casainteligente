import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import postgres from 'postgres';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');

function parseEnvFile(content) {
  const out = {};
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

function parsePgUrl(url) {
  const m = url.match(/^postgresql:\/\/([^:]+):([^@]*)@([^:/]+)(?::(\d+))?\/([^?]+)/);
  if (!m) return null;
  return {
    user: decodeURIComponent(m[1]),
    password: decodeURIComponent(m[2]),
    host: m[3],
    port: m[4] ? Number(m[4]) : 5432,
    database: m[5],
    ssl: { rejectUnauthorized: false },
  };
}

async function connect() {
  const env = parseEnvFile(fs.readFileSync(path.join(root, '.env.local'), 'utf8'));
  const url = (env.DATABASE_URL || env.SUPABASE_DB_URL)?.trim();
  const ref = env.NEXT_PUBLIC_SUPABASE_URL?.match(/https:\/\/([^.]+)\.supabase\.co/)?.[1] ?? '';
  const parsed = parsePgUrl(url);
  let sql = postgres({ ...parsed, max: 1, prepare: false });
  try {
    await sql`select 1`;
  } catch {
    await sql.end({ timeout: 1 }).catch(() => {});
    sql = postgres({
      ...parsed,
      host: 'aws-1-us-east-1.pooler.supabase.com',
      port: 6543,
      user: parsed.user.includes('.') ? parsed.user : `postgres.${ref}`,
      max: 1,
      prepare: false,
    });
  }
  return sql;
}

const migPath = path.join(root, 'supabase/migrations/207_get_stock_real_obra_almacen_central.sql');
const sql = await connect();
await sql.unsafe(fs.readFileSync(migPath, 'utf8'));
const rpc = await sql`
  select count(*)::int as n
  from get_stock_real_obra('171694ed-0ecb-4ec5-82f5-82b980cb261f'::uuid)
`;
console.log('Migración 207 aplicada. RPC Flamboyant filas:', rpc[0]?.n);
await sql.end({ timeout: 5 });
