import type { SupabaseClient } from '@supabase/supabase-js';
import { eliminarEmpleado } from '@/lib/rrhh/eliminarEmpleado';

export type LimpiarPlaceholdersHvResult = {
  ok: true;
  eliminados: number;
  ids: string[];
  errores: Array<{ id: string; error: string }>;
};

function esPlaceholderNombre(nombre: string): boolean {
  const n = nombre.trim().toLowerCase();
  if (!n) return true;
  if (n === 'por completar') return true;
  if (n.startsWith('por completar')) return true;
  if (n === 'candidato') return true;
  if (n.startsWith('candidato ·') || n.startsWith('candidato •')) return true;
  return false;
}

function sinDocumento(row: { cedula?: unknown; documento?: unknown }): boolean {
  const c = String(row.cedula ?? '').trim();
  const d = String(row.documento ?? '').trim();
  return !c && !d;
}

/**
 * Borra expedientes vacíos creados al generar enlace HV
 * («Por completar» / pendiente_cv sin cédula).
 */
export async function limpiarPlaceholdersHv(
  supabase: SupabaseClient,
): Promise<LimpiarPlaceholdersHvResult> {
  const { data, error } = await supabase
    .from('ci_empleados')
    .select('id,nombre_completo,nombres,estado_proceso,cedula,documento')
    .eq('estado_proceso', 'pendiente_cv')
    .order('created_at', { ascending: false })
    .limit(500);

  if (error) {
    throw new Error(error.message);
  }

  const candidatos = (data ?? []).filter((raw) => {
    const row = raw as {
      id?: unknown;
      nombre_completo?: unknown;
      nombres?: unknown;
      cedula?: unknown;
      documento?: unknown;
    };
    if (!sinDocumento(row)) return false;
    const nom = String(row.nombre_completo ?? row.nombres ?? '');
    return esPlaceholderNombre(nom);
  });

  const ids: string[] = [];
  const errores: Array<{ id: string; error: string }> = [];

  for (const raw of candidatos) {
    const id = String((raw as { id?: unknown }).id ?? '').trim();
    if (!id) continue;
    // Exámenes (puede no haber CASCADE); tokens de expediente sí hacen CASCADE al borrar empleado.
    await supabase.from('ci_examenes').delete().eq('empleado_id', id);
    await supabase.from('expediente_tokens').delete().eq('hoja_vida_id', id);
    const out = await eliminarEmpleado(supabase, id);
    if (out.ok) ids.push(id);
    else errores.push({ id, error: out.error });
  }

  return { ok: true, eliminados: ids.length, ids, errores };
}
