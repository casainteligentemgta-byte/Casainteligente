/**
 * Aplica migraciones 193–196 (Telegram nota entrega, movimientos obra, compras entidad).
 * Uso: node scripts/apply-migrations-193-195.mjs
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import postgres from 'postgres';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');
const envPath = path.join(root, '.env.local');

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

const FILES = [
  '193_ci_telegram_nota_entrega.sql',
  '194_ci_obra_movimientos_capitulo.sql',
  '195_ci_obra_movimientos_transferencia.sql',
  '196_compras_entidad_destino.sql',
];

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
  const prefixes = ['aws-1', 'aws-0'];
  for (const prefix of prefixes) {
    for (const region of regions) {
      const host = `${prefix}-${region}.pooler.supabase.com`;
      const user = parsed.user.includes('.') ? parsed.user : `postgres.${projectRef}`;
      try {
        const sql = postgres({
          ...parsed,
          ...opts,
          host,
          port: 6543,
          user,
        });
        await sql`select 1`;
        console.log(`✅ Conectado vía pooler ${host}:6543 (${user})\n`);
        return sql;
      } catch {
        /* siguiente región */
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
      console.warn(`⚠️  ${parsed.host} sin IPv4 en este equipo; probando pooler Supabase…`);
      const pooled = await tryPooler(parsed, opts, projectRef);
      if (pooled) return pooled;
    }
    throw e;
  }
}

async function main() {
  if (!fs.existsSync(envPath)) {
    console.error('Falta .env.local con DATABASE_URL');
    process.exit(1);
  }
  const env = parseEnvFile(fs.readFileSync(envPath, 'utf8'));
  const url = (env.DATABASE_URL || env.SUPABASE_DB_URL)?.trim();
  if (!url) {
    console.error('DATABASE_URL o SUPABASE_DB_URL no definido en .env.local');
    process.exit(1);
  }

  const projectRef =
    env.NEXT_PUBLIC_SUPABASE_URL?.match(/https:\/\/([^.]+)\.supabase\.co/)?.[1] ?? '';
  const sql = await connectPostgres(url, projectRef || 'unknown');

  try {
    for (const file of FILES) {
      const body = fs.readFileSync(path.join(root, 'supabase', 'migrations', file), 'utf8');
      console.log(`Aplicando ${file}…`);
      await sql.unsafe(body);
      console.log(`OK ${file}`);
    }
    console.log('Migraciones 193–196 aplicadas.');
  } finally {
    await sql.end({ timeout: 5 }).catch(() => {});
  }
}

main().catch((e) => {
  console.error(e.message || e);
  process.exit(1);
});
