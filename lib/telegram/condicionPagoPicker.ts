import type { SupabaseClient } from '@supabase/supabase-js';
import {
  etiquetaCondicionPagoExtracted,
  parseCondicionPagoExtracted,
  type ExtractedCanalHeader,
} from '@/lib/contabilidad/extractedCanal';
import { answerCallbackQuery, sendTelegramMessage } from '@/lib/telegram/botApi';
import { getTelegramEstado, setTelegramContexto } from '@/lib/telegram/estados';
import { resumenFacturaCompradorHtml } from '@/lib/telegram/mensajesFactura';

const PREFIX = 'cp:';

export function esCallbackCondicionPagoFactura(data: string): boolean {
  return data === `${PREFIX}contado` || data === `${PREFIX}credito`;
}

export async function enviarPickerCondicionPagoTelegram(
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
    `💳 <b>¿La compra es a contado o a crédito?</b>\n\n` + resumenFacturaCompradorHtml(extracted),
    {
      parse_mode: 'HTML',
      reply_markup: {
        inline_keyboard: [
          [
            { text: 'Contado', callback_data: `${PREFIX}contado` },
            { text: 'Crédito', callback_data: `${PREFIX}credito` },
          ],
        ],
      },
    },
  );
}

export async function manejarCallbackCondicionPagoFacturaTelegram(
  supabase: SupabaseClient,
  params: { chatId: string; callbackId: string; data: string },
): Promise<boolean> {
  if (!esCallbackCondicionPagoFactura(params.data)) return false;

  const condicion = parseCondicionPagoExtracted(
    params.data === `${PREFIX}credito` ? 'credito' : 'contado',
  );

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
    condicion_pago: condicion,
    dias_credito: condicion === 'credito' ? prev.dias_credito ?? null : null,
  };

  const { error } = await supabase
    .from('ci_facturas_canal_pendientes')
    .update({
      extracted: nextExtracted,
      updated_at: new Date().toISOString(),
    })
    .eq('id', pendingId);

  if (error) {
    await answerCallbackQuery(params.callbackId, 'Error al guardar forma de pago', true);
    return true;
  }

  const label = etiquetaCondicionPagoExtracted(condicion);
  await answerCallbackQuery(params.callbackId, label);

  await sendTelegramMessage(
    params.chatId,
    `✅ Forma de pago: <b>${label}</b>`,
    { parse_mode: 'HTML' },
  );

  const { enviarPickerProyectosTelegram } = await import('@/lib/telegram/proyectoPicker');
  await enviarPickerProyectosTelegram(supabase, params.chatId, 'factura_compra');
  return true;
}
