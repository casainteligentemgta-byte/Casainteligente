import { sendTelegramMessage } from '@/lib/telegram/botApi';

function escHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

export type ProcuraRechazoNotificacion = {
  ticket: string;
  material_txt: string;
  cantidad: number;
  unidad: string;
  solicitante_telegram_chat_id?: number | string | null;
};

/** Avisa al solicitante (Telegram) con el motivo del rechazo del PM. */
export async function notificarRechazoProcuraSolicitante(
  procura: ProcuraRechazoNotificacion,
  motivo: string,
  aprobadorNombre?: string | null,
): Promise<boolean> {
  const chatSol = procura.solicitante_telegram_chat_id;
  if (chatSol == null || String(chatSol).trim() === '') return false;

  const motivoTxt = motivo.trim();
  if (!motivoTxt) return false;

  const cantidadTxt = `${Number(procura.cantidad).toLocaleString('es-VE')} ${procura.unidad}`;
  const quien = aprobadorNombre?.trim()
    ? `\n👤 <b>Revisó:</b> ${escHtml(aprobadorNombre.trim())}`
    : '';

  try {
    await sendTelegramMessage(
      String(chatSol),
      `❌ Tu solicitud de procura para <b>${escHtml(String(procura.material_txt))}</b> ` +
        `(<b>${escHtml(cantidadTxt)}</b>) ha sido <b>RECHAZADA</b>.\n\n` +
        `🎫 ${escHtml(String(procura.ticket))}${quien}\n\n` +
        `💬 <b>Motivo:</b> ${escHtml(motivoTxt)}`,
      { parse_mode: 'HTML', rolDestinatario: 'Solicitante' },
    );
    return true;
  } catch (e) {
    console.warn('[notificarRechazoProcura]', procura.ticket, e);
    return false;
  }
}
