import type { SupabaseClient } from '@supabase/supabase-js';
import {
  formatTotalExtracted,
  normalizarMonedaExtracted,
  type ExtractedCanalHeader,
} from '@/lib/contabilidad/extractedCanal';
import { answerCallbackQuery, sendTelegramMessage } from '@/lib/telegram/botApi';
import { getTelegramEstado, setTelegramContexto } from '@/lib/telegram/estados';
import { resumenFacturaCompradorHtml } from '@/lib/telegram/mensajesFactura';

const PREFIX = 'mf:';

export function esCallbackMonedaFactura(data: string): boolean {
  return data === `${PREFIX}ves` || data === `${PREFIX}usd`;
}

export async function enviarPickerMonedaFacturaTelegram(
  supabase: SupabaseClient,
  chatId: string,
  pendingId: string,
): Promise<void> {
  await setTelegramContexto(supabase, chatId, {
    contexto: 'factura',
    pending_factura_id: pendingId,
  });

  const { data: row } = await supabase
    .from('ci_facturas_canal_pendientes')
    .select('extracted')
    .eq('id', pendingId)
    .maybeSingle();
  const extracted = (row?.extracted ?? {}) as Record<string, unknown>;

  await sendTelegramMessage(
    chatId,
    `💱 <b>¿En qué moneda está esta factura?</b>\n\n` +
      resumenFacturaCompradorHtml(extracted, { sinMoneda: true }) +
      `\n\n<i>Total y precios unitarios están en la moneda que elija.</i>`,
    {
      parse_mode: 'HTML',
      reply_markup: {
        inline_keyboard: [
          [
            { text: 'Bolívares (Bs)', callback_data: `${PREFIX}ves` },
            { text: 'Dólares (USD)', callback_data: `${PREFIX}usd` },
          ],
        ],
      },
    },
  );
}

export async function manejarCallbackMonedaFacturaTelegram(
  supabase: SupabaseClient,
  params: { chatId: string; callbackId: string; data: string },
): Promise<boolean> {
  if (!esCallbackMonedaFactura(params.data)) return false;

  const moneda: ExtractedCanalHeader['moneda'] =
    params.data === `${PREFIX}usd` ? 'USD' : 'VES';

  const estado = await getTelegramEstado(supabase, params.chatId);
  const pendingId = estado.pending_factura_id;
  if (!pendingId) {
    await answerCallbackQuery(params.callbackId, 'Sin factura pendiente', true);
    return true;
  }

  const { data: row } = await supabase
    .from('ci_facturas_canal_pendientes')
    .select('extracted')
    .eq('id', pendingId)
    .maybeSingle();
  const prev = (row?.extracted ?? {}) as ExtractedCanalHeader;
  const nextExtracted: ExtractedCanalHeader = {
    ...prev,
    moneda: normalizarMonedaExtracted(moneda),
    comprador_confirmo_moneda: true,
  };

  const { error } = await supabase
    .from('ci_facturas_canal_pendientes')
    .update({
      extracted: nextExtracted,
      updated_at: new Date().toISOString(),
    })
    .eq('id', pendingId);

  if (error) {
    await answerCallbackQuery(params.callbackId, 'Error al guardar moneda', true);
    return true;
  }

  const label = simboloMoneda(moneda);
  await answerCallbackQuery(params.callbackId, `Moneda: ${label}`);

  await sendTelegramMessage(
    params.chatId,
    `✅ Moneda: <b>${label}</b>` +
      (nextExtracted.total_amount != null
        ? `\n💰 Total: ${formatTotalExtracted(nextExtracted)}`
        : ''),
    { parse_mode: 'HTML' },
  );

  const { enviarPickerCondicionPagoTelegram } = await import('@/lib/telegram/condicionPagoPicker');
  await enviarPickerCondicionPagoTelegram(supabase, params.chatId, pendingId);
  return true;
}

function simboloMoneda(moneda: ExtractedCanalHeader['moneda']): string {
  return normalizarMonedaExtracted(moneda) === 'USD' ? 'USD' : 'Bs';
}
