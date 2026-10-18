import type { SupabaseClient } from '@supabase/supabase-js';
import { aplicarDeltaStockInventario } from '@/lib/almacen/aplicarDeltaStockInventario';
import { revertirTransitoInspeccion } from '@/lib/almacen/stockTransitoCompra';

/**
 * Ajusta la cuarentena de una factura a lo que el depositario contó al recibir.
 *
 * Al confirmar la factura, la mercancía queda en cuarentena (y en tránsito) por lo
 * facturado. Si al recibir se cuenta menos, se aprueba solo lo contado: la línea baja a
 * esa cantidad y el faltante sale del tránsito. Antes se aprobaba lo facturado y el
 * almacén quedaba con stock que nunca llegó.
 *
 * Contar de más no suma: se aprueba lo facturado (el control de compras lo señala aparte).
 */

type Inspeccion = { id: string; material_id: string | null; quantity: number | string | null; purchase_detail_id: string | null };

export type AjusteLinea = { inspeccionId: string; materialId: string; aprobar: number; faltante: number };

/** Pura: reparte lo contado de cada material entre sus líneas pendientes, en orden. */
export function repartirRecibido(
  inspecciones: Inspeccion[],
  recibidas: Array<{ material_id: string; cantidad: number }>,
): AjusteLinea[] {
  const contado = new Map<string, number>();
  for (const r of recibidas) {
    const id = r.material_id?.trim();
    if (!id || !Number.isFinite(Number(r.cantidad))) continue;
    contado.set(id, (contado.get(id) ?? 0) + Math.max(0, Number(r.cantidad)));
  }
  const ajustes: AjusteLinea[] = [];
  for (const q of inspecciones) {
    const mid = q.material_id?.trim();
    if (!mid || !contado.has(mid)) continue;
    const qty = Number(q.quantity) || 0;
    const resto = contado.get(mid)!;
    const aprobar = Math.min(qty, resto);
    contado.set(mid, Math.round((resto - aprobar) * 1e6) / 1e6);
    const faltante = Math.round((qty - aprobar) * 1e6) / 1e6;
    if (faltante > 0) ajustes.push({ inspeccionId: q.id, materialId: mid, aprobar, faltante });
  }
  return ajustes;
}

export async function ajustarCuarentenaARecibido(
  supabase: SupabaseClient,
  purchaseInvoiceId: string,
  recibidas: Array<{ material_id: string; cantidad: number }> | null | undefined,
): Promise<AjusteLinea[]> {
  if (!recibidas?.length) return [];
  const { data, error } = await supabase
    .from('quality_inspections')
    .select('id,material_id,quantity,purchase_detail_id')
    .eq('invoice_id', purchaseInvoiceId)
    .eq('status', 'PENDIENTE');
  if (error) throw new Error(error.message);
  const ajustes = repartirRecibido((data ?? []) as Inspeccion[], recibidas);
  if (!ajustes.length) return [];

  const { data: inv } = await supabase
    .from('purchase_invoices')
    .select('ubicacion_destino_id')
    .eq('id', purchaseInvoiceId)
    .maybeSingle();
  const ubicacionId = String((inv as { ubicacion_destino_id?: string | null } | null)?.ubicacion_destino_id ?? '').trim();
  const { materialEsGastoInmediato } = await import('@/lib/almacen/esGastoInmediatoCompra');

  for (const a of ajustes) {
    const nota = `Faltante en recepción: se facturaron ${a.aprobar + a.faltante} y llegaron ${a.aprobar}`;
    if (a.aprobar <= 0) {
      // No llegó nada de esta línea: se rechaza y su tránsito se descuenta completo.
      await revertirTransitoInspeccion(supabase, a.inspeccionId, nota);
      const { error: eRech } = await supabase
        .from('quality_inspections')
        .update({ status: 'RECHAZADO', inspected_at: new Date().toISOString() })
        .eq('id', a.inspeccionId);
      if (eRech) throw new Error(eRech.message);
      continue;
    }
    const { error: eUpd } = await supabase
      .from('quality_inspections')
      .update({ quantity: a.aprobar })
      .eq('id', a.inspeccionId);
    if (eUpd) throw new Error(eUpd.message);
    // Los de gasto inmediato nunca sumaron tránsito.
    if (ubicacionId && !(await materialEsGastoInmediato(supabase, a.materialId))) {
      await aplicarDeltaStockInventario(supabase, {
        ubicacionId,
        materialId: a.materialId,
        deltaTransitoEntrante: -a.faltante,
        tipoMovimiento: 'anulacion',
        documentoId: purchaseInvoiceId,
        referenciaTipo: 'quality_inspection',
        referenciaId: a.inspeccionId,
        notas: nota,
      });
    }
  }
  return ajustes;
}
