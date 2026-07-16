/**
 * Añade updated_at a contabilidad_compras (229) + auditoría fecha (221) si faltan.
 * Uso: node scripts/apply-migration-229.mjs
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
  if (parsed && projectRef) {
    const pooledFirst = await tryPooler(parsed, opts, projectRef);
    if (pooledFirst) return pooledFirst;
  }

  const cfg = parsed ? { ...parsed, ...opts, ssl: { rejectUnauthorized: false } } : url;
  let sql = postgres(cfg);
  try {
    await sql`select 1`;
    console.log('✅ Conectado a Postgres\n');
    return sql;
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    await sql.end({ timeout: 1 }).catch(() => {});
    if (!parsed) throw e;
    if (/ENOTFOUND|getaddrinfo|ECONNREFUSED|timeout/i.test(msg) && projectRef) {
      console.warn(`⚠️  ${parsed.host} no accesible; reintentando pooler…`);
      const pooled = await tryPooler(parsed, opts, projectRef);
      if (pooled) return pooled;
    }
    throw e;
  }
}

async function columnExists(sql, table, column) {
  const rows = await sql`
    select 1 from information_schema.columns
    where table_schema = 'public'
      and table_name = ${table}
      and column_name = ${column}
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
  const sql = await connectPostgres(url, projectRef || 'unknown', env);

  const checks = [
    ['contabilidad_compras', 'alerta_fecha'],
    ['contabilidad_compras', 'fecha_confirmada_manual'],
    ['contabilidad_compras', 'updated_at'],
  ];

  try {
    for (const [table, col] of checks) {
      const ok = await columnExists(sql, table, col);
      console.log(`${table}.${col}: ${ok ? '✓' : '✗ falta'}`);
    }

    const mig221 = path.join(root, 'supabase/migrations/221_compras_auditoria_fecha.sql');
    if (!(await columnExists(sql, 'contabilidad_compras', 'alerta_fecha'))) {
      console.log('\nAplicando 221_compras_auditoria_fecha.sql…');
      await sql.unsafe(fs.readFileSync(mig221, 'utf8'));
      console.log('✅ 221 aplicada.');
    }

    const mig229 = path.join(root, 'supabase/migrations/229_contabilidad_compras_updated_at.sql');
    if (!(await columnExists(sql, 'contabilidad_compras', 'updated_at'))) {
      console.log('\nAplicando 229_contabilidad_compras_updated_at.sql…');
      await sql.unsafe(fs.readFileSync(mig229, 'utf8'));
      console.log('✅ 229 aplicada.');
    } else {
      console.log('\n⏭  updated_at ya existe; notify pgrst…');
      await sql.unsafe(`notify pgrst, 'reload schema';`);
    }

    console.log('\nColumnas finales:');
    const cols = await sql`
      select column_name from information_schema.columns
      where table_schema = 'public' and table_name = 'contabilidad_compras'
        and column_name in ('updated_at', 'alerta_fecha', 'fecha_confirmada_manual')
      order by column_name
    `;
    for (const c of cols) console.log(`  ✓ ${c.column_name}`);
  } finally {
    await sql.end({ timeout: 5 });
  }
}

main().catch((e) => {
  console.error('❌', e instanceof Error ? e.message : e);
  process.exit(1);
});
