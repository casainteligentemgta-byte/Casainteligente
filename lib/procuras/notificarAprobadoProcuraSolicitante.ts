import { nombreMaterialProcuraVisible } from '@/lib/compras/procuraMaterialTexto';
import { sendTelegramMessage } from '@/lib/telegram/botApi';

function escHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

export type ProcuraAprobadaNotificacion = {
  ticket: string;
  material_txt: string;
  solicitante_telegram_chat_id?: number | string | null;
  solicitante_nombre?: string | null;
};

/** Mensaje breve al solicitante tras aprobación del PM. */
export async function notificarAprobadoProcuraSolicitante(
  procura: ProcuraAprobadaNotificacion,
): Promise<boolean> {
  const chatSol = procura.solicitante_telegram_chat_id;
  if (chatSol == null || String(chatSol).trim() === '') return false;

  const material = nombreMaterialProcuraVisible(procura.material_txt);

  try {
    await sendTelegramMessage(
      String(chatSol),
      `🎫 <b>Ticket:</b> ${escHtml(String(procura.ticket))}\n` +
        `📦 ${escHtml(material)}\n` +
        `<b>APROBADO</b>`,
      {
        parse_mode: 'HTML',
        rolDestinatario: 'Solicitante',
        nombreDestinatario: procura.solicitante_nombre,
        accionLogDestinatario: 'solo_notificacion',
        contextoLogEspejo: '[Procura · aprobada]',
      },
    );
    return true;
  } catch (e) {
    console.warn('[notificarAprobadoProcura]', procura.ticket, e);
    return false;
  }
}
