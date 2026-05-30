import type { SupabaseClient } from '@supabase/supabase-js';
import type { ExtractedCanalHeader } from '@/lib/contabilidad/extractedCanal';
import { confirmarCompraDesdeCanal } from '@/lib/contabilidad/confirmarCompraDesdeCanal';

export type ResultadoConciliacionFrm = {
  compraId: string;
  purchaseInvoiceId: string;
  recepcionCampoId: string;
  yaExistia: boolean;
};

/**
 * Amarra factura fiscal (canal) a un ingreso FRM ya en stock, sin segundo movimiento de inventario.
 */
export async function conciliarFrmConFacturaCanal(
  supabase: SupabaseClient,
  params: {
    facturaCanalPendienteId: string;
    recepcionCampoId: string;
    extractedOverride?: ExtractedCanalHeader;
  },
): Promise<ResultadoConciliacionFrm> {
  const pendingId = params.facturaCanalPendienteId.trim();
  const recepcionId = params.recepcionCampoId.trim();
  if (!pendingId || !recepcionId) {
    throw new Error('Factura y recepción de campo son obligatorias.');
  }

  const { data: recepcion, error: rErr } = await supabase
    .from('ci_recepciones_campo')
    .select(
      'id,proyecto_id,ubicacion_id,proveedor_id,estado,tipo,factura_canal_pendiente_id,observaciones',
    )
    .eq('id', recepcionId)
    .single();

  if (rErr || !recepcion) {
    throw new Error(rErr?.message ?? 'Recepción de campo no encontrada.');
  }

  if (recepcion.estado !== 'registrado') {
    throw new Error('La recepción de campo no está activa para conciliar.');
  }
  if (recepcion.factura_canal_pendiente_id) {
    throw new Error('Esta recepción ya fue conciliada con otra factura.');
  }
  if (!['nota_entrega', 'emergencia'].includes(String(recepcion.tipo))) {
    throw new Error('Solo se concilian ingresos manuales (nota o emergencia).');
  }

  const proyectoId = String(recepcion.proyecto_id ?? '').trim();
  const ubicacionDestinoId = String(recepcion.ubicacion_id ?? '').trim();
  if (!proyectoId || !ubicacionDestinoId) {
    throw new Error('La recepción no tiene proyecto o ubicación válidos.');
  }

  const resultado = await confirmarCompraDesdeCanal(supabase, {
    pendingId,
    proyectoId,
    ubicacionDestinoId,
    extractedOverride: params.extractedOverride,
  });

  const nota = `Conciliado factura canal ${pendingId} · compra ${resultado.compraId}`;
  const obsPrev = String(recepcion.observaciones ?? '').trim();
  const observaciones = obsPrev ? `${obsPrev}\n${nota}` : nota;
  const { error: linkErr } = await supabase
    .from('ci_recepciones_campo')
    .update({
      factura_canal_pendiente_id: pendingId,
      updated_at: new Date().toISOString(),
      observaciones,
    } as never)
    .eq('id', recepcionId);

  if (linkErr) {
    throw new Error(`Compra registrada pero no se pudo enlazar el FRM: ${linkErr.message}`);
  }

  const ingresadoAt = new Date().toISOString();
  const patchConta: Record<string, unknown> = { ingresado_almacen_at: ingresadoAt };
  const { error: contaErr } = await supabase
    .from('contabilidad_compras')
    .update(patchConta)
    .eq('id', resultado.compraId);

  if (contaErr && !/ingresado_almacen_at|42703|schema cache/i.test(contaErr.message ?? '')) {
    throw new Error(contaErr.message);
  }

  return {
    compraId: resultado.compraId,
    purchaseInvoiceId: resultado.purchaseInvoiceId,
    recepcionCampoId: recepcionId,
    yaExistia: resultado.yaExistia,
  };
}
