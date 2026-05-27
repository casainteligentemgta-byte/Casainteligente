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
  proyecto:ci_proyectos ( id, nombre )
`;

type UbicacionDbRow = InvUbicacionRow & {
  proyecto?: { id: string; nombre: string } | Array<{ id: string; nombre: string }> | null;
};

function mapRow(row: UbicacionDbRow): UbicacionInventario {
  const base = mapUbicacionInventario(row);
  const proyRaw = row.proyecto;
  const proy = Array.isArray(proyRaw) ? proyRaw[0] : proyRaw;
  if (proy?.id) {
    base.proyecto = { id: String(proy.id), nombre: String(proy.nombre ?? '') };
    base.obra_id = base.obra_id ?? String(proy.id);
  }
  return base;
}

/** Propaga obra_id del padre a subsitios hijos (para UI y filtros). */
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
  opts?: { soloActivas?: boolean; tipo?: TipoUbicacion },
): Promise<{ arbol: UbicacionInventario[]; total: number }> {
  const flat = await listarUbicacionesInventario(supabase, opts);
  const arbol = buildArbolUbicaciones(flat);
  propagarObraIdEnArbol(arbol);
  return { arbol, total: flat.length };
}
