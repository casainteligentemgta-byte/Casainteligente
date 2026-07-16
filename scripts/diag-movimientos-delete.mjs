import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import postgres from 'postgres';

const UUID =
  '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}';

function parseIngresoLineaRest(rest) {
  const sep = rest.indexOf('_');
  if (sep <= 0) return null;
  const facturaId = rest.slice(0, sep).trim();
  const lineaId = rest.slice(sep + 1).trim();
  if (!new RegExp(`^${UUID}$`, 'i').test(facturaId)) return null;
  if (!new RegExp(`^${UUID}$`, 'i').test(lineaId)) return null;
  return { facturaId, lineaId };
}

function parseMovimientoId(id) {
  const s = id.trim();
  if (s.startsWith('ing-') && !s.startsWith('ing-fac-')) {
    return parseIngresoLineaRest(s.slice('ing-'.length));
  }
  return null;
}

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');

function parseEnvFile(content) {
  const out = {};
  for (const line of content.split(/\r?\n/)) {
    const t = line.trim();
    if (!t || t.startsWith('#')) continue;
    const i = t.indexOf('=');
    if (i === -1) continue;
    out[t.slice(0, i).trim()] = t.slice(i + 1).trim();
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

  const lineas = await sql`
    select cf.id as factura_id, cf.numero_factura, cf.estado, cf.ubicacion_destino_id,
      cfl.id as linea_id, cfl.material_id, cfl.cantidad, g.name
    from compras_facturas cf
    join compras_factura_lineas cfl on cfl.factura_id = cf.id
    left join global_inventory g on g.id = cfl.material_id
    order by cf.created_at desc nulls last
    limit 20
  `;
  console.log('\n=== Líneas compras_factura ===');
  console.table(lineas);

  for (const row of lineas) {
    const filaId = `ing-${row.factura_id}_${row.linea_id}`;
    const parsed = parseMovimientoId(filaId);
    console.log('\nID lista:', filaId);
    console.log('Parse:', parsed);
    const [dbLine] = await sql`
      select id, factura_id from compras_factura_lineas where id = ${row.linea_id}
    `;
    console.log('DB linea:', dbLine, 'match factura:', dbLine?.factura_id === row.factura_id);
  }

  const stock = await sql`
    select s.id, s.ubicacion_id, s.material_id, s.cantidad_disponible, g.name,
      u.nombre as ub_nombre
    from inventario_stock s
    join global_inventory g on g.id = s.material_id
    join inv_ubicaciones u on u.id = s.ubicacion_id
    where s.cantidad_disponible > 0
  `;
  console.log('\n=== Stock sin línea compra? ===');
  for (const s of stock) {
    const [linea] = await sql`
      select cfl.id, cf.id as factura_id
      from compras_factura_lineas cfl
      join compras_facturas cf on cf.id = cfl.factura_id
      where cfl.material_id = ${s.material_id}
        and cf.ubicacion_destino_id = ${s.ubicacion_id}
        and cf.estado = 'registrada'
      limit 1
    `;
    console.log({
      material: s.name,
      qty: s.cantidad_disponible,
      stkId: `stk-${s.id}`,
      tieneLineaIngreso: Boolean(linea),
      lineaId: linea?.id,
      filaIngreso: linea ? `ing-${linea.factura_id}_${linea.id}` : null,
    });
  }

  const contLineas = await sql`
    select ccl.id, ccl.descripcion, ccl.material_id, ccl.cantidad, cc.invoice_number, cc.id as compra_id
    from contabilidad_compra_lineas ccl
    join contabilidad_compras cc on cc.id = ccl.compra_id
    order by cc.fecha desc nulls last
    limit 15
  `;
  console.log('\n=== contabilidad_compra_lineas ===');
  console.table(contLineas);

  const facs = await sql`
    select id, numero_factura, estado, purchase_invoice_id
    from compras_facturas order by created_at desc nulls last limit 10
  `;
  console.log('\n=== compras_facturas (cabeceras) ===');
  console.table(facs);

  const invMov = await sql`
    select id, tipo_movimiento, material_id, delta_disponible, created_at
    from inv_movimientos order by created_at desc limit 10
  `;
  console.log('\n=== inv_movimientos (ledger) ===');
  console.table(invMov);

  await sql.end();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
