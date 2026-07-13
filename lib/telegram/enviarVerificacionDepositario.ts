import { sendTelegramMessage } from '@/lib/telegram/botApi';
import { callbackDataVerificarFactura } from '@/lib/telegram/depositarioRecepcion';

/** Envía al depositario un mensaje con botón para iniciar conteo físico (migr. 209). */
export async function enviarVerificacionDepositarioTelegram(opts: {
  chatId: string | number;
  comprasFacturaId: string;
  numeroFactura?: string | null;
  proveedor?: string | null;
}): Promise<void> {
  const num = opts.numeroFactura?.trim() || 'S/N';
  const prov = opts.proveedor?.trim() || 'Proveedor';
  await sendTelegramMessage(
    opts.chatId,
    `📥 <b>Recepción física pendiente</b>\n\n` +
      `Factura <b>#${num}</b>\n` +
      `${prov}\n\n` +
      `Pulsa el botón para contar lo que ingresa al almacén (sin ver precios).`,
    {
      parse_mode: 'HTML',
      reply_markup: {
        inline_keyboard: [
          [
            {
              text: '📦 Verificar e ingresar',
              callback_data: callbackDataVerificarFactura(opts.comprasFacturaId),
            },
          ],
        ],
      },
    },
  );
}
