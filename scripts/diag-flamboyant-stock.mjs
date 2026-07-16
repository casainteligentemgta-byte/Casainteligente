/**
 * Diagnóstico: compras Telegram Flamboyant vs stock en inventario_stock.
 * Uso: node scripts/diag-flamboyant-stock.mjs
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
    const user = parsed.user.includes('.') ? parsed.user : `postgres.${ref}`;
    sql = postgres({
      ...parsed,
      ...opts,
      host: 'aws-1-us-east-1.pooler.supabase.com',
      port: 6543,
      user,
    });
  }

  const proys = await sql`
    select id, nombre from ci_proyectos where nombre ilike '%flamboyant%' limit 5
  `;
  console.log('\n=== Proyectos Flamboyant ===');
  console.table(proys);
  if (!proys.length) {
    await sql.end();
    return;
  }
  const pid = proys[0].id;

  const ubs = await sql`
    select id, nombre, tipo, deposit_id, ci_proyecto_id
    from inv_ubicaciones
    where nombre ilike '%flamboyant%' or ci_proyecto_id = ${pid}
    order by tipo, nombre
  `;
  console.log('\n=== Ubicaciones (nombre o proyecto) ===');
  console.table(ubs);

  const compras = await sql`
    select cc.id, cc.invoice_number, cc.supplier_name, cc.fecha::text, cc.origen,
      cc.ubicacion_destino_id, cc.purchase_invoice_id,
      u.nombre as ub_nombre, u.tipo as ub_tipo, u.ci_proyecto_id as ub_proyecto
    from contabilidad_compras cc
    left join inv_ubicaciones u on u.id = cc.ubicacion_destino_id
    where cc.proyecto_id = ${pid}
    order by cc.fecha desc
    limit 5
  `;
  console.log('\n=== Últimas compras contables (proyecto) ===');
  console.table(compras);

  for (const c of compras) {
    const [cf] = await sql`
      select id, estado, ubicacion_destino_id
      from compras_facturas
      where purchase_invoice_id = ${c.purchase_invoice_id}
      limit 1
    `;
    const [lines] = await sql`
      select count(*)::int as total,
        count(material_id) filter (where material_id is not null)::int as con_material
      from contabilidad_compra_lineas where compra_id = ${c.id}
    `;
    console.log(`\n--- Factura ${c.invoice_number} ---`);
    console.log('  compras_facturas:', cf ?? 'NO EXISTE (ingreso almacén no aplicó)');
    console.log('  líneas contab:', lines);

    const ubId = c.ubicacion_destino_id || cf?.ubicacion_destino_id;
    if (ubId) {
      const stock = await sql`
        select s.cantidad_disponible, g.name, g.sap_code
        from inventario_stock s
        join global_inventory g on g.id = s.material_id
        where s.ubicacion_id = ${ubId} and s.cantidad_disponible > 0
        order by g.name
        limit 10
      `;
      console.log('  stock físico en ubicación destino:', stock.length, 'materiales');
      if (stock.length) console.table(stock);
    }

    const idsObra = ubs.filter((u) => u.ci_proyecto_id === pid).map((u) => u.id);
    if (idsObra.length) {
      const stockObra = await sql`
        select sum(s.cantidad_disponible)::numeric as qty, count(distinct s.material_id)::int as mats
        from inventario_stock s
        where s.ubicacion_id = any(${idsObra}) and s.cantidad_disponible > 0
      `;
      console.log('  stock en ubicaciones tipo obra del proyecto:', stockObra[0]);
    }
  }

  const [c1589] = await sql`
    select id from contabilidad_compras
    where invoice_number = '1589' and origen = 'TELEGRAM'
    order by fecha desc limit 1
  `;
  if (c1589) {
    const lines1589 = await sql`
      select descripcion, item_code, material_id, cantidad
      from contabilidad_compra_lineas where compra_id = ${c1589.id}
    `;
    console.log('\n=== Factura 1589 Telegram (líneas) ===');
    console.table(lines1589);
  }

  await sql.end();
}

main().catch((e) => {
  console.error(e.message || e);
  process.exit(1);
});
