/**
 * Capítulos APU para /procura (migración 239).
 * Uso: node scripts/apply-migration-239.mjs
 *
 * Intenta Postgres directo/pooler; si falla DNS, aplica vía API Supabase (HTTPS).
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import postgres from 'postgres';
import { createClient } from '@supabase/supabase-js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');
const envPath = path.join(root, '.env.local');
const migrationPath = path.join(root, 'supabase/migrations/239_ci_procura_capitulos_apu_catalogo.sql');

const CAPITULOS_PROCURA_APU = [
  { codigo: '01', nombre: 'Demolición y obras provisionales' },
  { codigo: '02', nombre: 'Estructura' },
  { codigo: '03', nombre: 'Albañilería' },
  { codigo: '04', nombre: 'Instalaciones eléctricas' },
  { codigo: '05', nombre: 'Instalaciones sanitarias' },
  { codigo: '06', nombre: 'Pozo de agua' },
  { codigo: '07', nombre: 'Piscina' },
  { codigo: '08', nombre: 'Muro ciclópeo' },
];

const CODIGOS_LEGACY = ['CAP-I', 'CAP-II', 'CAP-III', 'CAP-IV', 'CAP-V'];

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

async function aplicarViaApi(env) {
  const url = env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const key = env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!url || !key) {
    throw new Error('Faltan NEXT_PUBLIC_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY');
  }

  console.log('Aplicando migración 239 vía API Supabase (HTTPS)…');
  const sb = createClient(url, key, { auth: { persistSession: false } });

  const { error: legacyErr } = await sb
    .from('ci_compras_capitulos_maestro')
    .update({ activo: false })
    .in('codigo', CODIGOS_LEGACY);
  if (legacyErr) throw new Error(legacyErr.message);

  for (const cap of CAPITULOS_PROCURA_APU) {
    const { error } = await sb.from('ci_compras_capitulos_maestro').upsert(
      { codigo: cap.codigo, nombre: cap.nombre, activo: true },
      { onConflict: 'codigo' },
    );
    if (error) throw new Error(error.message);
  }

  const { data: caps, error: listErr } = await sb
    .from('ci_compras_capitulos_maestro')
    .select('codigo, nombre')
    .eq('activo', true)
    .order('codigo');
  if (listErr) throw new Error(listErr.message);

  console.log(`✅ Migración 239 aplicada (${caps?.length ?? 0} capítulos activos):`);
  for (const c of caps ?? []) console.log(`  • ${c.codigo} — ${c.nombre}`);
}

async function aplicarViaPostgres(env) {
  const url = env.DATABASE_URL?.trim();
  if (!url) throw new Error('DATABASE_URL vacía');

  const projectRef =
    env.NEXT_PUBLIC_SUPABASE_URL?.match(/https:\/\/([^.]+)\.supabase\.co/)?.[1] ?? '';
  const sqlText = fs.readFileSync(migrationPath, 'utf8');
  const sql = await connectPostgres(url, projectRef || 'unknown', env);

  try {
    console.log('Aplicando 239_ci_procura_capitulos_apu_catalogo.sql…');
    await sql.unsafe(sqlText);
    await sql.unsafe(`notify pgrst, 'reload schema';`);

    const caps = await sql`
      select codigo, nombre from public.ci_compras_capitulos_maestro
      where activo = true order by codigo
    `;
    console.log(`✅ Migración 239 aplicada (${caps.length} capítulos activos):`);
    for (const c of caps) console.log(`  • ${c.codigo} — ${c.nombre}`);
  } finally {
    await sql.end({ timeout: 5 });
  }
}

async function main() {
  if (!fs.existsSync(envPath)) {
    console.error('❌ Falta .env.local');
    process.exit(1);
  }
  const env = parseEnvFile(fs.readFileSync(envPath, 'utf8'));

  try {
    await aplicarViaPostgres(env);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (/ENOTFOUND|getaddrinfo|ECONNREFUSED|timeout|Pooler/i.test(msg)) {
      console.warn(`\n⚠️  Postgres no disponible (${msg.slice(0, 120)})\n`);
      await aplicarViaApi(env);
      return;
    }
    throw e;
  }
}

main().catch((e) => {
  console.error('❌', e instanceof Error ? e.message : e);
  process.exit(1);
});
