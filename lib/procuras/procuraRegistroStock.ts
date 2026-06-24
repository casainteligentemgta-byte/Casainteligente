import type { SupabaseClient } from '@supabase/supabase-js';
import {
  cargarProcuraAbastecimiento,
  enviarOrdenDespachoDepositarioProcura,
  evaluarAbastecimientoProcura,
  evaluarStockProcuraRegistro,
} from '@/lib/procuras/abastecimientoProcuraAprobada';

export type EvaluacionStockRegistroProcura = Awaited<
  ReturnType<typeof evaluarAbastecimientoProcura>
> & {
  /** Stock en almacén obra cubre la cantidad solicitada. */
  stockSuficiente: boolean;
};

/** Evalúa stock en almacenes de la obra antes de vía rápida / vía larga. */
export async function evaluarStockRegistroProcura(
  supabase: SupabaseClient,
  params: {
    proyecto_id: string | null;
    material_id: string | null;
    cantidad: number;
  },
): Promise<EvaluacionStockRegistroProcura> {
  const evaluacion = await evaluarAbastecimientoProcura(supabase, params);
  const stockSuficiente =
    evaluacion.cantidadCompra <= 0 &&
    evaluacion.cantidadDespacho >= evaluacion.cantidadSolicitada &&
    evaluacion.cantidadSolicitada > 0;

  return { ...evaluacion, stockSuficiente };
}

/** Procura cubierta por almacén: avisa solicitante + depositario. */
export async function procesarProcuraStockSuficiente(
  supabase: SupabaseClient,
  procuraId: string,
): Promise<{ solicitanteNotificado: boolean; depositarioNotificado: boolean }> {
  const procura = await cargarProcuraAbastecimiento(supabase, procuraId);
  if (!procura) {
    return { solicitanteNotificado: false, depositarioNotificado: false };
  }

  const evaluacion = await evaluarStockProcuraRegistro(supabase, procuraId, {
    proyecto_id: procura.proyecto_id,
    material_id: procura.material_id,
    cantidad: Number(procura.cantidad),
  });

  const dep = await enviarOrdenDespachoDepositarioProcura(supabase, procura, evaluacion);
  return {
    solicitanteNotificado: false,
    depositarioNotificado: dep.enviado,
  };
}

/** Escala monto USD al saldo a comprar cuando hay stock parcial. */
export function montoUsdSaldoCompra(
  montoTotal: number | null | undefined,
  cantidadSolicitada: number,
  cantidadCompra: number,
): number | null {
  if (montoTotal == null || !Number.isFinite(montoTotal) || montoTotal < 0) return null;
  if (!Number.isFinite(cantidadSolicitada) || cantidadSolicitada <= 0) return montoTotal;
  if (!Number.isFinite(cantidadCompra) || cantidadCompra <= 0) return null;
  if (cantidadCompra >= cantidadSolicitada) return montoTotal;
  return (montoTotal * cantidadCompra) / cantidadSolicitada;
}
