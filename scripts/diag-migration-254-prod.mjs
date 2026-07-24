/**
 * Solo lectura — verifica migración 254 en prod (RLS, FK, RPC 250).
 *
 * Requiere DATABASE_URL (pooler) en .env.local.
 * Uso: node scripts/diag-migration-254-prod.mjs
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import postgres from 'postgres';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');

function parseEnvFile(content) {
  const out = {};
  for (const line of content.split(/\r?\n/)) {
    const t = line.trim();
    if (!t || t.startsWith('#')) continue;
    const i = t.indexOf('=');
    if (i === -1) continue;
    let val = t.slice(i + 1).trim();
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    out[t.slice(0, i).trim()] = val;
  }
  return out;
}

function parsePgUrl(url) {
  const m = url.match(/^postgresql:\/\/([^:]+):([^@]*)@([^:/]+)(?::(\d+))?\/([^?]+)/);
  if (!m) return null;
  return {
    user: decodeURIComponent(m[1]),
    password: decodeURIComponent(m[2]),
    host: m[3],
    port: m[4] ? Number(m[4]) : 5432,
    database: m[5],
    ssl: { rejectUnauthorized: false },
  };
}

async function connect() {
  const env = parseEnvFile(fs.readFileSync(path.join(root, '.env.local'), 'utf8'));
  const url = (env.DATABASE_URL || env.SUPABASE_DB_URL)?.trim();
  if (!url) throw new Error('DATABASE_URL no definida en .env.local');
  const ref = env.NEXT_PUBLIC_SUPABASE_URL?.match(/https:\/\/([^.]+)\.supabase\.co/)?.[1] ?? '';
  const parsed = parsePgUrl(url);
  const opts = { max: 1, prepare: false };
  let sql = postgres({ ...parsed, ...opts });
  try {
    await sql`select 1`;
  } catch {
    await sql.end({ timeout: 1 }).catch(() => {});
    const user = parsed.user.includes('.') ? parsed.user : `postgres.${ref}`;
    sql = postgres({
      ...parsed,
      ...opts,
      host: 'aws-1-us-east-1.pooler.supabase.com',
      port: 6543,
      user,
    });
    await sql`select 1`;
  }
  return sql;
}

async function main() {
  const sql = await connect();

  console.log('=== 1) RLS tablas criticas ===');
  const rls = await sql`
    SELECT c.relname AS tabla, c.relrowsecurity AS rls_activo
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public'
      AND c.relname IN ('customers','ci_proyectos','ci_entidades','contabilidad_compras')
    ORDER BY c.relname
  `;
  console.table(rls);

  console.log('\n=== 2) FK contabilidad_compra_id en ci_recepciones_campo ===');
  const fk = await sql`
    SELECT
      tc.constraint_name,
      kcu.column_name,
      ccu.table_schema AS ref_schema,
      ccu.table_name AS ref_table,
      ccu.column_name AS ref_column,
      rc.delete_rule
    FROM information_schema.table_constraints tc
    JOIN information_schema.key_column_usage kcu
      ON tc.constraint_schema = kcu.constraint_schema
     AND tc.constraint_name = kcu.constraint_name
    JOIN information_schema.constraint_column_usage ccu
      ON ccu.constraint_schema = tc.constraint_schema
     AND ccu.constraint_name = tc.constraint_name
    JOIN information_schema.referential_constraints rc
      ON rc.constraint_schema = tc.constraint_schema
     AND rc.constraint_name = tc.constraint_name
    WHERE tc.table_schema = 'public'
      AND tc.table_name = 'ci_recepciones_campo'
      AND tc.constraint_type = 'FOREIGN KEY'
      AND kcu.column_name = 'contabilidad_compra_id'
  `;
  console.table(fk);

  console.log('\n=== 3) RPC ci_conciliar_frm_con_factura_canal (250) ===');
  const rpc = await sql`
    SELECT p.proname, p.prosecdef AS security_definer, pg_get_function_identity_arguments(p.oid) AS args
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname = 'ci_conciliar_frm_con_factura_canal'
  `;
  console.table(rpc);

  const fkOk = fk.length > 0 && fk[0].ref_table === 'contabilidad_compras';
  const rpcOk = rpc.length > 0 && rpc[0].security_definer === true;

  console.log('\n=== VEREDICTO ===');
  console.log(
    fkOk
      ? 'OK 254: FK ci_recepciones_campo_contabilidad_compra_id_fkey -> contabilidad_compras(id)'
      : 'FALTA 254: aplicar supabase/migrations/254_ci_recepciones_campo_contabilidad_compra_repair.sql',
  );
  console.log(
    rpcOk
      ? 'OK 250: RPC ci_conciliar_frm_con_factura_canal (SECURITY DEFINER)'
      : 'FALTA 250: aplicar supabase/migrations/250_ci_conciliar_frm_con_factura_canal.sql + notify pgrst',
  );

  await sql.end({ timeout: 5 });
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
