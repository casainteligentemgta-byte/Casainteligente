import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * Fondos del cliente para la obra de una procura, tal como los lleva el CCO
 * (/contabilidad/cco): lo recibido, lo gastado con honorarios y el saldo en caja.
 * Se muestra al Contador cuando revisa si hay disponibilidad para la compra.
 */
export type ResumenFondosObra = {
  ingresosUsd: number;
  costoTotalUsd: number;
  saldoCajaUsd: number;
};

/**
 * Devuelve null si la obra no tiene ingresos registrados o si el CCO no se pudo leer:
 * el ticket sale igual, sin el bloque de fondos.
 */
export async function cargarFondosObraProcura(
  supabase: SupabaseClient,
  proyectoId: string | null | undefined,
): Promise<ResumenFondosObra | null> {
  const pid = proyectoId?.trim();
  if (!pid) return null;
  try {
    const { cargarCcoDashboard } = await import('@/lib/contabilidad/cargarCcoDashboard');
    const { oficial } = await cargarCcoDashboard(supabase, { proyectoId: pid });
    if (!(oficial.countIngresos > 0) && !(oficial.ingresos > 0)) return null;
    return {
      ingresosUsd: oficial.ingresos,
      costoTotalUsd: oficial.costoTotal,
      saldoCajaUsd: oficial.saldoCaja,
    };
  } catch (e) {
    console.warn('[fondosObraProcura] no se pudo leer el CCO:', e);
    return null;
  }
}

function usd(n: number): string {
  return `USD ${n.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

/** Bloque HTML para el ticket del Contador. Cadena vacía si no hay fondos que mostrar. */
export function bloqueFondosProcura(
  fondos: ResumenFondosObra | null | undefined,
  montoEstimadoUsd: number | null | undefined,
): string {
  if (!fondos) return '';

  const estimado =
    montoEstimadoUsd != null && Number.isFinite(Number(montoEstimadoUsd)) && Number(montoEstimadoUsd) > 0
      ? Number(montoEstimadoUsd)
      : null;

  let veredicto = '';
  if (fondos.saldoCajaUsd <= 0) {
    veredicto = '\n⚠️ <b>La obra no tiene saldo en caja.</b>';
  } else if (estimado != null && estimado > fondos.saldoCajaUsd) {
    veredicto = `\n⚠️ <b>La compra estimada (${usd(estimado)}) supera el saldo en caja.</b>`;
  } else if (estimado != null) {
    veredicto = '\n✅ El saldo cubre el estimado de esta compra.';
  }

  return (
    '\n\n💰 <b>Fondos del cliente (CCO)</b>\n' +
    `Recibido: ${usd(fondos.ingresosUsd)}\n` +
    `Gastado con honorarios: ${usd(fondos.costoTotalUsd)}\n` +
    `Saldo en caja: <b>${usd(fondos.saldoCajaUsd)}</b>` +
    veredicto
  );
}
