/**
 * Recarga caché de esquema PostgREST tras migraciones SQL.
 * Uso: node scripts/notify-pgrst-reload.mjs
 */
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
  const m = url.match(
    /^postgresql:\/\/([^:]+):([^@]*)@([^:/]+)(?::(\d+))?\/([^?]+)(?:\?(.*))?$/,
  );
  if (!m) return null;
  const [, user, password, host, port, database, query] = m;
  const ssl =
    query && /sslmode=require/i.test(query) ? { rejectUnauthorized: false } : undefined;
  return {
    user: decodeURIComponent(user),
    password: decodeURIComponent(password),
    host,
    port: port ? Number(port) : 5432,
    database,
    ssl,
  };
}

async function tryPooler(parsed, opts, projectRef) {
  const regions = ['us-east-1', 'us-west-1', 'eu-west-1', 'eu-central-1', 'sa-east-1'];
  const user = parsed.user.includes('.') ? parsed.user : `postgres.${projectRef}`;
  for (const region of regions) {
    for (const host of [
      `aws-0-${region}.pooler.supabase.com`,
      `aws-1-${region}.pooler.supabase.com`,
    ]) {
      try {
        const sql = postgres({ ...parsed, ...opts, host, port: 6543, user });
        await sql`select 1`;
        console.log(`Conectado vía pooler ${host}:6543`);
        return sql;
      } catch {
        /* siguiente */
      }
    }
  }
  return null;
}

async function connectPostgres(url, projectRef) {
  const opts = { max: 1, prepare: false, connect_timeout: 25 };
  const poolerUrl = process.env.DATABASE_POOLER_URL?.trim();
  if (poolerUrl) {
    const parsed = parsePgUrl(poolerUrl);
    if (parsed) {
      const sql = postgres({ ...parsed, ...opts });
      await sql`select 1`;
      console.log('Conectado con DATABASE_POOLER_URL');
      return sql;
    }
  }

  const parsed = parsePgUrl(url);
  if (!parsed) throw new Error('DATABASE_URL inválida');

  let sql = postgres({ ...parsed, ...opts });
  try {
    await sql`select 1`;
    console.log('Conectado a Postgres');
    return sql;
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    await sql.end({ timeout: 1 }).catch(() => {});
    if (/ENOTFOUND|getaddrinfo/i.test(msg) && parsed.host.startsWith('db.')) {
      console.warn(`${parsed.host} sin IPv4; probando pooler Supabase…`);
      const pooled = await tryPooler(parsed, opts, projectRef);
      if (pooled) return pooled;
    }
    throw e;
  }
}

async function main() {
  const envPath = path.join(root, '.env.local');
  if (!fs.existsSync(envPath)) {
    console.error('Falta .env.local con DATABASE_URL');
    process.exit(1);
  }
  const env = parseEnvFile(fs.readFileSync(envPath, 'utf8'));
  const url = (env.DATABASE_URL || env.SUPABASE_DB_URL)?.trim();
  if (!url) {
    console.error('DATABASE_URL no definido');
    process.exit(1);
  }

  const projectRef =
    env.NEXT_PUBLIC_SUPABASE_URL?.match(/https:\/\/([^.]+)\.supabase\.co/)?.[1] ?? '';
  const sql = await connectPostgres(url, projectRef || 'unknown');

  try {
    await sql.unsafe("notify pgrst, 'reload schema'");
    console.log("OK: notify pgrst, 'reload schema'");
  } finally {
    await sql.end({ timeout: 5 });
  }
}

main().catch((e) => {
  console.error('Error:', e instanceof Error ? e.message : e);
  process.exit(1);
});
