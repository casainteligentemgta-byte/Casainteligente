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
  const opts = { max: 1, prepare: false };
  const candidates = [
    {
      ...parsed,
      ...opts,
      host: 'aws-1-us-east-1.pooler.supabase.com',
      port: 6543,
      user: `postgres.${ref}`,
    },
    {
      ...parsed,
      ...opts,
      host: 'aws-0-us-east-1.pooler.supabase.com',
      port: 6543,
      user: `postgres.${ref}`,
    },
    {
      ...parsed,
      ...opts,
      host: 'aws-1-eu-central-1.pooler.supabase.com',
      port: 6543,
      user: `postgres.${ref}`,
    },
    { ...parsed, ...opts },
  ];
  let lastErr;
  for (const cfg of candidates) {
    const sql = postgres(cfg);
    try {
      await sql`select 1`;
      return sql;
    } catch (e) {
      lastErr = e;
      await sql.end({ timeout: 1 }).catch(() => {});
    }
  }
  throw lastErr;
}

const sql = await connect();
await sql.unsafe("notify pgrst, 'reload schema'");
console.log("OK: notify pgrst, 'reload schema'");
await sql.end({ timeout: 5 });
