import type { SupabaseClient } from '@supabase/supabase-js';
import type { CantidadRecibida } from '@/lib/procuras/procuraRecibidaTrasIngreso';

/**
 * Cierre de la cadena cuando la cuarentena de una factura queda resuelta (ya no hay líneas
 * PENDIENTE), venga de donde venga la decisión: web, Telegram, «aprobar factura completa»,
 * fast-track o el canal de facturas.
 *
 *   - Se aprobó algo  → el retiro pasa a «entregado» y la procura a «recibida» o
 *                        «recibida parcial» según lo aprobado; se avisa a quien la pidió.
 *   - Se rechazó todo → el retiro se cancela (la mercancía no entra) y la procura queda
 *                        «comprada», para que el aviso diario siga mostrándola.
 *
 * Antes esto solo pasaba en el ingreso desde el canal de facturas: lo aprobado por la web o
 * por Telegram dejaba el retiro abierto y la procura «comprada» para siempre.
 *
 * Idempotente y nunca lanza: no debe tumbar la aprobación de la cuarentena.
 */

type Inspeccion = { status: string | null; material_id: string | null; quantity: number | string | null };

export type DepsCierre = {
  cerrarRetiro: (purchaseInvoiceId: string) => Promise<void>;
  cancelarRetiro: (purchaseInvoiceId: string) => Promise<void>;
  marcarProcuras: (purchaseInvoiceId: string, recibidas: CantidadRecibida[]) => Promise<number>;
};

export type ResultadoCierre =
  | { accion: 'pendiente' | 'sin_cuarentena' | 'error' }
  | { accion: 'recibida'; procuras: number }
  | { accion: 'rechazada' };

/** Lo aprobado, sumado por material. */
export function cantidadesAprobadas(inspecciones: Inspeccion[]): CantidadRecibida[] {
  const suma = new Map<string, number>();
  for (const i of inspecciones) {
    if (String(i.status ?? '').toUpperCase() !== 'APROBADO') continue;
    const m = i.material_id?.trim();
    const q = Number(i.quantity);
    if (!m || !Number.isFinite(q) || q <= 0) continue;
    suma.set(m, (suma.get(m) ?? 0) + q);
  }
  return Array.from(suma.entries()).map(([material_id, cantidad]) => ({ material_id, cantidad }));
}

async function depsReales(supabase: SupabaseClient): Promise<DepsCierre> {
  const [{ cerrarRetiroCompraTrasIngreso }, { marcarProcurasRecibidasTrasIngreso }] = await Promise.all([
    import('@/lib/telegram/retiroCompraTelegram'),
    import('@/lib/procuras/procuraRecibidaTrasIngreso'),
  ]);
  return {
    cerrarRetiro: (pi) => cerrarRetiroCompraTrasIngreso(supabase, pi),
    cancelarRetiro: async (pi) => {
      const ahora = new Date().toISOString();
      const { error } = await supabase
        .from('ci_compras_retiros')
        .update({ estado: 'cancelado', updated_at: ahora })
        .eq('purchase_invoice_id', pi)
        .in('estado', ['pendiente', 'asignado', 'en_camino']);
      if (error && !/ci_compras_retiros/.test(error.message ?? '')) {
        console.warn('[cerrarCadena] cancelar retiro:', error.message);
      }
    },
    marcarProcuras: (pi, recibidas) => marcarProcurasRecibidasTrasIngreso(supabase, pi, recibidas),
  };
}

export async function cerrarCadenaTrasCuarentena(
  supabase: SupabaseClient,
  purchaseInvoiceId: string,
  deps?: DepsCierre,
): Promise<ResultadoCierre> {
  const pi = purchaseInvoiceId.trim();
  if (!pi) return { accion: 'sin_cuarentena' };
  try {
    const { data, error } = await supabase
      .from('quality_inspections')
      .select('status,material_id,quantity')
      .eq('invoice_id', pi);
    if (error) return { accion: 'error' };
    const filas = (data ?? []) as Inspeccion[];
    if (!filas.length) return { accion: 'sin_cuarentena' };
    if (filas.some((f) => String(f.status ?? '').toUpperCase() === 'PENDIENTE')) return { accion: 'pendiente' };

    const d = deps ?? (await depsReales(supabase));
    const aprobadas = cantidadesAprobadas(filas);
    if (!aprobadas.length) {
      await d.cancelarRetiro(pi);
      return { accion: 'rechazada' };
    }
    await d.cerrarRetiro(pi);
    const procuras = await d.marcarProcuras(pi, aprobadas);
    return { accion: 'recibida', procuras };
  } catch (e) {
    console.warn('[cerrarCadenaTrasCuarentena]', pi, e);
    return { accion: 'error' };
  }
}
