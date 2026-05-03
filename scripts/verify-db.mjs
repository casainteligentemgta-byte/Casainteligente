/**
 * Verifica DATABASE_URL (.env.local) y tablas mínimas para reclutamiento + módulo proyectos.
 * Uso: npm run verify:db
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

const REQUIRED = ['recruitment_needs', 'ci_proyectos'];

async function main() {
  console.log('Casa Inteligente — verificación DATABASE_URL + tablas\n');

  if (!fs.existsSync(envPath)) {
    console.error('❌ No existe .env.local. Cópialo desde .env.example y define DATABASE_URL.\n');
    process.exit(1);
  }

  const env = parseEnvFile(fs.readFileSync(envPath, 'utf8'));
  const url = env.DATABASE_URL?.trim();

  if (!url) {
    console.error('❌ DATABASE_URL está vacía en .env.local.\n');
    console.error('Cómo obtenerla (Supabase):');
    console.error('  1) Dashboard del proyecto → ⚙️ Project Settings → Database');
    console.error('  2) Connection string → URI (modo "Session" o conexión directa).');
    console.error('  3) Pega la URI en .env.local como DATABASE_URL=postgresql://...\n');
    console.error('Importante: debe ser la MISMA base donde aplicas las migraciones SQL del repo.\n');
    process.exit(1);
  }

  /** Oculta password en logs */
  const safe = url.replace(/:([^:@/]+)@/, ':***@');
  console.log('Conectando con:', safe, '\n');

  const sql = postgres(url, { max: 1, prepare: false, connect_timeout: 15 });

  try {
    await sql`select 1 as ok`;
    console.log('✅ Conexión TCP/SSL a Postgres correcta.\n');
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error('❌ No se pudo conectar:', msg);
    if (/ENOTFOUND|getaddrinfo/i.test(msg)) {
      console.error('\nEl host de DATABASE_URL no existe en DNS (proyecto borrado, URL antigua o typo).');
      console.error('Vuelve a copiar la URI en: Supabase → Project Settings → Database → Connection string.\n');
    } else {
      console.error('\nRevisa: contraseña, host, puerto (5432 directo o 6543 pooler), ?sslmode=require\n');
    }
    await sql.end({ timeout: 1 }).catch(() => {});
    process.exit(1);
  }

  try {
    const rows = await sql`
      select c.relname as name
      from pg_catalog.pg_class c
      join pg_catalog.pg_namespace n on n.oid = c.relnamespace
      where n.nspname = 'public'
        and c.relkind = 'r'
        and c.relname in ${sql(REQUIRED)}
    `;
    const found = new Set(rows.map((r) => r.name));
    const missing = REQUIRED.filter((t) => !found.has(t));

    if (missing.length === 0) {
      console.log('✅ Tablas presentes:', [...found].join(', '));
      console.log('\nSi la API sigue fallando, revisa que el UUID del proyecto exista en ci_proyectos.\n');
    } else {
      console.error('❌ Faltan tablas en el esquema public:', missing.join(', '));
      console.error('\nAplica las migraciones del repo en ESTE proyecto de Supabase, en orden, por ejemplo:');
      console.error('  supabase/migrations/031_recruitment_needs.sql');
      console.error('  supabase/migrations/032_recruitment_needs_cargo.sql');
      console.error('  supabase/migrations/034_proyecto_presupuesto_recruitment.sql');
      console.error('  supabase/migrations/037_ci_proyectos_modulo_integral.sql  (requiere customers, budgets previos)');
      console.error('  supabase/migrations/047_recruitment_needs_override_modulo.sql');
      console.error('  supabase/migrations/049_recruitment_needs_tipo_empleado.sql  (tipo_vacante empleado)');
      console.error('\nOpciones:');
      console.error('  • Supabase → SQL Editor → pega y ejecuta cada archivo (respeta dependencias).');
      console.error('  • O CLI: supabase link && supabase db push (si usas Supabase CLI con este repo).\n');
    }
  } catch (e) {
    console.error('❌ Error al inspeccionar tablas:', e.message || e);
  } finally {
    await sql.end({ timeout: 5 }).catch(() => {});
  }
}

main();
