/**
 * Documentos legales: migraciones 271 + 272 (y 266 si falta la base).
 * Uso: node scripts/apply-migration-271-272-legal-documentos.mjs
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import postgres from 'postgres';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');
const envPath = path.join(root, '.env.local');

const MIGRATIONS = [
  '266_ci_departamento_legal.sql',
  '271_ci_legal_documentos.sql',
  '272_ci_legal_documentos_estructurado.sql',
];

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
  const opts = { max: 1, prepare: false, connect_timeout: 15 };
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

  const sql = postgres({ ...parsed, ...opts, ssl: { rejectUnauthorized: false } });
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

async function main() {
  if (!fs.existsSync(envPath)) {
    console.error('❌ Falta .env.local');
    process.exit(1);
  }
  const env = parseEnvFile(fs.readFileSync(envPath, 'utf8'));
  const url = env.DATABASE_URL?.trim();
  if (!url) throw new Error('DATABASE_URL vacía');

  const projectRef =
    env.NEXT_PUBLIC_SUPABASE_URL?.match(/https:\/\/([^.]+)\.supabase\.co/)?.[1] ||
    url.match(/@db\.([^.]+)\.supabase\.co/)?.[1] ||
    '';
  if (!projectRef) throw new Error('No se pudo resolver projectRef de Supabase');
  console.log(`Project: ${projectRef}`);
  const sql = await connectPostgres(url, projectRef, env);

  try {
    const base = await sql`
      select to_regclass('public.ci_legal_orgs') is not null as orgs,
             to_regclass('public.ci_legal_documentos') is not null as docs,
             to_regclass('public.ci_legal_plantillas') is not null as plantillas
    `;
    console.log('Estado previo:', base[0]);

    for (const name of MIGRATIONS) {
      if (name.startsWith('266') && base[0].orgs) {
        console.log(`⏭  Omite ${name} (ci_legal_orgs ya existe)`);
        continue;
      }
      if (name.startsWith('271') && base[0].docs && base[0].plantillas) {
        console.log(`⏭  Omite ${name} (tablas 271 ya existen) — se reaplicará por idempotencia parcial`);
      }
      const file = path.join(root, 'supabase/migrations', name);
      if (!fs.existsSync(file)) throw new Error(`No existe ${file}`);
      console.log(`Aplicando ${name}…`);
      await sql.unsafe(fs.readFileSync(file, 'utf8'));
      console.log(`✅ ${name}`);
    }

    await sql.unsafe(`notify pgrst, 'reload schema';`);

    const cols = await sql`
      select column_name
      from information_schema.columns
      where table_schema = 'public'
        and table_name = 'ci_legal_documentos'
        and column_name = 'cuerpo_estructurado'
    `;
    const count = await sql`select count(*)::int as n from public.ci_legal_plantillas`;
    console.log('\nVerificación:');
    console.log(`  • ci_legal_documentos.cuerpo_estructurado: ${cols.length ? 'OK' : 'FALTA'}`);
    console.log(`  • plantillas seed: ${count[0].n}`);
    console.log('✅ Migraciones legales 271/272 aplicadas + schema reload');
  } finally {
    await sql.end({ timeout: 5 });
  }
}

main().catch((e) => {
  console.error('❌', e instanceof Error ? e.message : e);
  process.exit(1);
});
