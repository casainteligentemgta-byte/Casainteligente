import type { SupabaseClient } from '@supabase/supabase-js';
import type { ExtractedCanalHeader } from '@/lib/contabilidad/extractedCanal';
import {
  registerCompraDesdeRecepcion,
  type LineaCompraContabilidadInput,
} from '@/lib/contabilidad/registerCompraDesdeRecepcion';
import {
  payloadCompraBimonetario,
  resolverMontosCompraBimonetario,
} from '@/lib/contabilidad/comprasBimonetario';

export function linkConfirmarCompraTelegram(pendingId: string, baseUrl?: string): string {
  const base = (
    baseUrl ??
    process.env.NEXT_PUBLIC_BASE_URL ??
    process.env.NEXT_PUBLIC_APP_URL ??
    'https://casainteligente.company'
  )
    .trim()
    .replace(/\/$/, '');
  return `${base}/contabilidad/compras/telegram/${pendingId}`;
}

type PendienteRow = {
  id: string;
  estado: string;
  extracted: ExtractedCanalHeader | null;
  proyecto_id: string | null;
  ubicacion_destino_id: string | null;
  document_storage_path: string | null;
  document_file_name: string | null;
  document_mime_type: string | null;
  purchase_invoice_id: string | null;
};

function lineasDesdeExtracted(ex: ExtractedCanalHeader): LineaCompraContabilidadInput[] {
  return (ex.items ?? [])
    .filter((it) => String(it.description ?? '').trim())
    .map((it) => {
      const cantidad = Number(it.quantity) > 0 ? Number(it.quantity) : 1;
      const precio = Number(it.unit_price) >= 0 ? Number(it.unit_price) : 0;
      return {
        descripcion: String(it.description ?? '').trim(),
        item_code: String(it.item_code ?? '').trim() || null,
        unidad: String(it.unit ?? 'UND').trim() || 'UND',
        cantidad,
        precio_unitario: precio,
      };
    });
}

export async function confirmarCompraDesdeCanal(
  supabase: SupabaseClient,
  params: {
    pendingId: string;
    proyectoId: string;
    ubicacionDestinoId: string;
    extractedOverride?: ExtractedCanalHeader;
  },
): Promise<{ compraId: string; purchaseInvoiceId: string; yaExistia: boolean }> {
  const { data: pendiente, error: pErr } = await supabase
    .from('ci_facturas_canal_pendientes')
    .select(
      'id,estado,extracted,proyecto_id,ubicacion_destino_id,document_storage_path,document_file_name,document_mime_type,purchase_invoice_id',
    )
    .eq('id', params.pendingId)
    .single();

  if (pErr || !pendiente) {
    throw new Error(pErr?.message ?? 'Factura de Telegram no encontrada');
  }

  const row = pendiente as PendienteRow;
  if (row.estado === 'confirmado' && row.purchase_invoice_id) {
    const { data: compraExistente } = await supabase
      .from('contabilidad_compras')
      .select('id')
      .eq('purchase_invoice_id', row.purchase_invoice_id)
      .maybeSingle();
    if (compraExistente?.id) {
      return {
        compraId: compraExistente.id,
        purchaseInvoiceId: row.purchase_invoice_id,
        yaExistia: true,
      };
    }
  }

  if (!['extraido', 'error'].includes(row.estado)) {
    throw new Error(
      row.estado === 'procesando' || row.estado === 'pendiente'
        ? 'La factura aún se está procesando. Espere unos segundos y actualice.'
        : `Estado no válido para confirmar: ${row.estado}`,
    );
  }

  const extracted = params.extractedOverride ?? row.extracted;
  if (!extracted?.supplier_name?.trim() && !extracted?.invoice_number?.trim()) {
    throw new Error('Sin datos extraídos. Edite la factura o reenvíe la imagen.');
  }

  const proyectoId = params.proyectoId.trim() || row.proyecto_id?.trim() || '';
  if (!proyectoId) {
    throw new Error('Seleccione el proyecto al que pertenece la compra.');
  }

  const ubicacionDestinoId =
    params.ubicacionDestinoId.trim() || row.ubicacion_destino_id?.trim() || '';
  if (!ubicacionDestinoId) {
    throw new Error('Seleccione el almacén de ingreso del material.');
  }

  const fecha = (extracted.date ?? '').slice(0, 10) || new Date().toISOString().slice(0, 10);
  const lineas = lineasDesdeExtracted(extracted);
  if (lineas.length === 0) {
    throw new Error('Agregue al menos una línea con descripción.');
  }

  const sumLineas = lineas.reduce((s, l) => s + l.cantidad * l.precio_unitario, 0);
  const totalManual =
    extracted.total_amount != null && Number(extracted.total_amount) > 0
      ? Number(extracted.total_amount)
      : sumLineas;

  const montos = await resolverMontosCompraBimonetario({
    montoTotal: totalManual,
    moneda: 'VES',
    fecha,
  });

  let purchaseInvoiceId = row.purchase_invoice_id ?? '';

  if (!purchaseInvoiceId) {
    const invPayload = {
      invoice_number: (extracted.invoice_number ?? 'S/N').trim().slice(0, 80),
      supplier_rif: (extracted.supplier_rif ?? 'S/R').trim().slice(0, 40),
      supplier_name: (extracted.supplier_name ?? 'Proveedor').trim().slice(0, 200),
      date: fecha,
      status: 'REGISTRADA',
      proyecto_id: proyectoId,
      ubicacion_destino_id: ubicacionDestinoId,
      ...payloadCompraBimonetario(montos),
      document_storage_path: row.document_storage_path,
      document_file_name: row.document_file_name,
      document_mime_type: row.document_mime_type,
    };

    const { data: inv, error: invErr } = await supabase
      .from('purchase_invoices')
      .insert(invPayload)
      .select('id')
      .single();

    if (invErr) throw new Error(`No se pudo crear la factura: ${invErr.message}`);
    purchaseInvoiceId = String((inv as { id: string }).id);
  } else {
    await supabase
      .from('purchase_invoices')
      .update({
        proyecto_id: proyectoId,
        ubicacion_destino_id: ubicacionDestinoId,
      })
      .eq('id', purchaseInvoiceId);
  }

  const { compraId } = await registerCompraDesdeRecepcion(supabase, {
    purchase_invoice_id: purchaseInvoiceId,
    proyecto_id: proyectoId,
    invoice_number: (extracted.invoice_number ?? 'S/N').trim(),
    supplier_rif: (extracted.supplier_rif ?? 'S/R').trim(),
    supplier_name: (extracted.supplier_name ?? 'Proveedor').trim(),
    fecha,
    total_amount: montos.totalAmountLegacy,
    moneda: montos.monedaOriginal,
    tasa_bcv_ves_por_usd: montos.tasaApplied,
    total_amount_usd: montos.montoUsd,
    document_storage_path: row.document_storage_path,
    document_file_name: row.document_file_name,
    lineas,
    origen: 'TELEGRAM',
    ubicacion_destino_id: ubicacionDestinoId,
  });

  await supabase
    .from('ci_facturas_canal_pendientes')
    .update({
      estado: 'confirmado',
      proyecto_id: proyectoId,
      ubicacion_destino_id: ubicacionDestinoId,
      purchase_invoice_id: purchaseInvoiceId,
      extracted,
      mensaje_error: null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', params.pendingId);

  return { compraId, purchaseInvoiceId, yaExistia: false };
}
