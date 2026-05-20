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
];

async function tableExists(sql, name) {
  const rows = await sql`
    select 1 from pg_catalog.pg_class c
    join pg_catalog.pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relkind = 'r' and c.relname = ${name}
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

  const sql = postgres(url, { max: 1, prepare: false, connect_timeout: 20 });

  try {
    await sql`select 1`;
    console.log('✅ Conectado a Postgres\n');

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
    };

    for (const file of MIGRATIONS) {
      const exists = await checks[file]();
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
        } else {
          throw e;
        }
      }
    }

    console.log('\n✅ Migraciones Lulo/Telegram revisadas.');
  } finally {
    await sql.end({ timeout: 5 }).catch(() => {});
  }
}

main().catch((e) => {
  console.error('❌', e.message || e);
  process.exit(1);
});
