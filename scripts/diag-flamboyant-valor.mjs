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
  const pid = '171694ed-0ecb-4ec5-82f5-82b980cb261f';
  const ubCentral = 'cd876d5b-94bf-445e-9061-f78b6623d460';
  const ubObra = 'cf0272e4-3436-4cd9-b69d-07b78c395fc1';

  const deposits = await sql`
    select id, name, locality from inventory_deposits
    where name ilike '%flamboyant%' or locality ilike '%flamboyant%'
  `;
  console.log('\n=== inventory_deposits Flamboyant ===');
  console.table(deposits);
  const depId = deposits[0]?.id;

  for (const [label, ubId] of [
    ['almacen_central', ubCentral],
    ['obra', ubObra],
  ]) {
    const stock = await sql`
      select count(*)::int as rows,
        sum(s.cantidad_disponible)::numeric as qty,
        sum(s.cantidad_disponible * coalesce(g.average_weighted_cost,0))::numeric as valor_usd
      from inventario_stock s
      join global_inventory g on g.id = s.material_id
      where s.ubicacion_id = ${ubId} and s.cantidad_disponible > 0
    `;
    console.log(`\nStock físico ${label}:`, stock[0]);
  }

  if (depId) {
    const stockDep = await sql`
      select u.id, u.nombre, u.tipo, u.deposit_id, u.ci_proyecto_id,
        sum(s.cantidad_disponible)::numeric as qty,
        sum(s.cantidad_disponible * coalesce(g.average_weighted_cost,0))::numeric as valor_usd
      from inventario_stock s
      join inv_ubicaciones u on u.id = s.ubicacion_id
      join global_inventory g on g.id = s.material_id
      where u.deposit_id = ${depId} and s.cantidad_disponible > 0
      group by u.id, u.nombre, u.tipo, u.deposit_id, u.ci_proyecto_id
    `;
    console.log('\n=== Stock por ubicación (deposit_id Flamboyant) ===');
    console.table(stockDep);

    const totalDep = await sql`
      select sum(s.cantidad_disponible * coalesce(g.average_weighted_cost,0))::numeric as valor_usd
      from inventario_stock s
      join inv_ubicaciones u on u.id = s.ubicacion_id
      join global_inventory g on g.id = s.material_id
      where u.deposit_id = ${depId} and s.cantidad_disponible > 0
    `;
    console.log('Valor total deposit_id (como KPI valorPorDeposito):', totalDep[0]?.valor_usd);
  }

  const catDep = await sql`
    select count(*)::int as mats,
      sum(coalesce(stock_available,0))::numeric as qty,
      sum(coalesce(stock_available,0) * coalesce(average_weighted_cost,0))::numeric as valor_usd
    from global_inventory where deposit_id = ${depId ?? null}
  `;
  console.log('\nCatálogo global_inventory (deposit_id):', catDep[0]);

  const catProy = await sql`
    select count(*)::int as mats,
      sum(coalesce(stock_available,0))::numeric as qty,
      sum(coalesce(stock_available,0) * coalesce(average_weighted_cost,0))::numeric as valor_usd
    from global_inventory where proyecto_id = ${pid}
  `;
  console.log('Catálogo global_inventory (proyecto_id):', catProy[0]);

  const legacy = await sql`
    select count(*)::int as mats,
      sum(coalesce(stock_available,0) * coalesce(average_weighted_cost,0))::numeric as valor_usd
    from global_inventory
    where (deposit_id = ${depId ?? null} or proyecto_id = ${pid})
      and coalesce(stock_available,0) > 0
  `;
  console.log('Catálogo legacy con stock_available > 0:', legacy[0]);

  const matStock = await sql`
    select g.id, g.name, g.sap_code, g.deposit_id, g.proyecto_id,
      g.stock_available, g.average_weighted_cost, s.cantidad_disponible
    from inventario_stock s
    join global_inventory g on g.id = s.material_id
    where s.ubicacion_id = ${ubCentral}
  `;
  console.log('\n=== Material con stock físico ===');
  console.table(matStock);

  const ubMeta = await sql`
    select id, nombre, tipo, activo, deposit_id, ci_proyecto_id
    from inv_ubicaciones
    where id in (${ubCentral}, ${ubObra})
  `;
  console.log('\n=== Meta ubicaciones ===');
  console.table(ubMeta);

  const matId = 'a91bb410-f30d-49b8-ad71-611562566525';
  const [matFull] = await sql`
    select g.id, g.name, g.entidad_id, g.proyecto_id, g.deposit_id,
      c.name as categoria
    from global_inventory g
    left join material_categories c on c.id = g.category_id
    where g.id = ${matId}
  `;
  const [proyFull] = await sql`
    select id, nombre, entidad_id from ci_proyectos where id = ${pid}
  `;
  console.log('\nMaterial ENERGIA:', matFull);
  console.log('Proyecto:', proyFull);

  await sql.end();
}

main().catch((e) => {
  console.error(e.message || e);
  process.exit(1);
});
