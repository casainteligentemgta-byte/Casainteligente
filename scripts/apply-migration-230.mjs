/**
 * Departamento compras Telegram (migración 230) + notify pgrst.
 * Uso: node scripts/apply-migration-230.mjs
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import postgres from 'postgres';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');
const envPath = path.join(root, '.env.local');
const migrationPath = path.join(root, 'supabase/migrations/230_ci_compras_departamento_telegram.sql');

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
  let lastErr = '';

  const preferred = [
    ['aws-1-us-east-1.pooler.supabase.com', 6543],
    ['aws-0-us-east-1.pooler.supabase.com', 6543],
    ['aws-1-us-east-1.pooler.supabase.com', 5432],
  ];

  for (const [host, port] of preferred) {
    try {
      const sql = postgres({ ...parsed, ...opts, host, port, user, ssl });
      await sql`select 1`;
      console.log(`✅ Conectado vía pooler ${host}:${port}\n`);
      return sql;
    } catch (e) {
      lastErr = e instanceof Error ? e.message : String(e);
    }
  }

  const regions = ['us-east-1', 'us-west-1', 'eu-west-1', 'eu-central-1', 'sa-east-1'];
  for (const region of regions) {
    for (const host of [
      `aws-0-${region}.pooler.supabase.com`,
      `aws-1-${region}.pooler.supabase.com`,
    ]) {
      for (const port of [6543, 5432]) {
        try {
          const sql = postgres({ ...parsed, ...opts, host, port, user, ssl });
          await sql`select 1`;
          console.log(`✅ Conectado vía pooler ${host}:${port}\n`);
          return sql;
        } catch (e) {
          lastErr = e instanceof Error ? e.message : String(e);
        }
      }
    }
  }

  if (lastErr) console.warn(`⚠️  Pooler: ${lastErr.slice(0, 200)}`);
  return null;
}

async function connectPostgres(url, projectRef, env) {
  const opts = { max: 1, prepare: false, connect_timeout: 25 };
  const poolerUrl = env.DATABASE_POOLER_URL?.trim();
  if (poolerUrl) {
    const parsed = parsePgUrl(poolerUrl);
    if (parsed) {
      const sql = postgres({ ...parsed, ...opts, ssl: { rejectUnauthorized: false } });
      await sql`select 1`;
      console.log('✅ Conectado con DATABASE_POOLER_URL\n');
      return sql;
    }
  }

  const parsed = parsePgUrl(url);
  if (!parsed) throw new Error('DATABASE_URL inválida');

  if (parsed.host.includes('pooler.supabase.com')) {
    const sql = postgres({ ...parsed, ...opts, ssl: { rejectUnauthorized: false } });
    await sql`select 1`;
    console.log(`✅ Conectado con pooler en DATABASE_URL (${parsed.host})\n`);
    return sql;
  }

  if (projectRef) {
    const pooledFirst = await tryPooler(parsed, opts, projectRef);
    if (pooledFirst) return pooledFirst;
  }

  let sql = postgres({ ...parsed, ...opts, ssl: { rejectUnauthorized: false } });
  try {
    await sql`select 1`;
    console.log('✅ Conectado a Postgres\n');
    return sql;
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    await sql.end({ timeout: 1 }).catch(() => {});
    if (/ENOTFOUND|getaddrinfo|ECONNREFUSED|timeout/i.test(msg) && projectRef) {
      console.warn(`⚠️  ${parsed.host} no accesible; reintentando pooler…`);
      const pooled = await tryPooler(parsed, opts, projectRef);
      if (pooled) return pooled;
    }
    throw e;
  }
}

async function tableExists(sql, table) {
  const rows = await sql`
    select 1 from information_schema.tables
    where table_schema = 'public' and table_name = ${table}
    limit 1
  `;
  return rows.length > 0;
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
  const sql = await connectPostgres(url, projectRef || 'unknown', env);

  try {
    const yaExiste = await tableExists(sql, 'ci_compras_capitulos_maestro');
    if (yaExiste) {
      console.log('✅ Migración 230 ya aplicada (ci_compras_capitulos_maestro existe).');
      console.log('   Ejecutando notify pgrst…');
      await sql.unsafe(`notify pgrst, 'reload schema';`);
      console.log('✅ PostgREST schema cache recargado.');
    } else {
      console.log('Aplicando 230_ci_compras_departamento_telegram.sql…');
      await sql.unsafe(sqlText);
      console.log('✅ Migración 230 aplicada.');
    }

    const caps = await sql`
      select codigo, nombre from public.ci_compras_capitulos_maestro
      where activo = true order by codigo
    `;
    console.log(`\nCapítulos maestro (${caps.length}):`);
    for (const c of caps) console.log(`  • ${c.codigo} — ${c.nombre}`);

    const usuarios = await sql`
      select count(*)::int as n from public.ci_usuarios_sistema_telegram where activo = true
    `;
    console.log(`\nUsuarios Telegram activos: ${usuarios[0]?.n ?? 0}`);
  } finally {
    await sql.end({ timeout: 5 });
  }
}

main().catch((e) => {
  console.error('❌', e instanceof Error ? e.message : e);
  process.exit(1);
});
