import type { SupabaseClient } from '@supabase/supabase-js';
import {
  extractPurchaseInvoiceFromFile,
  mimeFromFile,
  type ExtractedPurchaseInvoice,
} from '@/lib/almacen/extractPurchaseInvoiceGemini';
import {
  uploadProcurementDocument,
  validateProcurementDocument,
} from '@/lib/almacen/procurementDocumentStorage';
import {
  payloadCompraBimonetario,
  resolverMontosCompraBimonetario,
} from '@/lib/contabilidad/comprasBimonetario';
import { registerCompraDesdeRecepcion } from '@/lib/contabilidad/registerCompraDesdeRecepcion';
import { rifParaGuardarCompra } from '@/lib/contabilidad/rifVenezolano';
import { parseEstadoProcura } from '@/lib/procuras/procuraEstados';
import { vincularProcurasFacturaContabilidad } from '@/lib/procuras/vincularProcurasFacturaContabilidad';

const ESTADOS_VINCULO = new Set(['aprobada', 'aprobada_directa', 'recibida_parcial']);

export type ImportarFacturaArchivoOverrides = {
  invoice_number?: string | null;
  supplier_name?: string | null;
  supplier_rif?: string | null;
  fecha?: string | null;
  total_amount?: number | null;
  tasa_bcv?: number | null;
};

export type ImportarFacturaArchivoResult = {
  ok: true;
  contabilidad_compra_id: string;
  purchase_invoice_id: string;
  invoice_number: string;
  supplier_name: string;
  vinculadas: Array<{ procuraId: string; ticket: string }>;
  errores?: string[];
  extracted?: ExtractedPurchaseInvoice;
};

type ProcuraRow = {
  id: string;
  ticket: string;
  estado: string;
  proyecto_id: string | null;
  entidad_id: string | null;
  ubicacion_destino_id: string | null;
  purchase_invoice_id: string | null;
};

function hoyIso(): string {
  return new Date().toISOString().slice(0, 10);
}

function fechaIso(raw: string | null | undefined): string {
  const s = String(raw ?? '').trim().slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : hoyIso();
}

/**
 * Crea purchase_invoice + compra contable desde un PDF/imagen y vincula las procuras.
 */
export async function importarFacturaArchivoYVincularProcuras(
  supabase: SupabaseClient,
  params: {
    file: File;
    procuraIds: string[];
    overrides?: ImportarFacturaArchivoOverrides;
    /** Si ya se extrajo en cliente, evita segundo OCR. */
    extracted?: ExtractedPurchaseInvoice | null;
  },
): Promise<ImportarFacturaArchivoResult> {
  const ids = Array.from(new Set(params.procuraIds.map((id) => id.trim()).filter(Boolean)));
  if (!ids.length) throw new Error('Indique al menos una procura.');

  const sizeError = validateProcurementDocument(params.file);
  if (sizeError) throw new Error(sizeError);

  const mimeType = mimeFromFile(params.file);
  if (!mimeType) throw new Error('Formato no soportado. Use PDF, JPG, PNG o WEBP.');

  const { data: procuras, error: procErr } = await supabase
    .from('ci_procuras')
    .select('id,ticket,estado,proyecto_id,entidad_id,ubicacion_destino_id,purchase_invoice_id')
    .in('id', ids);

  if (procErr) throw new Error(procErr.message);
  const found = (procuras ?? []) as ProcuraRow[];
  if (found.length !== ids.length) {
    throw new Error('Una o más procuras no existen.');
  }

  for (const p of found) {
    const est = parseEstadoProcura(p.estado);
    if (!est || !ESTADOS_VINCULO.has(est)) {
      throw new Error(`${p.ticket}: estado «${p.estado}» no permite vincular factura.`);
    }
    if (p.purchase_invoice_id?.trim()) {
      throw new Error(`${p.ticket}: ya está vinculada a una factura.`);
    }
  }

  const proyectos = new Set(found.map((p) => p.proyecto_id?.trim() || '').filter(Boolean));
  if (proyectos.size > 1) {
    throw new Error('Todas las procuras deben ser de la misma obra.');
  }
  const proyectoId = Array.from(proyectos)[0] || found[0]?.proyecto_id?.trim() || null;
  if (!proyectoId) {
    throw new Error('Las procuras no tienen obra asignada.');
  }

  const entidadId =
    found.map((p) => p.entidad_id?.trim()).find(Boolean) || null;
  const ubicacionId =
    found.map((p) => p.ubicacion_destino_id?.trim()).find(Boolean) || null;

  let extracted = params.extracted ?? null;
  if (!extracted) {
    const buffer = Buffer.from(await params.file.arrayBuffer());
    const result = await extractPurchaseInvoiceFromFile({
      buffer,
      mimeType,
      fileName: params.file.name,
    });
    extracted = result.data;
  }

  const ov = params.overrides ?? {};
  const invoiceNumber = (
    ov.invoice_number?.trim() ||
    extracted.invoice_number?.trim() ||
    ''
  ).slice(0, 80);
  const supplierName = (
    ov.supplier_name?.trim() ||
    extracted.supplier_name?.trim() ||
    'Proveedor'
  ).slice(0, 200);
  const supplierRif = rifParaGuardarCompra(
    ov.supplier_rif?.trim() || extracted.supplier_rif?.trim() || '',
  );
  const fecha = fechaIso(ov.fecha || extracted.date);
  const totalRaw =
    ov.total_amount != null && Number.isFinite(Number(ov.total_amount))
      ? Number(ov.total_amount)
      : extracted.total_amount != null && Number.isFinite(Number(extracted.total_amount))
        ? Number(extracted.total_amount)
        : 0;

  if (!invoiceNumber) {
    throw new Error('Indique el número de factura (no se pudo leer del archivo).');
  }

  const tasaOverride =
    ov.tasa_bcv != null && Number.isFinite(Number(ov.tasa_bcv)) && Number(ov.tasa_bcv) > 0
      ? Number(ov.tasa_bcv)
      : null;

  const montos = await resolverMontosCompraBimonetario({
    montoTotal: totalRaw > 0 ? totalRaw : 0,
    moneda: 'VES',
    fecha,
    tasaBcvDigitada: tasaOverride,
  });

  if (!(montos.tasaApplied > 0) && totalRaw > 0) {
    throw new Error('No hay tasa BCV disponible. Indique la tasa manualmente.');
  }

  const { data: inv, error: invErr } = await supabase
    .from('purchase_invoices')
    .insert({
      invoice_number: invoiceNumber,
      supplier_rif: supplierRif,
      supplier_name: supplierName,
      date: fecha,
      status: 'REGISTRADA',
      proyecto_id: proyectoId,
      ...(ubicacionId ? { ubicacion_destino_id: ubicacionId } : {}),
      ...(entidadId ? { entidad_id: entidadId } : {}),
      ...payloadCompraBimonetario(montos),
    })
    .select('id')
    .single();

  if (invErr || !inv?.id) {
    throw new Error(invErr?.message ?? 'No se pudo crear la factura (purchase_invoices).');
  }

  const purchaseInvoiceId = String(inv.id);

  let documentStoragePath: string | null = null;
  let documentFileName: string | null = null;
  try {
    const uploaded = await uploadProcurementDocument(supabase, purchaseInvoiceId, params.file);
    documentStoragePath = uploaded.path;
    documentFileName = uploaded.fileName;
    await supabase
      .from('purchase_invoices')
      .update({
        document_storage_path: uploaded.path,
        document_file_name: uploaded.fileName,
        document_mime_type: uploaded.mimeType,
      })
      .eq('id', purchaseInvoiceId);
  } catch (docErr) {
    console.warn('[importarFacturaArchivo] documento:', docErr);
  }

  const lineas =
    Array.isArray(extracted.items) && extracted.items.length
      ? extracted.items
          .filter((it) => String(it.description ?? '').trim())
          .map((it) => ({
            descripcion: String(it.description).trim() || 'Ítem',
            item_code: it.item_code?.trim() || null,
            unidad: (it.unit || 'UND').trim() || 'UND',
            cantidad: Number(it.quantity) > 0 ? Number(it.quantity) : 1,
            precio_unitario: Number(it.unit_price) >= 0 ? Number(it.unit_price) : 0,
          }))
      : found.map((p) => ({
          descripcion: p.ticket,
          item_code: null as string | null,
          unidad: 'UND',
          cantidad: 1,
          precio_unitario: 0,
        }));

  const { compraId } = await registerCompraDesdeRecepcion(supabase, {
    purchase_invoice_id: purchaseInvoiceId,
    proyecto_id: proyectoId,
    invoice_number: invoiceNumber,
    supplier_rif: supplierRif,
    supplier_name: supplierName,
    fecha,
    total_amount: totalRaw > 0 ? totalRaw : montos.totalAmountLegacy,
    moneda: 'VES',
    tasa_bcv_ves_por_usd: montos.tasaApplied || undefined,
    document_storage_path: documentStoragePath,
    document_file_name: documentFileName,
    lineas,
    origen: 'PROCURA_IMPORT_ARCHIVO',
    ubicacion_destino_id: ubicacionId,
    entidad_id: entidadId,
    procura_id: found[0]?.id ?? null,
  });

  const vinculo = await vincularProcurasFacturaContabilidad(supabase, {
    contabilidadCompraId: compraId,
    procuraIds: ids,
  });

  if (!vinculo.ok) {
    throw new Error(vinculo.errores.join('\n') || 'Factura creada pero no se pudo vincular.');
  }

  return {
    ok: true,
    contabilidad_compra_id: compraId,
    purchase_invoice_id: purchaseInvoiceId,
    invoice_number: invoiceNumber,
    supplier_name: supplierName,
    vinculadas: vinculo.vinculadas.map((v) => ({
      procuraId: v.procuraId,
      ticket: v.ticket,
    })),
    errores: vinculo.errores.length ? vinculo.errores : undefined,
    extracted,
  };
}
