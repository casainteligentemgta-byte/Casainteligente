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

async function main() {
  const env = parseEnvFile(fs.readFileSync(path.join(root, '.env.local'), 'utf8'));
  const url = (env.DATABASE_URL || env.SUPABASE_DB_URL)?.trim();
  const ref = env.NEXT_PUBLIC_SUPABASE_URL?.match(/https:\/\/([^.]+)\.supabase\.co/)?.[1] ?? '';
  const parsed = parsePgUrl(url);
  const opts = { max: 1, prepare: false };
  let sql = postgres({ ...parsed, ...opts });
  try {
    await sql`select 1`;
  } catch {
    await sql.end({ timeout: 1 }).catch(() => {});
    sql = postgres({
      ...parsed,
      ...opts,
      host: 'aws-1-us-east-1.pooler.supabase.com',
      port: 6543,
      user: parsed.user.includes('.') ? parsed.user : `postgres.${ref}`,
    });
  }

  const ubCentral = 'cd876d5b-94bf-445e-9061-f78b6623d460';
  const matId = 'a91bb410-f30d-49b8-ad71-611562566525';

  const invMov = await sql`select to_regclass('public.inv_movimientos') as t`;
  console.log('inv_movimientos:', invMov[0]?.t ?? 'NO EXISTE');

  const fns = await sql`
    select pg_get_function_identity_arguments(p.oid) as sig
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and proname = 'inv_stock_apply_delta'
  `;
  console.log('Firmas inv_stock_apply_delta:', fns.map((r) => r.sig));

  try {
    await sql`
      select public.inv_stock_apply_delta(
        ${ubCentral}::uuid,
        ${matId}::uuid,
        0::numeric,
        0::numeric,
        0::numeric
      )
    `;
    console.log('SQL directo 5 params: OK');
  } catch (e) {
    console.log('SQL directo 5 params FAIL:', e.message);
  }

  const supabaseUrl = env.NEXT_PUBLIC_SUPABASE_URL?.replace(/\/$/, '');
  const serviceKey = env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (supabaseUrl && serviceKey) {
    const res = await fetch(`${supabaseUrl}/rest/v1/rpc/inv_stock_apply_delta`, {
      method: 'POST',
      headers: {
        apikey: serviceKey,
        Authorization: `Bearer ${serviceKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        p_ubicacion_id: ubCentral,
        p_material_id: matId,
        p_delta_disponible: 0,
        p_delta_reservada: 0,
        p_delta_transito_entrante: 0,
      }),
    });
    const text = await res.text();
    console.log('PostgREST RPC status:', res.status, text.slice(0, 300));
  } else {
    console.log('Sin SUPABASE_SERVICE_ROLE_KEY — omitiendo prueba PostgREST');
  }

  await sql.end();
}

main().catch((e) => {
  console.error(e.message || e);
  process.exit(1);
});
