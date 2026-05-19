import type { SupabaseClient } from '@supabase/supabase-js';
import type { MonedaOrigen } from '@/lib/finanzas/currency-converter';
import {
  payloadCompraBimonetario,
  resolverMontosCompraBimonetario,
} from '@/lib/contabilidad/comprasBimonetario';

export type LineaCompraContabilidadInput = {
  purchase_detail_id: string;
  material_id: string;
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
};

export async function registerCompraDesdeRecepcion(
  supabase: SupabaseClient,
  input: RegistrarCompraContabilidadInput
): Promise<{ compraId: string }> {
  const { data: existente } = await supabase
    .from('contabilidad_compras')
    .select('id')
    .eq('purchase_invoice_id', input.purchase_invoice_id)
    .maybeSingle();

  if (existente?.id) {
    return { compraId: existente.id };
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
      origen: 'RECEPCION_MERCANCIA',
      estado: 'REGISTRADA',
      document_storage_path: input.document_storage_path ?? null,
      document_file_name: input.document_file_name ?? null,
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
    purchase_detail_id: l.purchase_detail_id,
    material_id: l.material_id,
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

  return { compraId: compra.id };
}
