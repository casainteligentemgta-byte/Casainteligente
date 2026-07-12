import { sendTelegramMessage } from '@/lib/telegram/botApi';
import { nombreMaterialProcuraVisible } from '@/lib/compras/procuraMaterialTexto';

function escHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

export type ProcuraRechazoNotificacion = {
  ticket: string;
  material_txt: string;
  solicitante_telegram_chat_id?: number | string | null;
};

/** Avisa al solicitante tras rechazo del PM. */
export async function notificarRechazoProcuraSolicitante(
  procura: ProcuraRechazoNotificacion,
  motivo: string,
  _aprobadorNombre?: string | null,
): Promise<boolean> {
  const chatSol = procura.solicitante_telegram_chat_id;
  if (chatSol == null || String(chatSol).trim() === '') return false;

  const motivoTxt = motivo.trim();
  if (!motivoTxt) return false;

  const material = nombreMaterialProcuraVisible(procura.material_txt);

  try {
    await sendTelegramMessage(
      String(chatSol),
      `🎫 <b>Ticket:</b> ${escHtml(String(procura.ticket))}\n` +
        `📦 ${escHtml(material)}\n` +
        `<b>NO APROBADO:</b> ${escHtml(motivoTxt)}`,
      { parse_mode: 'HTML', rolDestinatario: 'Solicitante' },
    );
    return true;
  } catch (e) {
    console.warn('[notificarRechazoProcura]', procura.ticket, e);
    return false;
  }
}
