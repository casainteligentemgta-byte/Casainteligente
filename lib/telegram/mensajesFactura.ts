import type { SupabaseClient } from '@supabase/supabase-js';
import { formatTotalExtracted } from '@/lib/contabilidad/extractedCanal';
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
    '✅ <b>COMPRADOR: cargar factura.</b>\n\n' +
    'Envía una <b>foto</b> de la factura de compra.\n' +
    'Tras leerla, indique si los montos están en <b>Bs</b> o <b>USD</b>, si es <b>contado</b> o <b>crédito</b>, elija obra y almacén de despacho.\n' +
    'El sistema la enviará a <b>Contabilidad</b> y la <b>precargará en Almacén</b>.\n\n' +
    '<code>/cancelar</code> para salir de este modo.'
  );
}

/** Resumen mínimo post-registro (nº, proveedor, RIF, total, líneas). */
export function resumenFacturaCompradorHtml(
  extracted: Record<string, unknown>,
  opts?: { sinMoneda?: boolean },
): string {
  const nItems = Array.isArray(extracted.items) ? extracted.items.length : 0;
  const total = formatTotalExtracted(
    {
      total_amount:
        extracted.total_amount != null ? Number(extracted.total_amount) : null,
      moneda: extracted.moneda as string | null | undefined,
    },
    { sinMoneda: opts?.sinMoneda },
  );
  return (
    `📄 Nº: <code>${extracted.invoice_number ?? '—'}</code>\n` +
    `🏢 ${extracted.supplier_name ?? 'Proveedor'}\n` +
    `🆔 RIF: ${extracted.supplier_rif ?? '—'}\n` +
    `💰 Total: ${total}\n` +
    `📦 Líneas: ${nItems}`
  );
}

const FACTURA_OK_CALLBACK = 'fok:ack';

export function tecladoFacturaRegistradaOk(): {
  inline_keyboard: Array<Array<{ text: string; callback_data: string }>>;
} {
  return {
    inline_keyboard: [
      [
        {
          text: 'OK — Factura registrada en Contabilidad (precargada en almacén)',
          callback_data: FACTURA_OK_CALLBACK,
        },
      ],
    ],
  };
}

export function esCallbackFacturaOk(data: string): boolean {
  return data === FACTURA_OK_CALLBACK;
}

export async function manejarCallbackFacturaOkTelegram(params: {
  callbackId: string;
}): Promise<boolean> {
  const { answerCallbackQuery } = await import('@/lib/telegram/botApi');
  await answerCallbackQuery(
    params.callbackId,
    'Factura registrada en Contabilidad (precargada en almacén)',
  );
  return true;
}

/** Modo comprador: enviar foto/PDF de factura (OCR → Contabilidad). */
export async function iniciarModoCargaFacturasTelegram(
  supabase: SupabaseClient,
  chatId: string,
): Promise<void> {
  await sendTelegramMessage(chatId, mensajeModoFacturasActivado(), { parse_mode: 'HTML' });
  await setTelegramContexto(supabase, chatId, { contexto: 'factura' });
}
