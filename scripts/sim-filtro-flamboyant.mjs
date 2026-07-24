/**
 * Simula resolverUbicacionIdsFiltro + stock para RANCHO FLAMBOYANT.
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

function normalizarEtiquetaUbicacion(s) {
  return s.trim().toLowerCase().replace(/\s+/g, ' ');
}

function ubicacionPerteneceAProyecto(u, proyectoId, proyectoNombre) {
  if (u.obra_id === proyectoId || u.proyecto?.id === proyectoId) return true;
  const pn = normalizarEtiquetaUbicacion(proyectoNombre ?? u.proyecto?.nombre ?? '');
  if (!pn) return false;
  const etiquetas = [u.nombre, u.deposit_locality ?? '', u.proyecto?.nombre ?? '']
    .map(normalizarEtiquetaUbicacion)
    .filter(Boolean);
  if (u.tipo === 'obra' || u.tipo === 'cuarentena' || u.tipo === 'garantias') {
    return etiquetas.some((e) => e === pn || e.includes(pn) || pn.includes(e));
  }
  if (u.tipo === 'almacen_central' || u.tipo === 'almacen_movil') {
    return etiquetas.some((e) => e === pn || e.includes(pn) || pn.includes(e));
  }
  return false;
}

function propagarDepositIdFlat(flat) {
  const byId = new Map(flat.map((u) => [u.id, u]));
  for (const u of flat) {
    if (u.deposit_id || !u.ubicacion_padre_id) continue;
    let p = byId.get(u.ubicacion_padre_id);
    while (p) {
      if (p.deposit_id) {
        u.deposit_id = p.deposit_id;
        break;
      }
      p = p.ubicacion_padre_id ? byId.get(p.ubicacion_padre_id) : undefined;
    }
  }
}

function incluirAlmacenesCentralesHermanoObra(flat, candidatas) {
  const byId = new Map(candidatas.map((u) => [u.id, u]));
  const nombresObra = new Set(
    candidatas
      .filter((u) => u.tipo === 'obra' || u.tipo === 'cuarentena' || u.tipo === 'garantias')
      .map((u) => normalizarEtiquetaUbicacion(u.nombre)),
  );
  if (!nombresObra.size) return candidatas;
  for (const u of flat) {
    if (u.tipo !== 'almacen_central' && u.tipo !== 'almacen_movil') continue;
    if (byId.has(u.id)) continue;
    if (nombresObra.has(normalizarEtiquetaUbicacion(u.nombre))) byId.set(u.id, u);
  }
  return Array.from(byId.values());
}

function resolverUbicacionIdsFiltro(ubicaciones, opts) {
  const flat = [...ubicaciones];
  propagarDepositIdFlat(flat);
  let candidatas = flat;
  if (opts.proyectoId) {
    candidatas = candidatas.filter((u) =>
      ubicacionPerteneceAProyecto(u, opts.proyectoId, opts.proyectoNombre),
    );
    candidatas = incluirAlmacenesCentralesHermanoObra(flat, candidatas);
  }
  if (opts.depositId) {
    candidatas = candidatas.filter((u) => u.deposit_id === opts.depositId);
  }
  return candidatas.map((u) => u.id);
}

async function main() {
  const sql = await connect();
  const pid = '171694ed-0ecb-4ec5-82f5-82b980cb261f';
  const depId = '498e5cd9-0930-4f22-960f-cb51c39aa642';
  const proyectoNombre = 'RANCHO FLAMBOYANT';

  const rows = await sql`
    select u.id, u.nombre, u.tipo, u.deposit_id, u.ci_proyecto_id, u.ubicacion_padre_id,
           p.id as proy_id, p.nombre as proy_nombre, d.locality as deposit_locality
    from inv_ubicaciones u
    left join ci_proyectos p on p.id = u.ci_proyecto_id
    left join inventory_deposits d on d.id = u.deposit_id
    where u.activo = true
  `;

  const ubicaciones = rows.map((r) => ({
    id: r.id,
    nombre: r.nombre,
    tipo: r.tipo,
    deposit_id: r.deposit_id,
    obra_id: r.ci_proyecto_id,
    ubicacion_padre_id: r.ubicacion_padre_id,
    proyecto: r.proy_id ? { id: r.proy_id, nombre: r.proy_nombre } : null,
    deposit_locality: r.deposit_locality,
  }));

  const idsProyecto = resolverUbicacionIdsFiltro(ubicaciones, {
    proyectoId: pid,
    proyectoNombre,
  });
  const idsProyectoSinNombre = resolverUbicacionIdsFiltro(ubicaciones, {
    proyectoId: pid,
    proyectoNombre: '',
  });
  console.log('\nIDs filtro proyecto SIN nombre (bug fix):', idsProyectoSinNombre.length);
  const idsDeposito = resolverUbicacionIdsFiltro(ubicaciones, { depositId: depId });
  const idsAmbos = resolverUbicacionIdsFiltro(ubicaciones, {
    proyectoId: pid,
    proyectoNombre,
    depositId: depId,
  });

  console.log('\n=== Ubicaciones Flamboyant ===');
  console.table(
    ubicaciones
      .filter((u) => u.nombre.toLowerCase().includes('flamboyant'))
      .map((u) => ({
        id: u.id,
        nombre: u.nombre,
        tipo: u.tipo,
        deposit_id: u.deposit_id,
        obra_id: u.obra_id,
      })),
  );

  console.log('\nIDs filtro solo proyecto:', idsProyecto.length);
  console.log('IDs filtro solo depósito:', idsDeposito.length);
  console.log('IDs filtro proyecto+depósito:', idsAmbos.length);

  for (const [label, ids] of [
    ['proyecto', idsProyecto],
    ['deposito', idsDeposito],
    ['ambos', idsAmbos],
  ]) {
    if (!ids.length) {
      console.log(`\n[${label}] Sin ubicaciones → fallback RPC get_stock_real_obra`);
      const rpc = await sql`select * from get_stock_real_obra(${pid}::uuid, null, null, false)`;
      console.log('RPC filas:', rpc.length);
      continue;
    }
    const stock = await sql`
      select gi.name, s.cantidad_disponible, u.nombre as ubicacion
      from inventario_stock s
      join global_inventory gi on gi.id = s.material_id
      join inv_ubicaciones u on u.id = s.ubicacion_id
      where s.ubicacion_id = any(${ids}::uuid[]) and s.cantidad_disponible > 0
      order by gi.name
    `;
    console.log(`\n[${label}] Stock (${stock.length} filas):`);
    console.table(stock);
  }

  await sql.end({ timeout: 5 });
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
