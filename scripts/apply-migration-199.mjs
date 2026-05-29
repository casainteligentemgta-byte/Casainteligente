/**
 * Aplica migración 199 (recepciones campo FRM).
 * Uso: node scripts/apply-migration-199.mjs
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import postgres from 'postgres';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');
const envPath = path.join(root, '.env.local');
const FILE = '199_ci_recepciones_provisionales_campo.sql';

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

async function main() {
  const env = parseEnvFile(fs.readFileSync(envPath, 'utf8'));
  const url = (env.DATABASE_URL || env.SUPABASE_DB_URL)?.trim();
  const projectRef = env.NEXT_PUBLIC_SUPABASE_URL?.match(/https:\/\/([^.]+)\.supabase\.co/)?.[1] ?? '';
  if (!url) throw new Error('Falta DATABASE_URL');

  const opts = { max: 1, prepare: false, connect_timeout: 25 };
  const parsed = parsePgUrl(url);
  let sql = postgres({ ...parsed, ...opts });
  try {
    await sql`select 1`;
  } catch (e) {
    await sql.end({ timeout: 1 }).catch(() => {});
    const user = parsed.user.includes('.') ? parsed.user : `postgres.${projectRef}`;
    sql = postgres({
      ...parsed,
      ...opts,
      host: 'aws-1-us-east-1.pooler.supabase.com',
      port: 6543,
      user,
    });
    await sql`select 1`;
    console.log('Conectado vía pooler\n');
  }

  try {
    const body = fs.readFileSync(path.join(root, 'supabase', 'migrations', FILE), 'utf8');
    console.log(`Aplicando ${FILE}…`);
    await sql.unsafe(body);
    console.log(`OK ${FILE}`);
  } finally {
    await sql.end({ timeout: 5 }).catch(() => {});
  }
}

main().catch((e) => {
  console.error(e.message || e);
  process.exit(1);
});
