import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import {
  createProcurementDocumentSignedUrl,
  uploadProcurementDocument,
  validateProcurementDocument,
} from '@/lib/almacen/procurementDocumentStorage';
import {
  extractPurchaseInvoiceFromFile,
  mimeFromFile,
  type ExtractedPurchaseInvoice,
} from '@/lib/almacen/extractPurchaseInvoiceGemini';
import {
  aplicarCertificacionFacturaAdjunta,
  compararCabeceraConFacturaOcr,
  type CompraParaCertificar,
} from '@/lib/contabilidad/certificarFacturaAdjunta';
import {
  resolverDocumentoCompra,
  sincronizarDocumentoEnCompra,
} from '@/lib/contabilidad/syncDocumentoCompraRecepcion';
import { supabaseAdminForRoute } from '@/lib/talento/supabase-admin';

export const runtime = 'nodejs';
export const maxDuration = 180;

type RouteCtx = { params: Promise<{ id: string }> };

export async function GET(_req: Request, ctx: RouteCtx) {
  try {
    const { id } = await ctx.params;
    if (!id?.trim()) {
      return NextResponse.json({ error: 'ID de compra requerido.' }, { status: 400 });
    }

    const supabase = await createClient();
    const compraId = id.trim();
    const { data: compra, error: compraErr } = await supabase
      .from('contabilidad_compras')
      .select('purchase_invoice_id, document_storage_path, document_file_name')
      .eq('id', compraId)
      .maybeSingle();

    if (compraErr) throw compraErr;
    if (!compra) {
      return NextResponse.json({ error: 'Compra no encontrada.' }, { status: 404 });
    }

    const doc = await resolverDocumentoCompra(supabase, {
      compraId,
      purchaseInvoiceId: compra.purchase_invoice_id,
      documentStoragePath: compra.document_storage_path,
      documentFileName: compra.document_file_name,
    });

    const storagePath = doc.storagePath;
    const fileName = doc.fileName;
    const mimeType = doc.mimeType;
    const origenDocumento = doc.origen;

    if (storagePath && !compra.document_storage_path?.trim()) {
      await sincronizarDocumentoEnCompra(supabase, compraId, doc);
    }

    if (!storagePath) {
      const soloNombre = fileName?.trim();
      return NextResponse.json(
        {
          error: soloNombre
            ? `Hay nombre de archivo («${soloNombre}») pero no está guardado en Storage. Súbelo de nuevo en recepción de mercancía o desde Telegram.`
            : 'Esta compra no tiene imagen o PDF de factura adjunto.',
          code: 'SIN_DOCUMENTO_STORAGE',
          fileName: soloNombre ?? null,
        },
        { status: 404 },
      );
    }

    const admin = supabaseAdminForRoute();
    const storageClient = admin.ok ? admin.client : supabase;

    let url: string;
    try {
      url = await createProcurementDocumentSignedUrl(storageClient, storagePath);
    } catch (storageErr) {
      const msg = storageErr instanceof Error ? storageErr.message : '';
      const notFound = /not found|object not found|404/i.test(msg);
      return NextResponse.json(
        {
          error: notFound
            ? 'El archivo ya no existe en el almacén (fue borrado o la ruta es incorrecta). Vuelve a adjuntar la factura en recepción de mercancía.'
            : msg || 'No se pudo generar el enlace al documento.',
          code: notFound ? 'ARCHIVO_NO_EN_BUCKET' : 'STORAGE_ERROR',
          storagePath,
          origenDocumento,
        },
        { status: notFound ? 404 : 500 },
      );
    }

    return NextResponse.json({
      url,
      fileName,
      mimeType: mimeType ?? guessMimeFromName(fileName),
      origenDocumento,
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Error al obtener el documento.';
    console.error('[GET contabilidad compra document]', e);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/**
 * POST multipart/form-data — adjunta imagen o PDF a una compra ya registrada.
 * Por defecto corre OCR (Gemini): certifica cabecera/monto CCO y propone ítems.
 * Query `ocr=0` salta la extracción.
 */
export async function POST(req: Request, ctx: RouteCtx) {
  try {
    const { id } = await ctx.params;
    if (!id?.trim()) {
      return NextResponse.json({ error: 'ID de compra requerido.' }, { status: 400 });
    }

    const urlReq = new URL(req.url);
    const ocrEnabled = urlReq.searchParams.get('ocr') !== '0';

    const form = await req.formData();
    const file = form.get('documento');
    if (!(file instanceof File) || file.size === 0) {
      return NextResponse.json(
        { error: 'Envíe un archivo en el campo documento (imagen o PDF).' },
        { status: 400 },
      );
    }

    const validation = validateProcurementDocument(file);
    if (validation) {
      return NextResponse.json({ error: validation }, { status: 400 });
    }

    const supabase = await createClient();
    const compraId = id.trim();
    const { data: compra, error: compraErr } = await supabase
      .from('contabilidad_compras')
      .select(
        'id, purchase_invoice_id, document_storage_path, fecha, supplier_name, supplier_rif, invoice_number, origen, total_amount, total_amount_usd, tasa_bcv_ves_por_usd, moneda, moneda_original, monto_ves, monto_usd',
      )
      .eq('id', compraId)
      .maybeSingle();

    if (compraErr) throw compraErr;
    if (!compra) {
      return NextResponse.json({ error: 'Compra no encontrada.' }, { status: 404 });
    }

    const uploaded = await uploadProcurementDocument(
      supabase,
      compra.purchase_invoice_id?.trim() || `compra-${compraId}`,
      file,
    );

    const { error: upErr } = await supabase
      .from('contabilidad_compras')
      .update({
        document_storage_path: uploaded.path,
        document_file_name: uploaded.fileName,
      })
      .eq('id', compraId);

    if (upErr) throw upErr;

    const admin = supabaseAdminForRoute();
    const storageClient = admin.ok ? admin.client : supabase;
    const url = await createProcurementDocumentSignedUrl(storageClient, uploaded.path);

    const base = {
      ok: true as const,
      url,
      fileName: uploaded.fileName,
      mimeType: uploaded.mimeType,
      storagePath: uploaded.path,
    };

    if (!ocrEnabled) {
      return NextResponse.json({ ...base, ocr: { skipped: true } });
    }

    const mimeType = mimeFromFile(file) ?? uploaded.mimeType;
    if (!mimeType) {
      return NextResponse.json({
        ...base,
        ocr: {
          ok: false,
          error: 'Formato no soportado para OCR. Use PDF, JPG o PNG.',
        },
      });
    }

    let extracted: ExtractedPurchaseInvoice;
    try {
      const buffer = Buffer.from(await file.arrayBuffer());
      const result = await extractPurchaseInvoiceFromFile({
        buffer,
        mimeType,
        fileName: file.name,
      });
      extracted = result.data;
    } catch (ocrErr) {
      const message = ocrErr instanceof Error ? ocrErr.message : 'Error al leer la factura.';
      console.error('[POST compra document OCR]', ocrErr);
      return NextResponse.json({
        ...base,
        ocr: { ok: false, error: message },
      });
    }

    const compraCert: CompraParaCertificar = {
      id: compra.id,
      fecha: compra.fecha,
      supplier_name: compra.supplier_name,
      supplier_rif: compra.supplier_rif,
      invoice_number: compra.invoice_number,
      origen: compra.origen,
      total_amount: Number(compra.total_amount) || 0,
      total_amount_usd: compra.total_amount_usd,
      tasa_bcv_ves_por_usd: compra.tasa_bcv_ves_por_usd,
      moneda: compra.moneda,
      moneda_original: compra.moneda_original,
      monto_ves: compra.monto_ves,
      monto_usd: compra.monto_usd,
    };

    const certificacion = await compararCabeceraConFacturaOcr(compraCert, extracted);
    const itemsCount = (extracted.items ?? []).filter((it) =>
      String(it.description ?? '').trim(),
    ).length;

    let aplicado: {
      items: number;
      decision: 'mantener_cco';
      invoice_number: string;
      supplier_rif: string;
    } | null = null;
    const puedeAutoAplicar =
      certificacion.coincide &&
      itemsCount > 0 &&
      !certificacion.requiere_numero_factura &&
      !certificacion.requiere_rif;

    if (puedeAutoAplicar) {
      try {
        const db = admin.ok ? admin.client : supabase;
        const r = await aplicarCertificacionFacturaAdjunta(db, {
          compra: compraCert,
          extracted,
          decision: 'mantener_cco',
          confirmarFechaAnomala: true,
        });
        aplicado = {
          items: r.items,
          decision: 'mantener_cco',
          invoice_number: r.invoice_number,
          supplier_rif: r.supplier_rif,
        };
      } catch (applyErr) {
        console.warn('[POST compra document auto-certificar]', applyErr);
      }
    }

    return NextResponse.json({
      ...base,
      ocr: {
        ok: true,
        extracted,
        items_count: itemsCount,
        certificacion,
        requiere_confirmacion:
          !aplicado &&
          (!certificacion.coincide ||
            certificacion.requiere_numero_factura ||
            certificacion.requiere_rif ||
            itemsCount > 0),
        requiere_numero_factura: certificacion.requiere_numero_factura,
        requiere_rif: certificacion.requiere_rif,
        aplicado,
      },
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Error al adjuntar el documento.';
    console.error('[POST contabilidad compra document]', e);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

function guessMimeFromName(name: string | null | undefined): string | null {
  if (!name) return null;
  const lower = name.toLowerCase();
  if (lower.endsWith('.pdf')) return 'application/pdf';
  if (lower.endsWith('.png')) return 'image/png';
  if (lower.endsWith('.webp')) return 'image/webp';
  if (lower.endsWith('.gif')) return 'image/gif';
  if (lower.endsWith('.jpg') || lower.endsWith('.jpeg')) return 'image/jpeg';
  return null;
}
