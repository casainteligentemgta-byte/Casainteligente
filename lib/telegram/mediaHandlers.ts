import type { SupabaseClient } from '@supabase/supabase-js';
import { extractPurchaseInvoiceFromFile } from '@/lib/almacen/extractPurchaseInvoiceGemini';
import { PROCUREMENT_DOCUMENTS_BUCKET } from '@/lib/almacen/procurementDocumentStorage';
import { geminiGenerateText, getGeminiApiKey } from '@/lib/gemini/client';
import { GEMINI_PROCUREMENT_DEFAULT_MODEL } from '@/lib/almacen/geminiProcurementModels';
import { reservarFacturaCanalTelegram, liberarProcesamientoObsoletoFacturaCanal } from '@/lib/canal/reservarFacturaCanalTelegram';
import { processTelegramInvoicePhoto } from '@/lib/telegram/processInvoiceFromTelegram';
import type { TelegramEstado } from '@/lib/telegram/estados';
import { setTelegramContexto } from '@/lib/telegram/estados';
import {
  downloadTelegramFile,
  enviarMensajeTelegram,
  mimeFromTelegramPath,
  sendTelegramMessage,
} from '@/lib/telegram/botApi';
import { subirArchivoStorageTelegram } from '@/lib/telegram/storageUpload';
import { enviarPickerProyectosTelegram } from '@/lib/telegram/proyectoPicker';

const PROYECTO_MEDIA_BUCKET = 'ci-proyectos-media';

function baseUrlApp(): string {
  return (
    process.env.NEXT_PUBLIC_BASE_URL ??
    process.env.NEXT_PUBLIC_APP_URL ??
    'https://casainteligente.company'
  )
    .trim()
    .replace(/\/$/, '');
}

export type ManejarFacturaTelegramResult = {
  duplicate: boolean;
  pendingId: string;
};

export async function manejarFacturaTelegram(params: {
  supabase: SupabaseClient;
  chatId: string;
  chatLabel: string;
  fileId: string;
  telegramMessageId?: string | null;
}): Promise<ManejarFacturaTelegramResult> {
  const reserva = await reservarFacturaCanalTelegram(params.supabase, {
    canal: 'telegram',
    chatId: params.chatId,
    chatLabel: params.chatLabel,
    telegramMessageId: params.telegramMessageId,
  });

  if (!reserva.ok) {
    await sendTelegramMessage(params.chatId, '❌ Error al registrar la factura.');
    throw new Error(reserva.error);
  }

  const estadoPrev = await params.supabase
    .from('ci_telegram_estados')
    .select('metadata, proyecto_id')
    .eq('chat_id', params.chatId)
    .maybeSingle();
  const metaPrev = (estadoPrev.data?.metadata ?? {}) as Record<string, unknown>;
  const procuraId = String(metaPrev.procura_id ?? '').trim() || null;
  const procuraTicket = String(metaPrev.procura_ticket ?? '').trim() || null;

  await setTelegramContexto(params.supabase, params.chatId, {
    contexto: 'factura',
    pending_factura_id: reserva.pendingId,
    proyecto_id: estadoPrev.data?.proyecto_id ?? null,
    metadata: {
      ...metaPrev,
      ...(procuraId ? { procura_id: procuraId } : {}),
      ...(procuraTicket ? { procura_ticket: procuraTicket } : {}),
    },
  });

  const debeReprocesar = async (): Promise<boolean> => {
    const { data: prev } = await params.supabase
      .from('ci_facturas_canal_pendientes')
      .select('estado, extracted, proyecto_id, entidad_id, ubicacion_destino_id')
      .eq('id', reserva.pendingId)
      .maybeSingle();
    const estado = String(prev?.estado ?? '');
    if (prev?.extracted) {
      return false;
    }
    if (estado === 'procesando') {
      await liberarProcesamientoObsoletoFacturaCanal(params.supabase, reserva.pendingId);
    }
    return ['recibido', 'pendiente', 'procesando', 'error'].includes(estado);
  };

  const reanudarFlujoSiPendiente = async (): Promise<void> => {
    const { avanzarFlujoFacturaCompradorTelegram, flujoFacturaCompradorIncompleto } =
      await import('@/lib/telegram/flujoFacturaCompradorTelegram');
    const { data: prev } = await params.supabase
      .from('ci_facturas_canal_pendientes')
      .select('extracted, proyecto_id, entidad_id, ubicacion_destino_id, estado')
      .eq('id', reserva.pendingId)
      .maybeSingle();
    const estado = String(prev?.estado ?? '').toLowerCase();
    if (
      prev?.extracted &&
      (estado === 'extraido' || estado === 'error') &&
      flujoFacturaCompradorIncompleto(prev.extracted as never, prev)
    ) {
      await avanzarFlujoFacturaCompradorTelegram(
        params.supabase,
        params.chatId,
        reserva.pendingId,
      );
    }
  };

  if (reserva.duplicate) {
    if (await debeReprocesar()) {
      await processTelegramInvoicePhoto({
        pendingId: reserva.pendingId,
        chatId: params.chatId,
        fileId: params.fileId,
      });
    } else {
      await reanudarFlujoSiPendiente();
    }
    return { duplicate: true, pendingId: reserva.pendingId };
  }

  await processTelegramInvoicePhoto({
    pendingId: reserva.pendingId,
    chatId: params.chatId,
    fileId: params.fileId,
  });

  return { duplicate: false, pendingId: reserva.pendingId };
}

export async function manejarFotoObraTelegram(params: {
  supabase: SupabaseClient;
  chatId: string;
  estado: TelegramEstado;
  fileId: string;
  caption?: string;
}): Promise<void> {
  const proyectoId = params.estado.proyecto_id;
  if (!proyectoId) {
    await sendTelegramMessage(
      params.chatId,
      '⚠️ Elige la obra en la lista:',
      { parse_mode: 'HTML' },
    );
    await enviarPickerProyectosTelegram(params.supabase, params.chatId, 'obra');
    return;
  }

  const { buffer, filePath } = await downloadTelegramFile(params.fileId);
  const mimeType = mimeFromTelegramPath(filePath);
  const ext = filePath.split('.').pop() ?? 'jpg';
  const storagePath = `telegram/${proyectoId}/${Date.now()}.${ext}`;

  await subirArchivoStorageTelegram({
    supabase: params.supabase,
    chatId: params.chatId,
    bucketName: PROYECTO_MEDIA_BUCKET,
    fileName: storagePath,
    buffer,
    contentType: mimeType,
  });

  const fotos = Array.isArray(params.estado.metadata.fotos_obra)
    ? [...(params.estado.metadata.fotos_obra as string[])]
    : [];
  fotos.push(storagePath);

  await setTelegramContexto(params.supabase, params.chatId, {
    metadata: {
      fotos_obra: fotos,
      ultima_foto: storagePath,
      ultima_caption: params.caption ?? null,
    },
  });

  const link = `${baseUrlApp()}/proyectos/modulo/${proyectoId}`;
  await sendTelegramMessage(
    params.chatId,
    `✅ Foto guardada en <b>ci-proyectos-media</b>\n` +
      (params.caption ? `📝 ${params.caption}\n` : '') +
      `🔗 <a href="${link}">Abrir módulo proyecto</a>`,
    { parse_mode: 'HTML' },
  );
}

type GastoExtraido = {
  proveedor?: string;
  descripcion?: string;
  costo?: number;
  fecha?: string;
};

async function extraerGastoConGemini(
  buffer: Buffer,
  mimeType: string,
  fileName: string,
): Promise<GastoExtraido | null> {
  if (!getGeminiApiKey()) return null;

  try {
    if (mimeType.startsWith('image/') || mimeType === 'application/pdf') {
      const { data } = await extractPurchaseInvoiceFromFile({
        buffer,
        mimeType,
        fileName,
      });
      return {
        proveedor: data.supplier_name ?? undefined,
        descripcion: `Gasto Telegram — ${data.invoice_number ?? 'sin nº'}`,
        costo: data.total_amount != null ? Number(data.total_amount) : undefined,
        fecha: data.date ?? undefined,
      };
    }
  } catch {
    /* fallback texto */
  }

  const base64 = buffer.toString('base64');
  const raw = await geminiGenerateText({
    model: GEMINI_PROCUREMENT_DEFAULT_MODEL,
    prompt: 'Extrae proveedor, descripcion breve, costo numérico y fecha YYYY-MM-DD del comprobante.',
    systemInstruction: 'OCR de comprobantes de gasto de obra en Venezuela. JSON: {"proveedor","descripcion","costo","fecha"}',
    temperature: 0,
    maxOutputTokens: 512,
    responseMimeType: 'application/json',
  });

  try {
    return JSON.parse(raw) as GastoExtraido;
  } catch {
    return null;
  }
}

export async function manejarGastoObraTelegram(params: {
  supabase: SupabaseClient;
  chatId: string;
  estado: TelegramEstado;
  fileId: string;
  caption?: string;
}): Promise<void> {
  const proyectoId = params.estado.proyecto_id;
  if (!proyectoId) {
    await sendTelegramMessage(params.chatId, '⚠️ Elige la obra para el gasto:', {
      parse_mode: 'HTML',
    });
    await enviarPickerProyectosTelegram(params.supabase, params.chatId, 'gasto_obra');
    return;
  }

  const { buffer, filePath } = await downloadTelegramFile(params.fileId);
  const mimeType = mimeFromTelegramPath(filePath);
  const ext = filePath.split('.').pop() ?? 'jpg';
  const storagePath = `telegram-gastos/${proyectoId}/${Date.now()}.${ext}`;

  await subirArchivoStorageTelegram({
    supabase: params.supabase,
    chatId: params.chatId,
    bucketName: PROCUREMENT_DOCUMENTS_BUCKET,
    fileName: storagePath,
    buffer,
    contentType: mimeType,
  });

  await enviarMensajeTelegram(params.chatId, '⏳ Analizando comprobante con Gemini…');

  const extraido =
    (await extraerGastoConGemini(
      buffer,
      mimeType,
      `telegram-gasto-${Date.now()}.${ext}`,
    )) ?? {};

  const costo = Number(extraido.costo ?? 0);
  const fecha =
    extraido.fecha && /^\d{4}-\d{2}-\d{2}$/.test(extraido.fecha)
      ? extraido.fecha
      : new Date().toISOString().slice(0, 10);

  const { data: gasto, error: insErr } = await params.supabase
    .from('gastos_obra')
    .insert({
      proyecto_id: proyectoId,
      origen: 'telegram',
      fecha,
      tipo: 'egreso',
      disciplina: 'general',
      proveedor: String(extraido.proveedor ?? params.caption ?? 'Telegram').slice(0, 200),
      descripcion: String(
        extraido.descripcion ?? params.caption ?? 'Comprobante vía Telegram',
      ).slice(0, 500),
      costo: Number.isFinite(costo) ? costo : 0,
    })
    .select('id')
    .single();

  if (insErr || !gasto) {
    await sendTelegramMessage(params.chatId, `❌ No se guardó el gasto: ${insErr?.message}`);
    return;
  }

  await setTelegramContexto(params.supabase, params.chatId, {
    metadata: {
      ultimo_gasto_id: gasto.id,
      ultimo_comprobante_path: storagePath,
    },
  });

  const link = `${baseUrlApp()}/proyectos/modulo/${proyectoId}/control-obra`;
  await sendTelegramMessage(
    params.chatId,
    `✅ <b>Gasto registrado</b>\n` +
      `🏢 ${extraido.proveedor ?? '—'}\n` +
      `💰 ${Number.isFinite(costo) ? costo.toLocaleString('es-VE') : '0'} Bs\n` +
      `📅 ${fecha}\n` +
      `📁 Comprobante en procurement-documents\n` +
      `<a href="${link}">Ver control de obra</a>`,
    { parse_mode: 'HTML' },
  );
}
