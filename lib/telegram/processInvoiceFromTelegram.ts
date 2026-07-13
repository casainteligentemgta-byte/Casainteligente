import { processInvoiceFromCanal, type ProgresoFacturaCanal } from '@/lib/canal/processInvoiceFromCanal';
import { reclamarProcesamientoFacturaCanal, liberarProcesamientoObsoletoFacturaCanal } from '@/lib/canal/reservarFacturaCanalTelegram';
import { telegramSupabaseAdmin } from '@/lib/telegram/supabaseAdmin';
import { downloadTelegramFile, mimeFromTelegramPath, sendTelegramMessage } from '@/lib/telegram/botApi';
import {
  conProgresoSimulado,
  crearNotificadorProgresoFacturaTelegram,
} from '@/lib/telegram/facturaProgresoTelegram';

function progresoTelegram(chatId: string): ProgresoFacturaCanal {
  const notif = crearNotificadorProgresoFacturaTelegram(chatId);
  return {
    reportar: notif.reportar,
    ok: notif.ok,
    bad: notif.bad,
    conSimulacion: (desde, hasta, etapa, trabajo) =>
      conProgresoSimulado(desde, hasta, notif.reportar, etapa, trabajo),
  };
}

export async function processTelegramInvoicePhoto(params: {
  pendingId: string;
  chatId: string;
  fileId: string;
}): Promise<void> {
  const { buffer, filePath } = await downloadTelegramFile(params.fileId);
  const mimeType = mimeFromTelegramPath(filePath);
  const ext = filePath.split('.').pop() ?? 'jpg';

  const progreso = progresoTelegram(params.chatId);
  await progreso.reportar(5, 'Descargando archivo de Telegram…');

  const admin = telegramSupabaseAdmin();
  if (admin.ok) {
    let claim = await reclamarProcesamientoFacturaCanal(admin.client, params.pendingId);
    if (claim === 'already_processing') {
      const liberada = await liberarProcesamientoObsoletoFacturaCanal(
        admin.client,
        params.pendingId,
      );
      if (liberada) {
        claim = await reclamarProcesamientoFacturaCanal(admin.client, params.pendingId);
      }
    }
    if (claim === 'already_done') {
      const { avanzarFlujoFacturaCompradorTelegram, flujoFacturaCompradorIncompleto } =
        await import('@/lib/telegram/flujoFacturaCompradorTelegram');
      const { data: row } = await admin.client
        .from('ci_facturas_canal_pendientes')
        .select('extracted, proyecto_id, entidad_id, ubicacion_destino_id, estado')
        .eq('id', params.pendingId)
        .maybeSingle();
      const estado = String(row?.estado ?? '').toLowerCase();
      if (
        row?.extracted &&
        (estado === 'extraido' || estado === 'error') &&
        flujoFacturaCompradorIncompleto(row.extracted as never, row)
      ) {
        await avanzarFlujoFacturaCompradorTelegram(
          admin.client,
          params.chatId,
          params.pendingId,
        );
      }
      return;
    }
    if (claim === 'already_processing') {
      await sendTelegramMessage(
        params.chatId,
        '⏳ Esta factura aún se está leyendo. Espere 1–2 minutos y, si no avanza, reenvíe la foto con <code>/facturas</code>.',
        { parse_mode: 'HTML' },
      );
      return;
    }
    if (claim === 'not_found') {
      await progreso.bad('Factura pendiente no encontrada en el sistema.');
      return;
    }
  }

  try {
    await processInvoiceFromCanal({
      canal: 'telegram',
      pendingId: params.pendingId,
      chatId: params.chatId,
      buffer,
      mimeType,
      fileName: `telegram-${params.pendingId}.${ext}`,
      sendReply: (text, html) =>
        sendTelegramMessage(params.chatId, text, html ? { parse_mode: 'HTML' } : undefined),
      progreso,
    });
  } catch (e) {
    const raw = e instanceof Error ? e.message : 'Error al procesar la factura';
    const safe = raw
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
    if (admin.ok) {
      await admin.client
        .from('ci_facturas_canal_pendientes')
        .update({
          estado: 'error',
          mensaje_error: raw.slice(0, 500),
          updated_at: new Date().toISOString(),
        })
        .eq('id', params.pendingId);
    }
    await progreso.bad(safe);
    throw e;
  }
}
