import { processInvoiceFromCanal, type ProgresoFacturaCanal } from '@/lib/canal/processInvoiceFromCanal';
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
    await progreso.bad(safe);
    throw e;
  }
}
