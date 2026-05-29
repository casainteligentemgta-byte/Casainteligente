import type { SupabaseClient } from '@supabase/supabase-js';
import {
  buildArbolUbicaciones,
  mapUbicacionInventario,
  type InvUbicacionRow,
  type TipoUbicacion,
  type UbicacionInventario,
} from '@/types/inventario-obra';

const SELECT_UBICACION = `
  id,
  codigo,
  nombre,
  tipo,
  descripcion,
  deposit_id,
  ci_proyecto_id,
  ubicacion_padre_id,
  activo,
  notas,
  created_at,
  updated_at,
  proyecto:ci_proyectos ( id, nombre ),
  deposit:inventory_deposits ( id, locality )
`;

type UbicacionDbRow = InvUbicacionRow & {
  proyecto?: { id: string; nombre: string } | Array<{ id: string; nombre: string }> | null;
  deposit?: { id: string; locality: string | null } | Array<{ id: string; locality: string | null }> | null;
};

function mapRow(row: UbicacionDbRow): UbicacionInventario {
  const base = mapUbicacionInventario(row);
  const proyRaw = row.proyecto;
  const proy = Array.isArray(proyRaw) ? proyRaw[0] : proyRaw;
  if (proy?.id) {
    base.proyecto = { id: String(proy.id), nombre: String(proy.nombre ?? '') };
    base.obra_id = base.obra_id ?? String(proy.id);
  }
  const depRaw = row.deposit;
  const dep = Array.isArray(depRaw) ? depRaw[0] : depRaw;
  if (dep?.locality?.trim()) {
    base.deposit_locality = dep.locality.trim();
  }
  return base;
}

/** Propaga obra_id del padre a subsitios hijos (para UI y filtros). */
export function propagarObraIdFlat(flat: UbicacionInventario[]): void {
  const byId = new Map(flat.map((u) => [u.id, u]));
  for (const u of flat) {
    if (u.obra_id || !u.ubicacion_padre_id) continue;
    let p = byId.get(u.ubicacion_padre_id);
    while (p) {
      if (p.obra_id) {
        u.obra_id = p.obra_id;
        break;
      }
      p = p.ubicacion_padre_id ? byId.get(p.ubicacion_padre_id) : undefined;
    }
  }
}

export function propagarObraIdEnArbol(nodes: UbicacionInventario[], obraPadre?: string): void {
  for (const n of nodes) {
    const obra = n.obra_id ?? obraPadre;
    if (obra && !n.obra_id) n.obra_id = obra;
    if (n.subsitios?.length) propagarObraIdEnArbol(n.subsitios, obra);
  }
}

export async function listarUbicacionesInventario(
  supabase: SupabaseClient,
  opts?: { soloActivas?: boolean; tipo?: TipoUbicacion },
): Promise<UbicacionInventario[]> {
  let q = supabase.from('inv_ubicaciones').select(SELECT_UBICACION).order('nombre');
  if (opts?.soloActivas !== false) {
    q = q.eq('activo', true);
  }
  if (opts?.tipo) {
    q = q.eq('tipo', opts.tipo);
  }

  const { data, error } = await q;
  if (error?.code === '42P01' || /inv_ubicaciones|does not exist/i.test(error?.message ?? '')) {
    return [];
  }
  if (error) throw new Error(error.message);

  return (data ?? []).map((row) => mapRow(row as UbicacionDbRow));
}

export async function listarArbolUbicacionesInventario(
  supabase: SupabaseClient,
  opts?: { soloActivas?: boolean; tipo?: TipoUbicacion; proyectoId?: string },
): Promise<{ arbol: UbicacionInventario[]; total: number }> {
  const flat = await listarUbicacionesParaSelector(supabase, opts);
  const arbol = buildArbolUbicaciones(flat);
  propagarObraIdEnArbol(arbol);
  return { arbol, total: flat.length };
}

const ETIQUETA_TIPO: Record<TipoUbicacion, string> = {
  almacen_central: 'Almacén central',
  almacen_movil: 'Almacén móvil',
  obra: 'Obra',
  garantias: 'Garantías',
  cuarentena: 'Cuarentena',
};

export function etiquetaUbicacionSelector(u: UbicacionInventario, indent = 0): string {
  const pref = indent > 0 ? `${'  '.repeat(indent)}↳ ` : '';
  return `${pref}${labelUbicacionOpcion(u)}`;
}

/** Etiqueta corta para `<option>` en selects de almacén/obra. */
export function labelUbicacionOpcion(u: UbicacionInventario): string {
  const tipo =
    u.tipo === 'almacen_central'
      ? 'Almacén'
      : u.tipo === 'almacen_movil'
        ? 'Móvil'
        : u.tipo === 'obra'
          ? 'Obra'
          : (ETIQUETA_TIPO[u.tipo] ?? u.tipo);
  const loc = u.deposit_locality?.trim();
  const sufijo =
    loc && (u.tipo === 'almacen_central' || u.tipo === 'almacen_movil') ? ` · ${loc}` : '';
  return `${u.nombre} (${tipo}${sufijo})`;
}

/** Lista plana para selects: almacenes + obra del proyecto y sus subsitios. */
export async function listarUbicacionesParaSelector(
  supabase: SupabaseClient,
  opts?: { soloActivas?: boolean; tipo?: TipoUbicacion; proyectoId?: string },
): Promise<UbicacionInventario[]> {
  const todas = await listarUbicacionesInventario(supabase, {
    soloActivas: opts?.soloActivas,
    tipo: opts?.tipo,
  });
  if (!opts?.proyectoId) {
    return todas.filter((u) => u.tipo !== 'obra' || !u.ubicacion_padre_id);
  }

  propagarObraIdFlat(todas);

  const pid = opts.proyectoId;
  const almacenes = todas.filter((u) => u.tipo === 'almacen_central' || u.tipo === 'almacen_movil');
  const deObra = todas.filter((u) => u.obra_id === pid);

  const byId = new Map<string, UbicacionInventario>();
  for (const u of [...almacenes, ...deObra]) {
    byId.set(u.id, u);
  }
  return Array.from(byId.values()).sort((a, b) => {
    const order: Record<TipoUbicacion, number> = {
      almacen_central: 0,
      almacen_movil: 1,
      obra: 2,
      cuarentena: 3,
      garantias: 4,
    };
    const ta = order[a.tipo] ?? 9;
    const tb = order[b.tipo] ?? 9;
    if (ta !== tb) return ta - tb;
    return a.nombre.localeCompare(b.nombre, 'es');
  });
}

/** Ubicaciones de destino para transferencias a otra entidad (almacenes + obras de sus proyectos). */
export async function listarUbicacionesPorEntidad(
  supabase: SupabaseClient,
  entidadId: string,
  opts?: { excluirProyectoId?: string },
): Promise<UbicacionInventario[]> {
  const eid = entidadId.trim();
  if (!eid) return [];

  const { data: proys, error: pErr } = await supabase
    .from('ci_proyectos')
    .select('id, nombre')
    .eq('entidad_id', eid)
    .order('nombre');
  if (pErr?.code === '42P01') return [];
  if (pErr) throw new Error(pErr.message);

  const proyectoIds = new Set(
    (proys ?? [])
      .map((p) => String(p.id))
      .filter((id) => !opts?.excluirProyectoId || id !== opts.excluirProyectoId),
  );

  const todas = await listarUbicacionesInventario(supabase, { soloActivas: true });
  propagarObraIdFlat(todas);

  const almacenes = todas.filter((u) => u.tipo === 'almacen_central' || u.tipo === 'almacen_movil');
  const obrasEntidad = todas.filter((u) => u.obra_id && proyectoIds.has(u.obra_id));

  const byId = new Map<string, UbicacionInventario>();
  for (const u of [...almacenes, ...obrasEntidad]) {
    byId.set(u.id, u);
  }

  return Array.from(byId.values()).sort((a, b) => {
    const order: Record<TipoUbicacion, number> = {
      almacen_central: 0,
      almacen_movil: 1,
      obra: 2,
      cuarentena: 3,
      garantias: 4,
    };
    const ta = order[a.tipo] ?? 9;
    const tb = order[b.tipo] ?? 9;
    if (ta !== tb) return ta - tb;
    return a.nombre.localeCompare(b.nombre, 'es');
  });
}

/** Crea o actualiza inv_ubicacion vinculada a un depósito físico (Maestros → Depósitos). */
export async function asegurarUbicacionDeposito(
  supabase: SupabaseClient,
  deposit: { id: string; code: string; name: string },
): Promise<string> {
  const codigo = `DEP-${deposit.code.trim()}`;
  const { data: existing, error: selErr } = await supabase
    .from('inv_ubicaciones')
    .select('id')
    .eq('deposit_id', deposit.id)
    .maybeSingle();
  if (selErr?.code === '42P01') throw new Error('Tabla inv_ubicaciones no existe. Aplique migración 180.');
  if (selErr) throw new Error(selErr.message);
  if (existing?.id) {
    const { error: updErr } = await supabase
      .from('inv_ubicaciones')
      .update({
        codigo,
        nombre: deposit.name.trim(),
        tipo: 'almacen_central',
        activo: true,
      })
      .eq('id', existing.id);
    if (updErr) throw new Error(updErr.message);
    return String(existing.id);
  }

  const { data: created, error } = await supabase
    .from('inv_ubicaciones')
    .insert({
      codigo,
      nombre: deposit.name.trim(),
      tipo: 'almacen_central',
      deposit_id: deposit.id,
    })
    .select('id')
    .single();
  if (error) throw new Error(error.message);
  return String(created.id);
}

/** Crea ubicación raíz tipo obra si no existe (para ingreso de compras en sitio). */
export async function asegurarUbicacionObra(
  supabase: SupabaseClient,
  proyectoId: string,
  nombreObra: string,
): Promise<string> {
  const { data: existing, error: selErr } = await supabase
    .from('inv_ubicaciones')
    .select('id')
    .eq('ci_proyecto_id', proyectoId)
    .eq('tipo', 'obra')
    .is('ubicacion_padre_id', null)
    .maybeSingle();
  if (selErr?.code === '42P01') throw new Error('Tabla inv_ubicaciones no existe. Aplique migración 180.');
  if (selErr) throw new Error(selErr.message);
  if (existing?.id) return String(existing.id);

  const codigo = `OBRA-${proyectoId.replace(/-/g, '').slice(0, 12)}`;
  const { data: created, error } = await supabase
    .from('inv_ubicaciones')
    .insert({
      codigo,
      nombre: nombreObra.trim() || 'Obra',
      tipo: 'obra',
      ci_proyecto_id: proyectoId,
      descripcion: 'Ubicación de obra (auto)',
    })
    .select('id')
    .single();
  if (error) throw new Error(error.message);
  return String(created.id);
}
