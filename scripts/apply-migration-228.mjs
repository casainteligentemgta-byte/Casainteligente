/**
 * Tabla ci_alertas_config (migración 228) + notify pgrst.
 * Uso: node scripts/apply-migration-228.mjs
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import postgres from 'postgres';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');
const envPath = path.join(root, '.env.local');
const migrationPath = path.join(root, 'supabase/migrations/228_ci_alertas_config.sql');

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
        console.log(`✅ Conectado vía pooler ${host}:6543\n`);
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
      console.log('✅ Conectado con DATABASE_POOLER_URL\n');
      return sql;
    }
  }

  const parsed = parsePgUrl(url);
  const cfg = parsed ? { ...parsed, ...opts } : url;
  let sql = postgres(cfg);
  try {
    await sql`select 1`;
    console.log('✅ Conectado a Postgres\n');
    return sql;
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    await sql.end({ timeout: 1 }).catch(() => {});
    if (!parsed) throw e;
    if (/ENOTFOUND|getaddrinfo/i.test(msg) && parsed.host.startsWith('db.')) {
      console.warn(`⚠️  ${parsed.host} sin IPv4; probando pooler Supabase…`);
      const pooled = await tryPooler(parsed, opts, projectRef);
      if (pooled) return pooled;
    }
    throw e;
  }
}

async function main() {
  if (!fs.existsSync(envPath)) {
    console.error('❌ Falta .env.local con DATABASE_URL');
    process.exit(1);
  }
  const env = parseEnvFile(fs.readFileSync(envPath, 'utf8'));
  const url = env.DATABASE_URL?.trim();
  if (!url) {
    console.error('❌ DATABASE_URL vacía');
    process.exit(1);
  }

  const projectRef =
    env.NEXT_PUBLIC_SUPABASE_URL?.match(/https:\/\/([^.]+)\.supabase\.co/)?.[1] ?? '';
  const sqlText = fs.readFileSync(migrationPath, 'utf8');
  const sql = await connectPostgres(url, projectRef || 'unknown');

  try {
    const exists = await sql`
      select 1 from information_schema.tables
      where table_schema = 'public' and table_name = 'ci_alertas_config'
    `;
    if (exists.length > 0) {
      console.log('✅ ci_alertas_config ya existe; ejecutando notify pgrst…');
      await sql.unsafe(`notify pgrst, 'reload schema';`);
      console.log('✅ PostgREST schema cache recargado.');
      return;
    }

    console.log('Aplicando 228_ci_alertas_config.sql…');
    await sql.unsafe(sqlText);
    console.log('✅ Tabla ci_alertas_config creada y notify pgrst enviado.');
  } finally {
    await sql.end({ timeout: 5 });
  }
}

main().catch((e) => {
  console.error('❌', e instanceof Error ? e.message : e);
  process.exit(1);
});
