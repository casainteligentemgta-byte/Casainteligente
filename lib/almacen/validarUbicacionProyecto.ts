import type { SupabaseClient } from '@supabase/supabase-js';

export type UbicacionParaValidarObra = {
  id?: string;
  activo?: boolean | null;
  ci_proyecto_id?: string | null;
  entidad_id?: string | null;
};

/**
 * La ubicación es de la obra, o un almacén de la misma entidad sin obra asignada
 * (depósito central hermano). Nunca un almacén de otra obra.
 */
export function ubicacionPerteneceAlProyectoDb(
  ubicacion: UbicacionParaValidarObra | null | undefined,
  proyectoId: string,
  entidadId: string | null | undefined,
): boolean {
  if (!ubicacion?.id) return false;
  if (ubicacion.activo === false) return false;
  const pid = proyectoId.trim();
  if (!pid) return false;
  const obraUbi = String(ubicacion.ci_proyecto_id ?? '').trim();
  if (obraUbi) return obraUbi === pid;
  const entUbi = String(ubicacion.entidad_id ?? '').trim();
  const entProy = String(entidadId ?? '').trim();
  return Boolean(entUbi && entProy && entUbi === entProy);
}

export async function assertUbicacionPerteneceAProyecto(
  supabase: SupabaseClient,
  ubicacionId: string,
  proyectoId: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const uid = ubicacionId.trim();
  const pid = proyectoId.trim();
  if (!uid || !pid) {
    return { ok: false, error: 'Proyecto y ubicación de ingreso son obligatorios.' };
  }

  const [{ data: ubi, error: uErr }, { data: proy, error: pErr }] = await Promise.all([
    supabase
      .from('inv_ubicaciones')
      .select('id, activo, ci_proyecto_id, entidad_id')
      .eq('id', uid)
      .maybeSingle(),
    supabase.from('ci_proyectos').select('id, entidad_id').eq('id', pid).maybeSingle(),
  ]);

  if (uErr) return { ok: false, error: uErr.message };
  if (pErr) return { ok: false, error: pErr.message };
  if (!proy?.id) return { ok: false, error: 'Proyecto no encontrado.' };
  if (!ubi?.id) return { ok: false, error: 'Ubicación de inventario no encontrada.' };
  if (ubi.activo === false) {
    return { ok: false, error: 'La ubicación de inventario está inactiva.' };
  }
  if (
    !ubicacionPerteneceAlProyectoDb(
      ubi as UbicacionParaValidarObra,
      pid,
      (proy as { entidad_id?: string | null }).entidad_id,
    )
  ) {
    return { ok: false, error: 'La ubicación no pertenece a esta obra.' };
  }
  return { ok: true };
}
