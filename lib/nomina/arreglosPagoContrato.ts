import type { SupabaseClient } from '@supabase/supabase-js';
import { montoArregloValido } from '@/lib/nomina/arregloPago';

export type ArregloPagoContrato = { semanalUsd: number | null; mensualUsd: number | null };

/**
 * Arreglo de pago pactado en el contrato de cada trabajador en la obra (el contrato más reciente manda).
 * Sin contrato con arreglo, el trabajador no aparece en el resultado y la nómina usa el monto por defecto.
 */
export async function cargarArreglosPagoPorEmpleado(
  db: SupabaseClient,
  proyectoId: string,
  empleadoIds: string[],
): Promise<Record<string, ArregloPagoContrato>> {
  const ids = Array.from(new Set(empleadoIds.map((s) => s.trim()).filter(Boolean)));
  const pid = proyectoId.trim();
  if (!pid || ids.length === 0) return {};

  const { data, error } = await db
    .from('ci_contratos_express')
    .select('formalizado_empleado_id,arreglo_semanal_usd,arreglo_mensual_usd,created_at')
    .eq('proyecto_id', pid)
    .in('formalizado_empleado_id', ids)
    .order('created_at', { ascending: false });
  if (error) {
    console.warn('[arreglos de pago] no se pudieron leer:', error.message);
    return {};
  }

  const out: Record<string, ArregloPagoContrato> = {};
  for (const raw of data ?? []) {
    const r = raw as {
      formalizado_empleado_id?: string | null;
      arreglo_semanal_usd?: unknown;
      arreglo_mensual_usd?: unknown;
    };
    const eid = String(r.formalizado_empleado_id ?? '').trim();
    if (!eid || out[eid]) continue;
    const semanalUsd = montoArregloValido(r.arreglo_semanal_usd);
    const mensualUsd = montoArregloValido(r.arreglo_mensual_usd);
    if (semanalUsd == null && mensualUsd == null) continue;
    out[eid] = { semanalUsd, mensualUsd };
  }
  return out;
}
