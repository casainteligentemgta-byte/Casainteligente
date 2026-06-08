import { sendTelegramMessage } from '@/lib/telegram/botApi';
import { etiquetaEstadoProcura } from '@/lib/procuras/procuraEstados';

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

export type ProcuraNotificacionRow = {
  ticket: string;
  material_txt: string;
  nuevo_est: string;
  telegram_id: string | null;
};

export async function notificarProcurasTelegram(
  filas: ProcuraNotificacionRow[],
  motivo?: string | null,
): Promise<{ enviados: number; omitidos: number }> {
  let enviados = 0;
  let omitidos = 0;
  const motivoTxt = motivo?.trim() || '';

  for (const p of filas) {
    if (!p.telegram_id?.trim()) {
      omitidos += 1;
      continue;
    }
    let msg =
      `🔔 <b>Actualización de procura</b>\n\n` +
      `🎫 <b>Ticket:</b> ${escapeHtml(p.ticket)}\n` +
      `📦 <b>Material:</b> ${escapeHtml(p.material_txt)}\n` +
      `🔄 <b>Estado:</b> ${escapeHtml(etiquetaEstadoProcura(p.nuevo_est))}\n`;
    if (motivoTxt) {
      msg += `📝 <b>Nota:</b> ${escapeHtml(motivoTxt)}\n`;
    }
    try {
      await sendTelegramMessage(p.telegram_id, msg);
      enviados += 1;
    } catch (e) {
      console.warn('[notificarProcuraTelegram]', p.ticket, e);
      omitidos += 1;
    }
  }

  return { enviados, omitidos };
}
