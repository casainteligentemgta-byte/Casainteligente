import type { SupabaseClient } from '@supabase/supabase-js';
import { sendTelegramMessage } from '@/lib/telegram/botApi';
import { setTelegramContexto } from '@/lib/telegram/estados';

/** URL base de la app (misma lógica que mediaHandlers). */
export function baseUrlAppTelegram(): string {
  return (
    process.env.NEXT_PUBLIC_BASE_URL ??
    process.env.NEXT_PUBLIC_APP_URL ??
    'https://casainteligente.company'
  )
    .trim()
    .replace(/\/$/, '');
}

/** Mensaje al activar modo recepción de facturas por Telegram (/facturas). */
export function mensajeModoFacturasActivado(): string {
  return (
    '✅ <b>Modo comprador — cargar facturas</b>\n\n' +
    'Envía una <b>foto</b> o <b>PDF</b> de la factura de compra.\n\n' +
    'El sistema la enviará a <b>Contabilidad</b> (Auditoría puede corregir en la app) ' +
    'y la <b>precargará</b> para que el depositario ingrese la mercancía con ' +
    '<code>/ingresofactura</code> cuando llegue al almacén.\n\n' +
    '<code>/cancelar</code> para salir de este modo.'
  );
}

/** Modo comprador: enviar foto/PDF de factura (OCR → Contabilidad). */
export async function iniciarModoCargaFacturasTelegram(
  supabase: SupabaseClient,
  chatId: string,
): Promise<void> {
  await sendTelegramMessage(chatId, mensajeModoFacturasActivado(), { parse_mode: 'HTML' });
  await setTelegramContexto(supabase, chatId, { contexto: 'factura' });
}
