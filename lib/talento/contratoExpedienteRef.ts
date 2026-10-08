import type { SupabaseClient } from '@supabase/supabase-js';
import { expedienteDesdeCedula } from '@/lib/talento/expedienteCedula';

/**
 * El expediente del contrato es la cédula del trabajador.
 * Queda en la obra (`ci_empleados`) y se indexa también en la entidad.
 */
export async function construirExpedienteRefPorEmpleado(
  supabase: SupabaseClient,
  empleadoId: string,
): Promise<string> {
  const id = empleadoId.trim();
  if (!id) return '';

  type EmpleadoExpRow = {
    expediente_cedula?: string | null;
    cedula?: string | null;
    documento?: string | null;
  };

  let row: EmpleadoExpRow | null = null;
  const first = await supabase
    .from('ci_empleados')
    .select('expediente_cedula,cedula,documento')
    .eq('id', id)
    .maybeSingle();
  row = (first.data as EmpleadoExpRow | null) ?? null;
  if (first.error && /expediente_cedula|42703|schema cache|column/i.test(first.error.message)) {
    const retry = await supabase.from('ci_empleados').select('cedula,documento').eq('id', id).maybeSingle();
    row = (retry.data as EmpleadoExpRow | null) ?? null;
  }

  const guardado = String(row?.expediente_cedula ?? '').trim();
  if (guardado) return guardado;

  return expedienteDesdeCedula(row?.cedula ?? row?.documento);
}
