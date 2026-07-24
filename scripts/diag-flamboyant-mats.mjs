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

async function connect() {
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
    const user = parsed.user.includes('.') ? parsed.user : `postgres.${ref}`;
    sql = postgres({
      ...parsed,
      ...opts,
      host: 'aws-1-us-east-1.pooler.supabase.com',
      port: 6543,
      user,
    });
  }
  return sql;
}

async function main() {
  const sql = await connect();
  const ubCentral = 'cd876d5b-94bf-445e-9061-f78b6623d460';

  const mats = await sql`
    select gi.id, gi.name, gi.entidad_id, gi.proyecto_id, gi.deposit_id,
           gi.stock_available, gi.average_weighted_cost,
           mc.name as categoria
    from inventario_stock s
    join global_inventory gi on gi.id = s.material_id
    left join material_categories mc on mc.id = gi.category_id
    where s.ubicacion_id = ${ubCentral} and s.cantidad_disponible > 0
  `;
  console.table(mats);

  const rpc = await sql`
    select material_id, material_name, cantidad_disponible, ubicacion_nombre
    from get_stock_real_obra('171694ed-0ecb-4ec5-82f5-82b980cb261f'::uuid, null, null, false)
  `;
  console.log('\nRPC get_stock_real_obra (proyecto Flamboyant):', rpc.length, 'filas');
  console.table(rpc);

  await sql.end({ timeout: 5 });
}

main().catch(console.error);
