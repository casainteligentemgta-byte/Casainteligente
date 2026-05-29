import type { SupabaseClient } from '@supabase/supabase-js';
import type { ExtractedPurchaseInvoice } from '@/lib/almacen/extractPurchaseInvoiceGemini';
import { evaluarFastTrackFactura } from '@/lib/canal/evaluarFastTrackFactura';
import { asegurarUbicacionObra } from '@/lib/almacen/ubicacionesInventario';
import { registrarCompraInventario } from '@/lib/almacen/registrarCompraInventario';
import { confirmarCompraDesdeCanal } from '@/lib/contabilidad/confirmarCompraDesdeCanal';
import type { LineaCompraContabilidadInput } from '@/lib/contabilidad/registerCompraDesdeRecepcion';

type PendienteRow = {
  id: string;
  proyecto_id: string | null;
  ubicacion_destino_id: string | null;
  document_storage_path: string | null;
  document_file_name: string | null;
};

function normSku(s: string): string {
  return s.trim().toUpperCase();
}

export type ResultadoFastTrack = {
  aplicado: boolean;
  motivo?: string;
  confidenceScore?: number;
  compraId?: string;
};

/**
 * Fast-Track: aprobado_sistema + ingreso inmediato en inventario_stock (sin cola manual Telegram).
 */
export async function ejecutarFastTrackFacturaCanal(
  supabase: SupabaseClient,
  pendingId: string,
  extracted: ExtractedPurchaseInvoice & { confidence_score?: number },
): Promise<ResultadoFastTrack> {
  const evaluacion = await evaluarFastTrackFactura(supabase, extracted);
  if (!evaluacion.elegible) {
    return { aplicado: false, motivo: evaluacion.motivo, confidenceScore: evaluacion.confidenceScore };
  }

  const { data: pendiente, error: pErr } = await supabase
    .from('ci_facturas_canal_pendientes')
    .select('id, proyecto_id, ubicacion_destino_id, document_storage_path, document_file_name')
    .eq('id', pendingId)
    .maybeSingle();

  if (pErr || !pendiente) {
    return { aplicado: false, motivo: 'Factura pendiente no encontrada' };
  }

  const row = pendiente as PendienteRow;
  const proyectoId = row.proyecto_id?.trim() ?? '';
  if (!proyectoId) {
    return {
      aplicado: false,
      motivo: 'Sin proyecto asignado — requiere selección manual',
      confidenceScore: evaluacion.confidenceScore,
    };
  }

  let ubicacionDestinoId = row.ubicacion_destino_id?.trim() ?? '';
  if (!ubicacionDestinoId) {
    const { data: proy } = await supabase
      .from('ci_proyectos')
      .select('nombre')
      .eq('id', proyectoId)
      .maybeSingle();
    ubicacionDestinoId = await asegurarUbicacionObra(
      supabase,
      proyectoId,
      String(proy?.nombre ?? 'Obra'),
    );
  }

  const { data: catalogo } = await supabase
    .from('global_inventory')
    .select('id, sap_code')
    .not('sap_code', 'is', null);

  const porSku = new Map<string, string>();
  for (const m of catalogo ?? []) {
    const sku = normSku(String((m as { sap_code?: string }).sap_code ?? ''));
    if (sku) porSku.set(sku, String((m as { id: string }).id));
  }

  const lineas: LineaCompraContabilidadInput[] = (extracted.items ?? []).map((it) => {
    const sku = normSku(String(it.item_code ?? ''));
    return {
      material_id: porSku.get(sku) ?? null,
      descripcion: String(it.description ?? '').trim() || sku,
      item_code: sku,
      unidad: String(it.unit ?? 'UND').trim() || 'UND',
      cantidad: Number(it.quantity) > 0 ? Number(it.quantity) : 1,
      precio_unitario: Number(it.unit_price) >= 0 ? Number(it.unit_price) : 0,
    };
  });

  if (!lineas.every((l) => l.material_id)) {
    return { aplicado: false, motivo: 'No se pudieron resolver todos los material_id' };
  }

  const { compraId, purchaseInvoiceId } = await confirmarCompraDesdeCanal(supabase, {
    pendingId,
    proyectoId,
    ubicacionDestinoId,
    extractedOverride: extracted,
    lineasOverride: lineas,
  });

  const lineasInventario = lineas.map((l) => ({
    material_id: String(l.material_id),
    descripcion: l.descripcion,
    cantidad: l.cantidad,
    precio_unitario: l.precio_unitario,
  }));

  await registrarCompraInventario(supabase, {
    ubicacionDestinoId,
    numeroFactura: (extracted.invoice_number ?? 'S/N').trim(),
    proveedorRif: extracted.supplier_rif ?? 'S/R',
    proveedorNombre: extracted.supplier_name ?? 'Proveedor',
    fechaEmision: (extracted.date ?? '').slice(0, 10) || new Date().toISOString().slice(0, 10),
    total: Number(extracted.total_amount ?? 0),
    purchaseInvoiceId,
    documentoStoragePath: row.document_storage_path,
    lineas: lineasInventario,
  });

  await supabase
    .from('ci_facturas_canal_pendientes')
    .update({
      estado: 'aprobado_sistema',
      proyecto_id: proyectoId,
      ubicacion_destino_id: ubicacionDestinoId,
      purchase_invoice_id: purchaseInvoiceId,
      extracted: { ...extracted, confidence_score: evaluacion.confidenceScore },
      mensaje_error: null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', pendingId);

  return {
    aplicado: true,
    confidenceScore: evaluacion.confidenceScore,
    compraId,
  };
}
