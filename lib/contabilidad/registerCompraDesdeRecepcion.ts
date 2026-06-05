import type { SupabaseClient } from '@supabase/supabase-js';
import type { MonedaOrigen } from '@/lib/finanzas/currency-converter';
import {
  payloadCompraBimonetario,
  resolverMontosCompraBimonetario,
} from '@/lib/contabilidad/comprasBimonetario';
import {
  resolverDocumentoCompra,
  sincronizarDocumentoEnCompra,
} from '@/lib/contabilidad/syncDocumentoCompraRecepcion';
import { resolverEntidadIdDesdeProyecto } from '@/lib/contabilidad/resolverEntidadProyecto';
import { buscarCompraContablePorFactura } from '@/lib/contabilidad/buscarCompraContablePorFactura';

export type LineaCompraContabilidadInput = {
  purchase_detail_id?: string | null;
  material_id?: string | null;
  descripcion: string;
  item_code?: string | null;
  unidad: string;
  cantidad: number;
  precio_unitario: number;
};

export type RegistrarCompraContabilidadInput = {
  purchase_invoice_id: string;
  proyecto_id: string;
  invoice_number: string;
  supplier_rif: string;
  supplier_name: string;
  fecha: string;
  /** Monto total en la moneda de origen de la factura. */
  total_amount: number;
  moneda?: MonedaOrigen | string | null;
  tasa_bcv_ves_por_usd?: number | null;
  total_amount_usd?: number | null;
  document_storage_path?: string | null;
  document_file_name?: string | null;
  lineas: LineaCompraContabilidadInput[];
  /** Por defecto RECEPCION_MERCANCIA; use TELEGRAM al confirmar desde el bot. */
  origen?: string;
  ubicacion_destino_id?: string | null;
  entidad_id?: string | null;
};

export async function registerCompraDesdeRecepcion(
  supabase: SupabaseClient,
  input: RegistrarCompraContabilidadInput
): Promise<{ compraId: string; yaExistia: boolean }> {
  const doc = await resolverDocumentoCompra(supabase, {
    purchaseInvoiceId: input.purchase_invoice_id,
    documentStoragePath: input.document_storage_path,
    documentFileName: input.document_file_name,
  });

  const { data: existente } = await supabase
    .from('contabilidad_compras')
    .select('id, document_storage_path')
    .eq('purchase_invoice_id', input.purchase_invoice_id)
    .maybeSingle();

  if (existente?.id) {
    if (doc.storagePath && !existente.document_storage_path?.trim()) {
      await sincronizarDocumentoEnCompra(supabase, existente.id, doc);
    }
    return { compraId: existente.id, yaExistia: true };
  }

  const duplicada = await buscarCompraContablePorFactura(supabase, {
    invoice_number: input.invoice_number,
    supplier_rif: input.supplier_rif,
    supplier_name: input.supplier_name,
    proyecto_id: input.proyecto_id,
  });
  if (duplicada?.id) {
    const { data: compraDoc } = await supabase
      .from('contabilidad_compras')
      .select('document_storage_path')
      .eq('id', duplicada.id)
      .maybeSingle();
    if (doc.storagePath && !compraDoc?.document_storage_path?.trim()) {
      await sincronizarDocumentoEnCompra(supabase, duplicada.id, doc);
    }
    return { compraId: duplicada.id, yaExistia: true };
  }

  const montos = await resolverMontosCompraBimonetario({
    montoTotal: input.total_amount,
    moneda: input.moneda ?? 'VES',
    fecha: input.fecha,
    tasaBcvDigitada: input.tasa_bcv_ves_por_usd,
  });

  if (
    input.total_amount_usd != null &&
    input.total_amount_usd >= 0 &&
    Number.isFinite(input.total_amount_usd)
  ) {
    montos.montoUsd = input.total_amount_usd;
  }

  const bimonetario = payloadCompraBimonetario(montos);

  let entidadId = input.entidad_id?.trim() || null;
  if (!entidadId && input.proyecto_id) {
    entidadId = await resolverEntidadIdDesdeProyecto(supabase, input.proyecto_id);
  }

  const { data: compra, error: compraError } = await supabase
    .from('contabilidad_compras')
    .insert({
      purchase_invoice_id: input.purchase_invoice_id,
      proyecto_id: input.proyecto_id,
      invoice_number: input.invoice_number,
      supplier_rif: input.supplier_rif,
      supplier_name: input.supplier_name,
      fecha: input.fecha,
      ...bimonetario,
      origen: (input.origen ?? 'RECEPCION_MERCANCIA').trim() || 'RECEPCION_MERCANCIA',
      estado: 'REGISTRADA',
      document_storage_path: doc.storagePath,
      document_file_name: doc.fileName,
      ...(input.ubicacion_destino_id
        ? { ubicacion_destino_id: input.ubicacion_destino_id }
        : {}),
      ...(entidadId ? { entidad_id: entidadId } : {}),
    })
    .select('id')
    .single();

  if (compraError) {
    throw new Error(
      `No se pudo registrar la compra en contabilidad: ${compraError.message}`
    );
  }

  const lineRows = input.lineas.map((l) => ({
    compra_id: compra.id,
    purchase_detail_id: l.purchase_detail_id?.trim() || null,
    material_id: l.material_id?.trim() || null,
    descripcion: l.descripcion,
    item_code: l.item_code?.trim() || null,
    unidad: l.unidad || 'UND',
    cantidad: l.cantidad,
    precio_unitario: l.precio_unitario,
    subtotal: l.cantidad * l.precio_unitario,
  }));

  const { error: lineasError } = await supabase
    .from('contabilidad_compra_lineas')
    .insert(lineRows);

  if (lineasError) {
    throw new Error(
      `Compra contable creada pero falló el detalle: ${lineasError.message}`
    );
  }

  return { compraId: compra.id, yaExistia: false };
}
