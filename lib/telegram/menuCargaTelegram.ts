import type { SupabaseClient } from '@supabase/supabase-js';
import { answerCallbackQuery, sendTelegramMessage } from '@/lib/telegram/botApi';
import { iniciarFacturaCompradorManualTelegram } from '@/lib/telegram/facturaCompradorManualTelegram';
import { manejarComandoIngresoFacturaTelegram } from '@/lib/telegram/ingresoFacturaTelegram';
import {
  manejarComandoIngresoFacturaManualTelegram,
  manejarComandoIngresoFacturaSinIaTelegram,
  manejarComandoNotaEntregaTelegram,
} from '@/lib/telegram/ingresoManualTelegram';
import { iniciarModoCargaFacturasTelegram } from '@/lib/telegram/mensajesFactura';
import { enviarPickerProyectosTelegram } from '@/lib/telegram/proyectoPicker';

/**
 * /factura: carga (precarga) de facturas y notas. Igual para todos los roles;
 * lo cargado queda pendiente de ingreso en el almacén de la obra.
 * /ingreso: lo que el depositario ingresa (pendientes) y el ingreso directo con factura.
 */
export const PREFIX_CARGA = 'cg:';

export async function enviarMenuCarga(_supabase: SupabaseClient, chatId: string): Promise<void> {
  await sendTelegramMessage(
    chatId,
    '🧾 <b>Cargar factura o nota</b>\n\n' +
      'Lo que cargue queda <b>precargado</b>, pendiente de ingreso en el almacén de la obra.\n' +
      '• <b>Con foto (IA):</b> la IA lee la factura y solo se piden los datos que falten.\n' +
      '• <b>Manual:</b> se escriben todos los datos.',
    {
      parse_mode: 'HTML',
      reply_markup: {
        inline_keyboard: [
          [{ text: '📷 Factura con foto (IA)', callback_data: `${PREFIX_CARGA}factura_ia` }],
          [{ text: '✍️ Factura manual', callback_data: `${PREFIX_CARGA}factura_manual` }],
          [{ text: '📄 Nota de entrega (foto)', callback_data: `${PREFIX_CARGA}nota` }],
        ],
      },
    },
  );
}

export async function enviarMenuIngreso(_supabase: SupabaseClient, chatId: string): Promise<void> {
  await sendTelegramMessage(
    chatId,
    '📥 <b>Ingreso a almacén</b>\n\nElija:',
    {
      parse_mode: 'HTML',
      reply_markup: {
        inline_keyboard: [
          [{ text: '📥 Facturas precargadas (pendientes de ingreso)', callback_data: `${PREFIX_CARGA}pendientes` }],
          [{ text: '📄 Notas precargadas (pendientes de ingreso)', callback_data: `${PREFIX_CARGA}notas_pendientes` }],
          [{ text: '🧾 Ingreso con factura · con foto (IA)', callback_data: `${PREFIX_CARGA}ingreso_ia` }],
          [{ text: '🧾 Ingreso con factura · manual', callback_data: `${PREFIX_CARGA}ingreso_manual` }],
        ],
      },
    },
  );
}

export function esCallbackCarga(data: string): boolean {
  return data.startsWith(PREFIX_CARGA);
}

export async function manejarCallbackCarga(
  supabase: SupabaseClient,
  params: { chatId: string; callbackId: string; data: string },
): Promise<boolean> {
  if (!esCallbackCarga(params.data)) return false;
  const accion = params.data.slice(PREFIX_CARGA.length);
  await answerCallbackQuery(params.callbackId);

  switch (accion) {
    case 'factura_ia':
      await iniciarModoCargaFacturasTelegram(supabase, params.chatId);
      return true;
    case 'factura_manual':
      await iniciarFacturaCompradorManualTelegram(supabase, params.chatId);
      return true;
    case 'nota':
      await sendTelegramMessage(
        params.chatId,
        '📄 <b>Nota de entrega</b>\n\nElija la obra. Luego envíe la foto de la nota.',
        { parse_mode: 'HTML' },
      );
      await enviarPickerProyectosTelegram(supabase, params.chatId, 'nota_entrega');
      return true;
    case 'pendientes':
      await manejarComandoIngresoFacturaTelegram(supabase, params.chatId);
      return true;
    case 'notas_pendientes':
      await manejarComandoNotaEntregaTelegram(supabase, params.chatId);
      return true;
    case 'ingreso_ia':
      await manejarComandoIngresoFacturaManualTelegram(supabase, params.chatId);
      return true;
    case 'ingreso_manual':
      await manejarComandoIngresoFacturaSinIaTelegram(supabase, params.chatId);
      return true;
    default:
      return false;
  }
}
