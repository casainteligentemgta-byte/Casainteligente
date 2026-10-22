import type { SupabaseClient } from '@supabase/supabase-js';
import {
  calcularRelacionSemanal,
  type RelacionSemanal,
  type TramoPorcentaje,
} from '@/lib/contabilidad/relacionGastosSemanal';

/** Relación semanal de una obra leyendo las fuentes reales (compras registradas, abonos, historial %). */
export async function relacionSemanalObra(
  supabase: SupabaseClient,
  params: { proyectoId: string; desde: string; hasta: string },
): Promise<RelacionSemanal> {
  const [compras, abonos, historial] = await Promise.all([
    supabase
      .from('contabilidad_compras')
      .select('fecha, total_amount_usd, monto_usd, honorarios_usd')
      .eq('proyecto_id', params.proyectoId)
      .eq('estado', 'REGISTRADA')
      .gte('fecha', params.desde)
      .lte('fecha', params.hasta),
    supabase
      .from('ci_proyecto_abonos')
      .select('fecha_abono, monto_equivalente_usd')
      .eq('proyecto_id', params.proyectoId)
      .gte('fecha_abono', params.desde)
      .lte('fecha_abono', params.hasta),
    supabase
      .from('ci_proyecto_admin_historial')
      .select('porcentaje, vigente_desde')
      .eq('proyecto_id', params.proyectoId),
  ]);
  if (compras.error) throw new Error(compras.error.message);
  if (abonos.error) throw new Error(abonos.error.message);
  if (historial.error) throw new Error(historial.error.message);

  return calcularRelacionSemanal({
    desde: params.desde,
    hasta: params.hasta,
    gastos: (compras.data ?? []).map((c: Record<string, unknown>) => ({
      fecha: String(c.fecha),
      monto_usd: Number(c.total_amount_usd ?? c.monto_usd ?? 0),
      honorarios_usd: c.honorarios_usd == null ? null : Number(c.honorarios_usd),
    })),
    fondos: (abonos.data ?? []).map((a: Record<string, unknown>) => ({
      fecha: String(a.fecha_abono),
      monto_usd: Number(a.monto_equivalente_usd ?? 0),
    })),
    tramos: (historial.data ?? []).map(
      (h: Record<string, unknown>): TramoPorcentaje => ({
        porcentaje: Number(h.porcentaje),
        vigente_desde: String(h.vigente_desde),
      }),
    ),
  });
}
