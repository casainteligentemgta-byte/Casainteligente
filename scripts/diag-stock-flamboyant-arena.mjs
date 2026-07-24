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

  const proys = await sql`
    select id, nombre from ci_proyectos where lower(nombre) like '%flamboyant%'
  `;
  console.log('Proyectos Flamboyant:', proys);
  const pid = proys[0]?.id;
  if (!pid) {
    await sql.end({ timeout: 5 });
    return;
  }

  const arena = await sql`
    select id, name from global_inventory where lower(name) like '%arena%' order by name limit 15
  `;
  console.log('\nMateriales arena:', arena);

  for (const mat of arena.slice(0, 3)) {
    const mid = mat.id;
    console.log(`\n=== ${mat.name} (${mid}) ===`);

    const trf = await sql`
      select t.id, t.codigo, t.estado, t.created_at,
        tl.cantidad, uo.nombre as origen, ud.nombre as destino, ud.tipo as destino_tipo
      from transferencias_inventario t
      join transferencias_inventario_lineas tl on tl.transferencia_id = t.id
      left join inv_ubicaciones uo on uo.id = t.origen_ubicacion_id
      left join inv_ubicaciones ud on ud.id = t.destino_ubicacion_id
      where t.ci_proyecto_id = ${pid} and tl.material_id = ${mid}
      order by t.created_at desc
      limit 5
    `;
    console.log('Últimas transferencias:', trf);

    const eg = await sql`
      select e.id, e.created_at, e.stock_aplicado, e.transferencia_id, el.cantidad
      from inv_egresos_campo e
      join inv_egresos_campo_lineas el on el.egreso_id = e.id
      where e.proyecto_id = ${pid} and el.material_id = ${mid}
      order by e.created_at desc
      limit 3
    `;
    console.log('Últimos egresos:', eg);

    const stock = await sql`
      select s.cantidad_disponible, u.nombre, u.tipo, u.ci_proyecto_id
      from inventario_stock s
      join inv_ubicaciones u on u.id = s.ubicacion_id
      where s.material_id = ${mid} and s.cantidad_disponible <> 0
      order by u.nombre
    `;
    console.log('Stock físico (todas ubicaciones):', stock);

    const rpc = await sql`
      select ubicacion_nombre, ubicacion_tipo, cantidad_disponible
      from get_stock_real_obra(${pid}::uuid, null, ${mid}::uuid, false)
    `;
    console.log('RPC get_stock_real_obra:', rpc);

    const total = rpc.reduce((a, r) => a + Number(r.cantidad_disponible), 0);
    console.log('Suma RPC:', total);
  }

  await sql.end({ timeout: 5 });
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
