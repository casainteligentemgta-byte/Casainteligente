import { createClient } from '@supabase/supabase-js';
import { resolveSupabaseServiceRoleKey } from '@/lib/supabase/resolveServiceRoleKey';
import {
  buscarCompraContablePorFactura,
  buscarPendienteCanalDuplicado,
} from '@/lib/contabilidad/buscarCompraContablePorFactura';
import {
  evaluarYProcesarFastTrack,
  type DatosOcrFastTrack,
} from '@/lib/canal/evaluarYProcesarFastTrack';
import { extractPurchaseInvoiceFromFiles } from '@/lib/almacen/extractPurchaseInvoiceGemini';
import { fusionarLineasAlbum, totalesAlbumCuadran } from '@/lib/canal/fusionarLineasAlbumFactura';
import type { ParteDocumentoCanal } from '@/lib/canal/documentPartsPendiente';
import {
  avisarErrorCargaFacturaCanal,
  clasificarErrorCargaFactura,
  textoAvisoErrorCarga,
} from '@/lib/telegram/avisoErrorCargaFactura';
import {
  mensajeAmigableErrorStorage,
  PROCUREMENT_DOCUMENTS_BUCKET,
} from '@/lib/almacen/procurementDocumentStorage';
import { formatTotalExtracted, type ExtractedCanalHeader } from '@/lib/contabilidad/extractedCanal';
import { textoAnomaliasParaNotificacion, textoAnomaliasTelegramHtml } from '@/lib/compras/proveedorMemoria';
import { linkConfirmarCompraTelegram } from '@/lib/contabilidad/confirmarCompraDesdeCanal';
import {
  MENSAJE_FACTURA_DUPLICADA,
  esErrorFacturaDuplicada,
  marcarPendienteDuplicado,
} from '@/lib/canal/facturaDuplicada';

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
  const key = resolveSupabaseServiceRoleKey();
  if (!url || !key) throw new Error('Supabase no configurado (falta la llave de servidor)');
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

export type ArchivoCanalFactura = {
  buffer: Buffer;
  mimeType: string;
  fileName: string;
  storagePath?: string;
};

export async function processInvoiceFromCanal(params: {
  canal: CanalFactura;
  pendingId: string;
  chatId: string;
  buffer: Buffer;
  mimeType: string;
  fileName: string;
  /** Varias fotos del mismo álbum, en orden. Si viene, se ignora el buffer suelto. */
  archivos?: ArchivoCanalFactura[];
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

    if (params.canal === 'telegram') {
      await avisarErrorCargaFacturaCanal({
        pendingId: params.pendingId,
        chatId: params.chatId,
        errorOriginal: e,
        supabase,
      });
    }

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
    archivos?: ArchivoCanalFactura[];
    sendReply: (text: string, html?: boolean) => Promise<void>;
    progreso?: ProgresoFacturaCanal;
  },
): Promise<void> {
  const prog = params.progreso;
  const archivos: ArchivoCanalFactura[] =
    params.archivos && params.archivos.length > 0
      ? params.archivos
      : [
          {
            buffer: params.buffer,
            mimeType: params.mimeType,
            fileName: params.fileName,
          },
        ];
  const esAlbum = archivos.length > 1;

  await prog?.reportar(10, esAlbum ? 'Preparando las fotos del álbum…' : 'Preparando archivo…');

  const parts: ParteDocumentoCanal[] = [];
  for (let i = 0; i < archivos.length; i++) {
    const archivo = archivos[i];
    const ext =
      archivo.fileName.split('.').pop()?.toLowerCase() ||
      (archivo.mimeType === 'application/pdf' ? 'pdf' : 'jpg');
    let storagePath = String(archivo.storagePath ?? '').trim();
    if (!storagePath) {
      storagePath = `${params.canal}-pending/${params.pendingId}/${i}-${Date.now()}.${ext}`;
      const { error: upErr } = await supabase.storage
        .from(PROCUREMENT_DOCUMENTS_BUCKET)
        .upload(storagePath, archivo.buffer, {
          contentType: archivo.mimeType,
          upsert: true,
        });
      if (upErr) {
        throw new Error(mensajeAmigableErrorStorage(upErr.message, 'subir'));
      }
    }
    parts.push({
      orden: i,
      storage_path: storagePath,
      mime_type: archivo.mimeType,
      file_name: archivo.fileName,
    });
  }

  const primario = parts[0];
  await prog?.reportar(30, esAlbum ? 'Fotos guardadas. Analizando…' : 'Subiendo documento al almacén…');

  {
    const payloadDoc: Record<string, unknown> = {
      document_storage_path: primario.storage_path,
      document_file_name: primario.file_name,
      document_mime_type: primario.mime_type,
      document_parts: parts,
      updated_at: new Date().toISOString(),
    };
    const upDoc = await supabase
      .from('ci_facturas_canal_pendientes')
      .update(payloadDoc)
      .eq('id', params.pendingId);
    if (upDoc.error && /document_parts|PGRST204|schema cache/i.test(upDoc.error.message)) {
      delete payloadDoc.document_parts;
      await supabase
        .from('ci_facturas_canal_pendientes')
        .update(payloadDoc)
        .eq('id', params.pendingId);
    }
  }

  await prog?.reportar(45, 'Iniciando análisis con IA…');

  const link = linkConfirmarCompraTelegram(params.pendingId, baseUrlApp());

  let extracted: Record<string, unknown> | null = null;
  let mensajeError: string | null = null;

  const extraer = async () => {
    const { hintExtraccionParaPendiente } = await import('@/lib/compras/proveedorMemoriaDb');
    const hintProveedor = await hintExtraccionParaPendiente(supabase, {
      pendingId: params.pendingId,
      chatId: params.chatId,
    });
    const { data, fromGemini, modelUsed } = await extractPurchaseInvoiceFromFiles({
      files: archivos.map((a) => ({
        buffer: a.buffer,
        mimeType: a.mimeType,
        fileName: a.fileName,
      })),
      hintProveedor,
    });
    extracted = { ...data, fromGemini, modelUsed, album_partes: archivos.length };
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

    const tipo = clasificarErrorCargaFactura(mensajeError ?? 'Error desconocido');
    const aviso = textoAvisoErrorCarga(tipo);
    let mostrado = false;
    if (prog) {
      try {
        await prog.bad(aviso);
        mostrado = true;
      } catch {
        /* el aviso por mensaje nuevo cubre este caso */
      }
    }
    if (params.canal === 'telegram') {
      await avisarErrorCargaFacturaCanal({
        pendingId: params.pendingId,
        chatId: params.chatId,
        tipo,
        supabase,
        yaMostrado: mostrado,
      });
    } else if (!mostrado) {
      await params.sendReply(
        `❌ No pude leer la factura.\n${mensajeError ?? 'Error desconocido'}\n\n${link}`,
        false,
      );
    }
    return;
  }

  const itemsRaw = Array.isArray((extracted as { items?: unknown }).items)
    ? ((extracted as { items: Array<Record<string, unknown>> }).items ?? [])
    : [];
  if (esAlbum && itemsRaw.length > 0) {
    const fused = fusionarLineasAlbum(
      itemsRaw.map((it) => ({
        description: String(it.description ?? ''),
        item_code: String(it.item_code ?? ''),
        unit: String(it.unit ?? 'UND'),
        quantity: Number(it.quantity) || 0,
        unit_price: Number(it.unit_price) || 0,
      })),
    );
    extracted = { ...extracted, items: fused };
    const cuadre = totalesAlbumCuadran({
      items: fused,
      total: (extracted as { total_amount?: number | null }).total_amount,
    });
    if (!cuadre.ok) {
      const mensajeAlbum =
        cuadre.motivo === 'sin_total'
          ? 'Falta una parte de la factura (no se leyó el total).'
          : 'Falta una parte de la factura (totales no cuadran).';
      {
        const payloadAlbum: Record<string, unknown> = {
          estado: 'error',
          extracted,
          mensaje_error: mensajeAlbum,
          requiere_revision: true,
          updated_at: new Date().toISOString(),
        };
        const upAlbum = await supabase
          .from('ci_facturas_canal_pendientes')
          .update(payloadAlbum)
          .eq('id', params.pendingId);
        if (upAlbum.error && /requiere_revision|PGRST204|schema cache/i.test(upAlbum.error.message)) {
          delete payloadAlbum.requiere_revision;
          await supabase
            .from('ci_facturas_canal_pendientes')
            .update(payloadAlbum)
            .eq('id', params.pendingId);
        }
      }
      const aviso = textoAvisoErrorCarga('falta_parte');
      let mostrado = false;
      if (prog) {
        try {
          await prog.bad(aviso);
          mostrado = true;
        } catch {
          /* aviso por mensaje nuevo */
        }
      }
      if (params.canal === 'telegram') {
        await avisarErrorCargaFacturaCanal({
          pendingId: params.pendingId,
          chatId: params.chatId,
          tipo: 'falta_parte',
          supabase,
          yaMostrado: mostrado,
        });
      } else if (!mostrado) {
        await params.sendReply(aviso, false);
      }
      return;
    }
  }

  await prog?.reportar(95, 'Guardando en la aplicación…');

  const datosOcr = extracted as DatosOcrFastTrack;
  /** El comprador confirma Bs/USD y contado/crédito; el perfil puede sugerirlos. */
  const datosSinConfirmacionComprador = {
    ...datosOcr,
    moneda: null,
    condicion_pago: null,
    dias_credito: null,
  } as DatosOcrFastTrack & {
    moneda: null;
    condicion_pago: null;
    dias_credito: null;
  };

  const { enriquecerExtractedConMemoria } = await import('@/lib/compras/proveedorMemoriaDb');
  const memoria = await enriquecerExtractedConMemoria(
    supabase,
    datosSinConfirmacionComprador as ExtractedCanalHeader,
  );
  const datosConMemoria = memoria.extracted;
  const anomalias = memoria.anomalias;

  const payloadExtraido: Record<string, unknown> = {
    estado: 'extraido',
    extracted: datosConMemoria,
    mensaje_error: null,
    requiere_revision: false,
    updated_at: new Date().toISOString(),
  };
  let { error: errGuardarExtraccion } = await supabase
    .from('ci_facturas_canal_pendientes')
    .update(payloadExtraido)
    .eq('id', params.pendingId);
  if (errGuardarExtraccion && /requiere_revision|PGRST204|schema cache/i.test(errGuardarExtraccion.message)) {
    delete payloadExtraido.requiere_revision;
    const retryExtraido = await supabase
      .from('ci_facturas_canal_pendientes')
      .update(payloadExtraido)
      .eq('id', params.pendingId);
    errGuardarExtraccion = retryExtraido.error;
  }

  // Otra carga ya tiene el mismo RIF y número (índice único, mig. 372): no se guarda esta.
  if (esErrorFacturaDuplicada(errGuardarExtraccion)) {
    await marcarPendienteDuplicado(supabase, params.pendingId);
    const msgDuplicadaCarga = `⚠️ <b>Factura duplicada</b>\n\n${MENSAJE_FACTURA_DUPLICADA}`;
    if (prog) {
      await prog.ok('');
      await params.sendReply(msgDuplicadaCarga, true);
    } else {
      await params.sendReply(msgDuplicadaCarga, false);
    }
    return;
  }

  const { data: rowLog } = await supabase
    .from('ci_facturas_canal_pendientes')
    .select('chat_id, chat_label')
    .eq('id', params.pendingId)
    .maybeSingle();

  const facturaNumLog = String(datosConMemoria.invoice_number ?? datosOcr.invoice_number ?? 'S/N').trim();
  const avisoAnomalias = textoAnomaliasParaNotificacion(anomalias);
  const { notificarEventoSistemaLogAsync } = await import('@/lib/telegram/logBotAuditoria');
  notificarEventoSistemaLogAsync({
    chatId: rowLog?.chat_id != null ? String(rowLog.chat_id) : null,
    chatLabel: rowLog?.chat_label,
    modulo: 'Compras · OCR',
    evento: anomalias.length ? 'Factura extraída · con alertas' : 'Factura extraída (OCR listo)',
    detalle:
      `Nº ${facturaNumLog} · ${datosConMemoria.supplier_name?.trim() || '—'} · RIF ${datosConMemoria.supplier_rif?.trim() || '—'}` +
      (avisoAnomalias ? ` · ${avisoAnomalias}` : ''),
  });

  const facturaNum = facturaNumLog;
  const dupParams = {
    invoice_number: facturaNum,
    supplier_rif: datosConMemoria.supplier_rif ?? datosOcr.supplier_rif,
    supplier_name: datosConMemoria.supplier_name ?? datosOcr.supplier_name,
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
    // Solo se confirma si la compra ya existe en contabilidad (con su obra y almacén).
    // Un duplicado que apunta a otra factura pendiente no tiene destino: queda extraída
    // para que el comprador elija obra y almacén, sin crear una compra nueva.
    const yaEnContabilidad = Boolean(dupCompra?.purchase_invoice_id?.trim());

    await supabase
      .from('ci_facturas_canal_pendientes')
      .update({
        estado: yaEnContabilidad ? 'confirmado' : 'extraido',
        purchase_invoice_id: yaEnContabilidad ? purchaseInvoiceIdExistente : null,
        mensaje_error: null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', params.pendingId);

    await prog?.reportar(100, 'Completado');

    const msgDuplicada = yaEnContabilidad
      ? `ℹ️ <b>Factura ya registrada en Contabilidad</b>\n\n` +
        `Nº: ${facturaNum}\n` +
        `Proveedor: ${datosOcr.supplier_name ?? '—'}\n` +
        `RIF: ${datosOcr.supplier_rif ?? '—'}\n\n` +
        `No se creó un registro duplicado.\n` +
        `El depositario puede ingresar físicamente con <code>/ingreso</code> → ingreso manual de factura.`
      : `⚠️ <b>Factura parecida a otra pendiente de ingreso</b>\n\n` +
        `Nº: ${facturaNum}\n` +
        `Proveedor: ${datosOcr.supplier_name ?? '—'}\n` +
        `RIF: ${datosOcr.supplier_rif ?? '—'}\n\n` +
        `No se creó un registro nuevo. Revísela en <code>/factura</code> y elija obra y almacén.`;

    if (prog) {
      await prog.ok('');
      await params.sendReply(msgDuplicada, true);
    } else {
      await params.sendReply(msgDuplicada, false);
    }
    return;
  }

  // Estación de servicio (Telegram): a compras de una vez, sin pulsar Confirmar.
  if (params.canal === 'telegram') {
    const { autoConfirmarCompraEstacionServicio } = await import(
      '@/lib/canal/autoConfirmarCompraEstacionServicio'
    );
    const auto = await autoConfirmarCompraEstacionServicio(
      supabase,
      params.pendingId,
      datosConMemoria as DatosOcrFastTrack,
    );
    if (auto.aplicado) {
      await prog?.reportar(100, 'Completado');
      const { resumenFacturaCompradorHtml } = await import('@/lib/telegram/mensajesFactura');
      const msg =
        '⛽ <b>Estación de servicio</b> — compra registrada automáticamente en Contabilidad.\n\n' +
        resumenFacturaCompradorHtml(
          (auto.extracted ?? datosConMemoria) as Record<string, unknown>,
        );
      if (prog) {
        await prog.ok('Estación de servicio: compra registrada en Contabilidad.');
      }
      await params.sendReply(msg, true);
      try {
        const { setTelegramContexto } = await import('@/lib/telegram/estados');
        await setTelegramContexto(supabase, params.chatId, {
          contexto: 'menu',
          pending_factura_id: null,
          metadata: {},
        });
      } catch (e) {
        console.warn('[processInvoiceFromCanal] contexto Telegram tras auto-confirm EDS:', e);
      }
      return;
    }
    if (auto.detectada && auto.motivo) {
      console.warn(
        `[processInvoiceFromCanal] EDS no auto-confirmada (${params.pendingId}): ${auto.motivo}`,
      );
    }
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

  const inv = datosConMemoria;
  const nItems = Array.isArray(inv.items) ? inv.items.length : 0;
  const alertaHtml = textoAnomaliasTelegramHtml(anomalias);
  const plain =
    `✅ Factura recibida\n\n` +
    `Nº: ${inv.invoice_number ?? '—'}\n` +
    `Proveedor: ${inv.supplier_name ?? '—'}\n` +
    `RIF: ${inv.supplier_rif ?? '—'}\n` +
    `Total: ${formatTotalExtracted(inv, { sinMoneda: !inv.moneda })}\n` +
    `Líneas: ${nItems}${fastTrackMsg ? `\n${fastTrackMsg}` : ''}` +
    (avisoAnomalias ? `\n${avisoAnomalias}` : '') +
    `\n\nIndique moneda (Bs o USD), contado/crédito y confirme en: ${link}`;

  if (prog) {
    // No pedir moneda/pago en texto plano: los InlineKeyboard salen justo después.
    await prog.ok(
      anomalias.length
        ? 'Análisis listo, con alertas. Use los botones que aparecen a continuación.'
        : 'Análisis listo. Use los botones que aparecen a continuación.',
    );
    if (alertaHtml) {
      await params.sendReply(alertaHtml.trim(), true);
    }
    if (params.canal === 'telegram' && !fastTrackMsg) {
      try {
        const { avanzarFlujoFacturaCompradorTelegram } = await import(
          '@/lib/telegram/flujoFacturaCompradorTelegram'
        );
        const paso = await avanzarFlujoFacturaCompradorTelegram(
          supabase,
          params.chatId,
          params.pendingId,
        );
        if (paso === 'completo') {
          await params.sendReply(
            '✅ Factura leída. Si faltan pasos (moneda, pago o almacén), reenvíe la foto con <code>/facturas</code>.',
            true,
          );
        }
      } catch (e) {
        console.error('[processInvoiceFromCanal] flujo comprador post-OCR:', e);
        await params.sendReply(
          '✅ Factura leída. Si no ve los botones de <b>moneda</b>, <b>contado/crédito</b> o <b>almacén</b>, reenvíe la foto con <code>/facturas</code>.',
          true,
        );
      }
    }
    if (params.canal === 'telegram') {
      const { enviarOfertaCorreccion } = await import('@/lib/telegram/correccionFacturaTelegram');
      await enviarOfertaCorreccion(params.chatId, params.pendingId);
    }
  } else {
    await params.sendReply(plain, false);
    if (params.canal === 'telegram' && !fastTrackMsg) {
      try {
        const { avanzarFlujoFacturaCompradorTelegram } = await import(
          '@/lib/telegram/flujoFacturaCompradorTelegram'
        );
        await avanzarFlujoFacturaCompradorTelegram(
          supabase,
          params.chatId,
          params.pendingId,
        );
      } catch (e) {
        console.error('[processInvoiceFromCanal] flujo comprador (sin prog):', e);
      }
    }
  }
}
