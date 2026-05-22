/**
 * Aplica migraciones 146, 149, 151, 152 si faltan tablas/columnas.
 * Uso: npm run db:apply-lulo-telegram
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

const MIGRATIONS = [
  '146_ci_presupuesto_partidas.sql',
  '149_gastos_obra_proyecto_origen.sql',
  '151_ci_lulo_import_snapshots.sql',
  '152_facturas_canal_telegram.sql',
  '157_ci_lulo_insumos_apu.sql',
  '158_ci_presupuesto_partidas_capitulo.sql',
  '159_ci_presupuesto_gastos_numeric_widen.sql',
  '160_ci_telegram_estados.sql',
];

async function tableExists(sql, name) {
  const rows = await sql`
    select 1 from pg_catalog.pg_class c
    join pg_catalog.pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relkind = 'r' and c.relname = ${name}
  `;
  return rows.length > 0;
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
  let sql = await connectPostgres(url, projectRef || 'unknown');

  try {
    const checks = {
      '146_ci_presupuesto_partidas.sql': () => tableExists(sql, 'ci_presupuesto_partidas'),
      '149_gastos_obra_proyecto_origen.sql': async () => {
        if (!(await tableExists(sql, 'gastos_obra'))) return false;
        const cols = await sql`
          select column_name from information_schema.columns
          where table_schema = 'public' and table_name = 'gastos_obra' and column_name = 'proyecto_id'
        `;
        return cols.length > 0;
      },
      '151_ci_lulo_import_snapshots.sql': () => tableExists(sql, 'ci_lulo_import_snapshots'),
      '152_facturas_canal_telegram.sql': () => tableExists(sql, 'ci_facturas_canal_pendientes'),
      '157_ci_lulo_insumos_apu.sql': () => tableExists(sql, 'ci_lulo_insumos_maestro'),
      '158_ci_presupuesto_partidas_capitulo.sql': async () => {
        if (!(await tableExists(sql, 'ci_presupuesto_partidas'))) return false;
        const cols = await sql`
          select column_name from information_schema.columns
          where table_schema = 'public' and table_name = 'ci_presupuesto_partidas' and column_name = 'capitulo_codigo'
        `;
        return cols.length > 0;
      },
      '159_ci_presupuesto_gastos_numeric_widen.sql': async () => {
        const cols = await sql`
          select numeric_precision, numeric_scale
          from information_schema.columns
          where table_schema = 'public'
            and table_name = 'ci_presupuesto_partidas'
            and column_name = 'monto_total_estimado'
        `;
        return cols.length > 0 && Number(cols[0].numeric_precision) >= 18;
      },
      '160_ci_telegram_estados.sql': () => tableExists(sql, 'ci_telegram_estados'),
    };

    for (const file of MIGRATIONS) {
      const checkFn = checks[file];
      const exists = checkFn ? await checkFn() : false;
      if (exists) {
        console.log(`⏭️  ${file} — ya aplicada`);
        continue;
      }
      const fullPath = path.join(root, 'supabase', 'migrations', file);
      if (!fs.existsSync(fullPath)) {
        console.error(`❌ No existe ${fullPath}`);
        continue;
      }
      const body = fs.readFileSync(fullPath, 'utf8');
      console.log(`▶️  Ejecutando ${file}…`);
      try {
        await sql.unsafe(body);
        console.log(`✅ ${file}`);
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        if (/already exists|duplicate/i.test(msg)) {
          console.log(`⚠️  ${file} — parcial (${msg.slice(0, 80)})`);
        } else if (/cannot alter type of a column used by a view|rule/i.test(msg)) {
          console.log(
            `⚠️  ${file} — omitida (vista dependiente). Los montos se acotan al importar en la app.`,
          );
        } else {
          throw e;
        }
      }
    }

    console.log('\n✅ Migraciones Lulo/Telegram revisadas.');
  } finally {
    if (sql) await sql.end({ timeout: 5 }).catch(() => {});
  }
}

main().catch((e) => {
  console.error('❌', e.message || e);
  process.exit(1);
});
