import type { SupabaseClient } from '@supabase/supabase-js';
import type { ExtractedCanalHeader } from '@/lib/contabilidad/extractedCanal';
import { monedaExtractedConfirmada } from '@/lib/contabilidad/extractedCanal';
import { confirmarCompraDesdeCanal } from '@/lib/contabilidad/confirmarCompraDesdeCanal';
import { actualizarCompraProvisionalConFacturaCanal } from '@/lib/contabilidad/actualizarCompraProvisionalConFacturaCanal';
import { resolverEntidadIdDesdeProyecto } from '@/lib/contabilidad/resolverEntidadProyecto';

export type ResultadoConciliacionFrm = {
  compraId: string;
  purchaseInvoiceId: string;
  recepcionCampoId: string;
  yaExistia: boolean;
  actualizoProvisional?: boolean;
};

/**
 * Amarra factura fiscal (canal) a un ingreso FRM ya en stock.
 * Si el FRM ya tiene compra provisional, actualiza montos sin duplicar inventario.
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
      'id,proyecto_id,ubicacion_id,proveedor_id,estado,tipo,factura_canal_pendiente_id,observaciones,contabilidad_compra_id',
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

  const { data: pendiente, error: pErr } = await supabase
    .from('ci_facturas_canal_pendientes')
    .select(
      'id,estado,extracted,entidad_id,proyecto_id,ubicacion_destino_id,document_storage_path,document_file_name,document_mime_type,purchase_invoice_id',
    )
    .eq('id', pendingId)
    .single();

  if (pErr || !pendiente) {
    throw new Error(pErr?.message ?? 'Factura pendiente no encontrada.');
  }

  const extracted = params.extractedOverride ?? (pendiente.extracted as ExtractedCanalHeader | null);
  if (!extracted?.supplier_name?.trim() && !extracted?.invoice_number?.trim()) {
    throw new Error('Sin datos fiscales en la factura. Edite o reenvíe el documento.');
  }
  if (!monedaExtractedConfirmada(extracted.moneda)) {
    throw new Error('Indique si la factura está en bolívares (Bs) o dólares (USD).');
  }

  let entidadId =
    pendiente.entidad_id?.trim() ||
    (await resolverEntidadIdDesdeProyecto(supabase, proyectoId)) ||
    '';

  const compraProvisionalId = String(recepcion.contabilidad_compra_id ?? '').trim();
  let resultado: { compraId: string; purchaseInvoiceId: string; yaExistia: boolean };
  let actualizoProvisional = false;

  if (compraProvisionalId) {
    const { data: compraProv } = await supabase
      .from('contabilidad_compras')
      .select('id, purchase_invoice_id')
      .eq('id', compraProvisionalId)
      .maybeSingle();

    const purchaseInvoiceId = String(compraProv?.purchase_invoice_id ?? '').trim();
    if (!compraProv?.id || !purchaseInvoiceId) {
      throw new Error('La compra provisional del FRM no está enlazada correctamente.');
    }

    const actualizado = await actualizarCompraProvisionalConFacturaCanal(supabase, {
      pendingId,
      compraId: compraProvisionalId,
      purchaseInvoiceId,
      proyectoId,
      ubicacionDestinoId,
      entidadId: entidadId || null,
      extracted,
      documentStoragePath: pendiente.document_storage_path,
      documentFileName: pendiente.document_file_name,
    });

    resultado = {
      compraId: actualizado.compraId,
      purchaseInvoiceId: actualizado.purchaseInvoiceId,
      yaExistia: true,
    };
    actualizoProvisional = true;
  } else {
    resultado = await confirmarCompraDesdeCanal(supabase, {
      pendingId,
      proyectoId,
      ubicacionDestinoId,
      entidadId: entidadId || undefined,
      extractedOverride: extracted,
    });
  }

  const nota = actualizoProvisional
    ? `Conciliado fiscal sobre compra provisional ${resultado.compraId} · factura canal ${pendingId}`
    : `Conciliado factura canal ${pendingId} · compra ${resultado.compraId}`;
  const obsPrev = String(recepcion.observaciones ?? '').trim();
  const observaciones = obsPrev ? `${obsPrev}\n${nota}` : nota;
  const { error: linkErr } = await supabase
    .from('ci_recepciones_campo')
    .update({
      factura_canal_pendiente_id: pendingId,
      contabilidad_compra_id: resultado.compraId,
      updated_at: new Date().toISOString(),
      observaciones,
    } as never)
    .eq('id', recepcionId);

  if (linkErr) {
    throw new Error(`Compra registrada pero no se pudo enlazar el FRM: ${linkErr.message}`);
  }

  if (!actualizoProvisional) {
    const ingresadoAt = new Date().toISOString();
    const patchConta: Record<string, unknown> = { ingresado_almacen_at: ingresadoAt };
    const { error: contaErr } = await supabase
      .from('contabilidad_compras')
      .update(patchConta)
      .eq('id', resultado.compraId);

    if (contaErr && !/ingresado_almacen_at|42703|schema cache/i.test(contaErr.message ?? '')) {
      throw new Error(contaErr.message);
    }
  }

  return {
    compraId: resultado.compraId,
    purchaseInvoiceId: resultado.purchaseInvoiceId,
    recepcionCampoId: recepcionId,
    yaExistia: resultado.yaExistia,
    actualizoProvisional,
  };
}
