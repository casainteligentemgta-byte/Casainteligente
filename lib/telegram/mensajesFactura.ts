import type { SupabaseClient } from '@supabase/supabase-js';
import { formatTotalExtracted } from '@/lib/contabilidad/extractedCanal';
import { sendTelegramMessage } from '@/lib/telegram/botApi';
import { setTelegramContexto } from '@/lib/telegram/estados';

export type TipoImputacionFacturaComprador = 'obra' | 'entidad';

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

/** Mensaje al activar modo recepción de facturas por Telegram (/facturas → foto). */
export function mensajeModoFacturasActivado(opts?: { ticket?: string | null }): string {
  const ticket = opts?.ticket?.trim();
  const procuraHint = ticket ? `\n🎫 Procura vinculada: <b>${ticket}</b>\n` : '';
  return (
    '✅ <b>COMPRADOR: cargar factura.</b>\n' +
    procuraHint +
    '\nEnvía una <b>foto</b> de la factura de compra.\n' +
    'Tras leerla, indique si los montos están en <b>Bs</b> o <b>USD</b>, si es <b>contado</b> o <b>crédito</b>.\n\n' +
    'Luego elija destino:\n' +
    '• <b>Obra (AD)</b> → obra + almacén → Contabilidad y precarga para ingreso físico.\n' +
    '• <b>Gasto de entidad (OpEx)</b> → solo entidad y clasificación → Contabilidad (sin almacén).\n\n' +
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

export function mensajeCompradorFacturaConfirmadaHtml(
  tipo: TipoImputacionFacturaComprador,
  extracted: Record<string, unknown>,
): string {
  const resumen = resumenFacturaCompradorHtml(extracted);
  if (tipo === 'entidad') {
    return (
      '✅ <b>Gasto de entidad registrado en Contabilidad</b>\n' +
      '<i>Sin obra ni almacén — no aparece en /ingreso.</i>\n\n' +
      resumen
    );
  }
  return (
    '✅ <b>Compra registrada en Contabilidad</b>\n' +
    '<i>Precargada para ingreso físico con <code>/ingreso</code>.</i>\n\n' +
    resumen
  );
}

const FACTURA_OK_CALLBACK = 'fok:ack';

export function tecladoFacturaRegistradaOk(
  tipo: TipoImputacionFacturaComprador = 'obra',
): {
  inline_keyboard: Array<Array<{ text: string; callback_data: string }>>;
} {
  const textoObra =
    'OK — Registrada en Contabilidad (precargada para ingreso almacén)';
  const textoEntidad = 'OK — Gasto de entidad en Contabilidad (sin almacén)';
  return {
    inline_keyboard: [
      [
        {
          text: tipo === 'entidad' ? textoEntidad : textoObra,
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
  tipo?: TipoImputacionFacturaComprador;
}): Promise<boolean> {
  const { answerCallbackQuery } = await import('@/lib/telegram/botApi');
  const msg =
    params.tipo === 'entidad'
      ? 'Gasto de entidad registrado en Contabilidad'
      : 'Factura registrada en Contabilidad (precargada para ingreso)';
  await answerCallbackQuery(params.callbackId, msg);
  return true;
}

/** Modo comprador: enviar foto/PDF de factura (OCR → Contabilidad). */
export async function iniciarModoCargaFacturasTelegram(
  supabase: SupabaseClient,
  chatId: string,
  opts?: { procuraId?: string | null; ticket?: string | null },
): Promise<void> {
  await sendTelegramMessage(chatId, mensajeModoFacturasActivado({ ticket: opts?.ticket }), {
    parse_mode: 'HTML',
  });
  const meta: Record<string, unknown> = {};
  if (opts?.procuraId?.trim()) meta.procura_id = opts.procuraId.trim();
  if (opts?.ticket?.trim()) meta.procura_ticket = opts.ticket.trim();
  await setTelegramContexto(supabase, chatId, {
    contexto: 'factura',
    ...(Object.keys(meta).length ? { metadata: meta } : {}),
  });
}
