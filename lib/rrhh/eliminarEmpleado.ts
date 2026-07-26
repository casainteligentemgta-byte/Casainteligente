import type { SupabaseClient } from '@supabase/supabase-js';

export type EliminarEmpleadoResult =
  | { ok: true }
  | { ok: false; error: string; step?: string };

function isMissingRelation(err: { code?: string; message?: string } | null): boolean {
  if (!err) return false;
  const msg = (err.message ?? '').toLowerCase();
  return (
    err.code === '42P01' ||
    err.code === 'PGRST205' ||
    msg.includes('does not exist') ||
    msg.includes('schema cache') ||
    msg.includes('could not find the table')
  );
}

async function deleteEq(
  supabase: SupabaseClient,
  table: string,
  column: string,
  value: string,
): Promise<{ error: string | null; missing: boolean }> {
  const { error } = await supabase.from(table).delete().eq(column, value);
  if (!error) return { error: null, missing: false };
  if (isMissingRelation(error)) return { error: null, missing: true };
  return { error: error.message, missing: false };
}

/**
 * Elimina un expediente de `ci_empleados` borrando primero las filas hijas
 * con FK ON DELETE RESTRICT (contratos, obra, asignaciones, expediente).
 * Las tablas con CASCADE / SET NULL las resuelve Postgres.
 */
export async function eliminarEmpleado(
  supabase: SupabaseClient,
  empleadoId: string,
): Promise<EliminarEmpleadoResult> {
  const id = empleadoId?.trim();
  if (!id) return { ok: false, error: 'empleado_id requerido', step: 'validacion' };

  // 1) Transferencias amarradas a tareas de expediente (RESTRICT sobre la tarea)
  const { data: tareas, error: tareasErr } = await supabase
    .from('obreros_expediente_tarea')
    .select('id')
    .eq('worker_id', id);

  if (tareasErr && !isMissingRelation(tareasErr)) {
    return {
      ok: false,
      error: tareasErr.message,
      step: 'obreros_expediente_tarea.select',
    };
  }

  const tareaIds = (tareas ?? []).map((t) => t.id as string).filter(Boolean);
  if (tareaIds.length > 0) {
    const { error: trErr } = await supabase
      .from('obreros_transferencia_dinero')
      .delete()
      .in('expediente_tarea_id', tareaIds);
    if (trErr && !isMissingRelation(trErr)) {
      return {
        ok: false,
        error: trErr.message,
        step: 'obreros_transferencia_dinero',
      };
    }
  }

  const steps: Array<{ table: string; column: string }> = [
    { table: 'obreros_expediente_tarea', column: 'worker_id' },
    { table: 'project_assignments', column: 'worker_id' },
    { table: 'ci_obra_empleados', column: 'empleado_id' },
    { table: 'ci_contratos_empleado_obra', column: 'empleado_id' },
  ];

  for (const step of steps) {
    const r = await deleteEq(supabase, step.table, step.column, id);
    if (r.error) {
      return { ok: false, error: r.error, step: step.table };
    }
  }

  const { error: delErr } = await supabase.from('ci_empleados').delete().eq('id', id);
  if (delErr) {
    return { ok: false, error: delErr.message, step: 'ci_empleados' };
  }

  return { ok: true };
}
