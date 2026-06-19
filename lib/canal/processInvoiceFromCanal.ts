import { createClient } from '@supabase/supabase-js';
import { reclamarProcesamientoFacturaCanal } from '@/lib/canal/reservarFacturaCanalTelegram';
import {
  buscarCompraContablePorFactura,
  buscarPendienteCanalDuplicado,
} from '@/lib/contabilidad/buscarCompraContablePorFactura';
import {
  evaluarYProcesarFastTrack,
  type DatosOcrFastTrack,
} from '@/lib/canal/evaluarYProcesarFastTrack';
import { extractPurchaseInvoiceFromFile } from '@/lib/almacen/extractPurchaseInvoiceGemini';
import {
  mensajeAmigableErrorStorage,
  PROCUREMENT_DOCUMENTS_BUCKET,
} from '@/lib/almacen/procurementDocumentStorage';
import { formatTotalExtracted } from '@/lib/contabilidad/extractedCanal';
import { linkConfirmarCompraTelegram } from '@/lib/contabilidad/confirmarCompraDesdeCanal';

export type CanalFactura = 'telegram' | 'whatsapp';

function baseUrlApp(): string {
  return (
    process.env.NEXT_PUBLIC_BASE_URL ??
    process.env.NEXT_PUBLIC_APP_URL ??
    'https://casainteligente.company'
  )
    .trim()
    .replace(/\/$/, '');
}

function supabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const key =
    process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();
  if (!url || !key) throw new Error('Supabase no configurado');
  return createClient(url, key);
}

export type ProgresoFacturaCanal = {
  reportar: (pct: number, etapa: string) => Promise<void>;
  ok: (detalleHtml: string) => Promise<void>;
  bad: (detalle: string) => Promise<void>;
  /** Avance simulado durante OCR/Gemini (opcional). */
  conSimulacion?: (
    desde: number,
    hasta: number,
    etapa: string,
    trabajo: () => Promise<void>,
  ) => Promise<void>;
};

export async function processInvoiceFromCanal(params: {
  canal: CanalFactura;
  pendingId: string;
  chatId: string;
  buffer: Buffer;
  mimeType: string;
  fileName: string;
  sendReply: (text: string, html?: boolean) => Promise<void>;
  progreso?: ProgresoFacturaCanal;
}): Promise<void> {
  const supabase = supabaseAdmin();
  try {
    await processInvoiceFromCanalCore(supabase, params);
  } catch (e) {
    const raw = e instanceof Error ? e.message : String(e);
    const { data: row } = await supabase
      .from('ci_facturas_canal_pendientes')
      .select('estado, chat_label')
      .eq('id', params.pendingId)
      .maybeSingle();

    if (String(row?.estado ?? '') === 'procesando') {
      const { notificarFacturaCanalAtascadaAsync } = await import('@/lib/telegram/notifyErrorBot');
      notificarFacturaCanalAtascadaAsync({
        pendingId: params.pendingId,
        chatLabel: row?.chat_label,
        detalle: raw.slice(0, 300),
      });
    }
    throw e;
  }
}

async function processInvoiceFromCanalCore(
  supabase: ReturnType<typeof supabaseAdmin>,
  params: {
    canal: CanalFactura;
    pendingId: string;
    chatId: string;
    buffer: Buffer;
    mimeType: string;
    fileName: string;
    sendReply: (text: string, html?: boolean) => Promise<void>;
    progreso?: ProgresoFacturaCanal;
  },
): Promise<void> {
  const prog = params.progreso;
  const ext =
    params.fileName.split('.').pop()?.toLowerCase() ||
    (params.mimeType === 'application/pdf' ? 'pdf' : 'jpg');
  const storagePath = `${params.canal}-pending/${params.pendingId}/${Date.now()}.${ext}`;

  await prog?.reportar(10, 'Preparando archivo…');

  const { error: upErr } = await supabase.storage
    .from(PROCUREMENT_DOCUMENTS_BUCKET)
    .upload(storagePath, params.buffer, {
      contentType: params.mimeType,
      upsert: true,
    });
  if (upErr) {
    throw new Error(mensajeAmigableErrorStorage(upErr.message, 'subir'));
  }

  await prog?.reportar(30, 'Subiendo documento al almacén…');

  await supabase
    .from('ci_facturas_canal_pendientes')
    .update({
      document_storage_path: storagePath,
      document_file_name: params.fileName,
      document_mime_type: params.mimeType,
      updated_at: new Date().toISOString(),
    })
    .eq('id', params.pendingId);

  await prog?.reportar(45, 'Iniciando análisis con IA…');

  const link = linkConfirmarCompraTelegram(params.pendingId, baseUrlApp());

  let extracted: Record<string, unknown> | null = null;
  let mensajeError: string | null = null;

  const extraer = async () => {
    const { data, fromGemini, modelUsed } = await extractPurchaseInvoiceFromFile({
      buffer: params.buffer,
      mimeType: params.mimeType,
      fileName: params.fileName,
    });
    extracted = { ...data, fromGemini, modelUsed };
  };

  try {
    if (prog?.conSimulacion) {
      await prog.conSimulacion(50, 88, 'Extrayendo datos de la factura…', extraer);
    } else {
      await prog?.reportar(55, 'Extrayendo datos con Gemini…');
      await extraer();
    }
  } catch (e) {
    mensajeError = e instanceof Error ? e.message : 'Error OCR';
  }

  if (mensajeError || !extracted) {
    await supabase
      .from('ci_facturas_canal_pendientes')
      .update({
        estado: 'error',
        mensaje_error: mensajeError,
        updated_at: new Date().toISOString(),
      })
      .eq('id', params.pendingId);

    const detalleBad = `${mensajeError ?? 'Error desconocido'}\n\n<a href="${link}">Ver en la app</a>`;
    if (prog) {
      await prog.bad(detalleBad);
    } else {
      await params.sendReply(
        `❌ No pude leer la factura.\n${mensajeError ?? 'Error desconocido'}\n\n${link}`,
        false,
      );
    }
    return;
  }

  await prog?.reportar(95, 'Guardando en la aplicación…');

  const datosOcr = extracted as DatosOcrFastTrack;
  /** El comprador confirma Bs/USD tras el OCR; no asumir bolívares por defecto. */
  const datosSinMoneda = { ...datosOcr, moneda: undefined };

  await supabase
    .from('ci_facturas_canal_pendientes')
    .update({
      estado: 'extraido',
      extracted: datosSinMoneda,
      mensaje_error: null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', params.pendingId);

  const facturaNum = String(datosOcr.invoice_number ?? 'S/N').trim();
  const dupParams = {
    invoice_number: facturaNum,
    supplier_rif: datosOcr.supplier_rif,
    supplier_name: datosOcr.supplier_name,
  };

  const dupCompra = await buscarCompraContablePorFactura(supabase, {
    ...dupParams,
    ignorar_proyecto: true,
  });
  const dupPendiente = await buscarPendienteCanalDuplicado(supabase, {
    ...dupParams,
    excluirId: params.pendingId,
  });

  const purchaseInvoiceIdExistente =
    dupCompra?.purchase_invoice_id?.trim() ||
    dupPendiente?.purchase_invoice_id?.trim() ||
    null;

  if (purchaseInvoiceIdExistente) {
    await supabase
      .from('ci_facturas_canal_pendientes')
      .update({
        estado: 'confirmado',
        purchase_invoice_id: purchaseInvoiceIdExistente,
        mensaje_error: null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', params.pendingId);

    await prog?.reportar(100, 'Completado');

    const msgDuplicada =
      `ℹ️ <b>Factura ya registrada en Contabilidad</b>\n\n` +
      `Nº: ${facturaNum}\n` +
      `Proveedor: ${datosOcr.supplier_name ?? '—'}\n` +
      `RIF: ${datosOcr.supplier_rif ?? '—'}\n\n` +
      `No se creó un registro duplicado.\n` +
      `El depositario puede ingresar físicamente con <code>/ingreso</code> → ingreso manual de factura.`;

    if (prog) {
      await prog.ok('');
      await params.sendReply(msgDuplicada, true);
    } else {
      await params.sendReply(msgDuplicada, false);
    }
    return;
  }

  // Fast-Track con ingreso a stock: solo app/WhatsApp. En Telegram el comprador registra
  // contabilidad; el depositario ingresa físicamente con /ingresofactura.
  let fastTrackMsg = '';
  if (params.canal !== 'telegram') {
    const ft = await evaluarYProcesarFastTrack(supabase, params.pendingId, datosOcr);
    if (ft.estado === 'aprobado_sistema') {
      fastTrackMsg =
        `\n⚡ <b>Fast-Track</b> (${ft.confidenceScore?.toFixed(0) ?? '—'}% confianza): aprobado_sistema e ingreso a inventario.`;
    } else if (ft.error) {
      console.warn('[processInvoiceFromCanal] fast-track degradado:', ft.error);
    }
  }

  await prog?.reportar(100, 'Completado');

  const inv = datosSinMoneda;
  const nItems = Array.isArray(inv.items) ? inv.items.length : 0;
  const plain =
    `✅ Factura recibida\n\n` +
    `Nº: ${inv.invoice_number ?? '—'}\n` +
    `Proveedor: ${inv.supplier_name ?? '—'}\n` +
    `RIF: ${inv.supplier_rif ?? '—'}\n` +
    `Total: ${formatTotalExtracted(inv, { sinMoneda: true })}\n` +
    `Líneas: ${nItems}${fastTrackMsg ? `\n${fastTrackMsg}` : ''}\n\n` +
    `Indique moneda (Bs o USD), contado/crédito y confirme en: ${link}`;

  if (prog) {
    await prog.ok('');
    if (params.canal === 'telegram' && !fastTrackMsg) {
      const { continuarPostOcrFacturaTelegram } = await import('@/lib/telegram/fechaFacturaPicker');
      await continuarPostOcrFacturaTelegram(supabase, params.chatId, params.pendingId, datosSinMoneda);
    }
  } else {
    await params.sendReply(plain, false);
  }
}
