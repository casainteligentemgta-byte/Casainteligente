/**
 * Abastecimiento procura / almacén (migración 240).
 * Uso: node scripts/apply-migration-240.mjs
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import postgres from 'postgres';
import { createClient } from '@supabase/supabase-js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');
const envPath = path.join(root, '.env.local');
const migrationPath = path.join(
  root,
  'supabase/migrations/240_ci_procura_abastecimiento_almacen.sql',
);

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
  const ssl = { rejectUnauthorized: false };
  const user = parsed.user.includes('.') ? parsed.user : `postgres.${projectRef}`;
  for (const [host, port] of [
    ['aws-1-us-east-1.pooler.supabase.com', 6543],
    ['aws-0-us-east-1.pooler.supabase.com', 6543],
  ]) {
    try {
      const sql = postgres({ ...parsed, ...opts, host, port, user, ssl });
      await sql`select 1`;
      console.log(`Conectado vía pooler ${host}:${port}`);
      return sql;
    } catch {
      /* siguiente */
    }
  }
  return null;
}

async function connectPostgres(url, projectRef, env) {
  const opts = { max: 1, prepare: false, connect_timeout: 15 };
  const parsed = parsePgUrl(url);
  if (!parsed) throw new Error('DATABASE_URL inválida');
  if (projectRef) {
    const pooled = await tryPooler(parsed, opts, projectRef);
    if (pooled) return pooled;
  }
  const sql = postgres({ ...parsed, ...opts, ssl: { rejectUnauthorized: false } });
  await sql`select 1`;
  return sql;
}

async function verify(env) {
  const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
  });
  const { error } = await sb.from('ci_procuras').select('cantidad_despacho').limit(1);
  if (error?.message?.includes('cantidad_despacho')) {
    console.error('Columnas 240 no presentes. Aplique SQL manual en Supabase.');
    return false;
  }
  console.log('Verificación OK: columnas abastecimiento accesibles.');
  return true;
}

async function main() {
  if (!fs.existsSync(envPath)) {
    console.error('Falta .env.local');
    process.exit(1);
  }
  const env = parseEnvFile(fs.readFileSync(envPath, 'utf8'));
  const url = env.DATABASE_URL?.trim();
  if (!url) {
    console.error('Falta DATABASE_URL');
    process.exit(1);
  }
  const projectRef =
    env.NEXT_PUBLIC_SUPABASE_URL?.match(/https:\/\/([^.]+)\.supabase\.co/)?.[1] ?? '';
  const sqlText = fs.readFileSync(migrationPath, 'utf8');
  const sql = await connectPostgres(url, projectRef, env);
  try {
    console.log('Aplicando 240_ci_procura_abastecimiento_almacen.sql…');
    await sql.unsafe(sqlText);
    await sql.unsafe(`notify pgrst, 'reload schema';`);
    console.log('Migración 240 aplicada.');
  } finally {
    await sql.end({ timeout: 5 });
  }
  await verify(env);
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
