import type { SupabaseClient } from '@supabase/supabase-js';
import { answerCallbackQuery, sendTelegramMessage } from '@/lib/telegram/botApi';
import { iniciarModoCargaFacturasTelegram } from '@/lib/telegram/mensajesFactura';
import { iniciarFacturaCompradorManualTelegram } from '@/lib/telegram/facturaCompradorManualTelegram';

const PREFIX = 'fc:m:';

export type OpcionMenuFacturasComprador = 'foto' | 'manual';

export function callbackMenuFacturasComprador(opcion: OpcionMenuFacturasComprador): string {
  return `${PREFIX}${opcion}`;
}

export function esCallbackMenuFacturasComprador(data: string): boolean {
  return data.startsWith(PREFIX);
}

export function parseCallbackMenuFacturasComprador(
  data: string,
): OpcionMenuFacturasComprador | null {
  if (data === `${PREFIX}foto`) return 'foto';
  if (data === `${PREFIX}manual`) return 'manual';
  return null;
}

export function mensajeMenuFacturasComprador(): string {
  return (
    '🧾 <b>Registrar factura de compra</b> (<code>/facturas</code>)\n\n' +
    'Elige cómo cargar la factura:\n\n' +
    '• <b>Foto/PDF</b> — lectura automática (OCR) y registro en Contabilidad.\n' +
    '• <b>Manual</b> — proveedor, número, materiales y montos (como ingreso manual del depositario, sin stock).\n\n' +
    'Tras registrar queda <b>precargada</b> para ingreso físico con <code>/ingreso</code>.\n\n' +
    '<code>/cancelar</code> para salir.'
  );
}

export function tecladoMenuFacturasComprador(): {
  inline_keyboard: Array<Array<{ text: string; callback_data: string }>>;
} {
  return {
    inline_keyboard: [
      [{ text: '📷 Foto o PDF de factura', callback_data: callbackMenuFacturasComprador('foto') }],
      [{ text: '🧾 Carga manual', callback_data: callbackMenuFacturasComprador('manual') }],
    ],
  };
}

export async function enviarMenuFacturasCompradorTelegram(
  supabase: SupabaseClient,
  chatId: string,
): Promise<void> {
  await sendTelegramMessage(chatId, mensajeMenuFacturasComprador(), {
    parse_mode: 'HTML',
    reply_markup: tecladoMenuFacturasComprador(),
  });
}

export async function manejarCallbackMenuFacturasCompradorTelegram(
  supabase: SupabaseClient,
  params: { chatId: string; callbackId: string; data: string },
): Promise<boolean> {
  const opcion = parseCallbackMenuFacturasComprador(params.data);
  if (!opcion) return false;

  await answerCallbackQuery(params.callbackId, opcion === 'foto' ? 'Modo foto' : 'Carga manual');

  if (opcion === 'foto') {
    await iniciarModoCargaFacturasTelegram(supabase, params.chatId);
  } else {
    await iniciarFacturaCompradorManualTelegram(supabase, params.chatId);
  }
  return true;
}
