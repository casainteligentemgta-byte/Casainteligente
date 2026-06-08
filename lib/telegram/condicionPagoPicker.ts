import type { SupabaseClient } from '@supabase/supabase-js';
import {
  etiquetaCondicionPagoExtracted,
  parseCondicionPagoExtracted,
  parseDiasCreditoExtracted,
  type ExtractedCanalHeader,
} from '@/lib/contabilidad/extractedCanal';
import { answerCallbackQuery, sendTelegramMessage } from '@/lib/telegram/botApi';
import type { TelegramEstado } from '@/lib/telegram/estados';
import { getTelegramEstado, setTelegramContexto } from '@/lib/telegram/estados';
import { resumenFacturaCompradorHtml } from '@/lib/telegram/mensajesFactura';

const PREFIX = 'cp:';
const PREFIX_DIAS = 'dc:';

const DIAS_RAPIDOS = [15, 30, 60, 90] as const;

export function esCallbackCondicionPagoFactura(data: string): boolean {
  return data === `${PREFIX}contado` || data === `${PREFIX}credito`;
}

export function esCallbackDiasCreditoFactura(data: string): boolean {
  if (!data.startsWith(PREFIX_DIAS)) return false;
  return parseDiasCreditoExtracted(data.slice(PREFIX_DIAS.length)) != null;
}

export function esperandoDiasCreditoFactura(estado: TelegramEstado): boolean {
  return (
    estado.contexto === 'factura' &&
    Boolean(estado.pending_factura_id) &&
    String(estado.metadata?.paso ?? '') === 'dias_credito'
  );
}

export async function enviarPickerCondicionPagoTelegram(
  supabase: SupabaseClient,
  chatId: string,
  pendingId: string,
): Promise<void> {
  await setTelegramContexto(supabase, chatId, {
    contexto: 'factura',
    pending_factura_id: pendingId,
    metadata: {},
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

async function enviarPreguntaDiasCreditoTelegram(
  supabase: SupabaseClient,
  chatId: string,
  pendingId: string,
): Promise<void> {
  await setTelegramContexto(supabase, chatId, {
    contexto: 'factura',
    pending_factura_id: pendingId,
    metadata: { paso: 'dias_credito', flujo: 'factura_compra' },
  });

  await sendTelegramMessage(
    chatId,
    `📅 <b>¿Cuántos días de crédito?</b>\n\n` +
      `Elija un plazo o escriba un número entero (ej. <code>45</code>).`,
    {
      parse_mode: 'HTML',
      reply_markup: {
        inline_keyboard: [
          DIAS_RAPIDOS.map((d) => ({
            text: `${d} días`,
            callback_data: `${PREFIX_DIAS}${d}`,
          })),
        ],
      },
    },
  );
}

async function continuarTrasFormaPagoTelegram(
  supabase: SupabaseClient,
  chatId: string,
): Promise<void> {
  await setTelegramContexto(supabase, chatId, {
    contexto: 'factura',
    metadata: {},
  });
  const { enviarPickerProyectosTelegram } = await import('@/lib/telegram/proyectoPicker');
  await enviarPickerProyectosTelegram(supabase, chatId, 'factura_compra');
}

async function guardarDiasCreditoYContinuar(
  supabase: SupabaseClient,
  chatId: string,
  pendingId: string,
  dias: number,
): Promise<string | null> {
  const parsed = parseDiasCreditoExtracted(dias);
  if (parsed == null) {
    return 'Indique un número entero de días mayor a cero (ej. 30).';
  }

  const { data: row } = await supabase
    .from('ci_facturas_canal_pendientes')
    .select('extracted')
    .eq('id', pendingId)
    .maybeSingle();
  const prev = (row?.extracted ?? {}) as ExtractedCanalHeader;
  if (parseCondicionPagoExtracted(prev.condicion_pago) !== 'credito') {
    return 'La factura ya no está en modo crédito. Pulse /facturas de nuevo si hace falta.';
  }

  const nextExtracted: ExtractedCanalHeader = {
    ...prev,
    condicion_pago: 'credito',
    dias_credito: parsed,
  };

  const { error } = await supabase
    .from('ci_facturas_canal_pendientes')
    .update({
      extracted: nextExtracted,
      updated_at: new Date().toISOString(),
    })
    .eq('id', pendingId);

  if (error) return 'Error al guardar los días de crédito.';

  await sendTelegramMessage(
    chatId,
    `✅ Crédito: <b>${parsed} días</b>`,
    { parse_mode: 'HTML' },
  );
  await continuarTrasFormaPagoTelegram(supabase, chatId);
  return null;
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
    dias_credito: condicion === 'credito' ? null : null,
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

  if (condicion === 'credito') {
    await enviarPreguntaDiasCreditoTelegram(supabase, params.chatId, pendingId);
  } else {
    await continuarTrasFormaPagoTelegram(supabase, params.chatId);
  }
  return true;
}

export async function manejarCallbackDiasCreditoFacturaTelegram(
  supabase: SupabaseClient,
  params: { chatId: string; callbackId: string; data: string },
): Promise<boolean> {
  if (!esCallbackDiasCreditoFactura(params.data)) return false;

  const dias = parseDiasCreditoExtracted(params.data.slice(PREFIX_DIAS.length));
  if (dias == null) return false;

  const estado = await getTelegramEstado(supabase, params.chatId);
  const pendingId = estado.pending_factura_id;
  if (!pendingId || !esperandoDiasCreditoFactura(estado)) {
    await answerCallbackQuery(params.callbackId, 'Sin factura pendiente', true);
    return true;
  }

  const err = await guardarDiasCreditoYContinuar(supabase, params.chatId, pendingId, dias);
  if (err) {
    await answerCallbackQuery(params.callbackId, err, true);
    return true;
  }

  await answerCallbackQuery(params.callbackId, `${dias} días`);
  return true;
}

export async function manejarTextoDiasCreditoFacturaTelegram(
  supabase: SupabaseClient,
  chatId: string,
  texto: string,
): Promise<boolean> {
  const estado = await getTelegramEstado(supabase, chatId);
  if (!esperandoDiasCreditoFactura(estado)) return false;

  const pendingId = estado.pending_factura_id;
  if (!pendingId) return false;

  const limpio = texto.trim().replace(/\s*d[ií]as?\s*$/i, '').trim();
  const err = await guardarDiasCreditoYContinuar(supabase, chatId, pendingId, Number(limpio));
  if (err) {
    await sendTelegramMessage(chatId, `⚠️ ${err}`, { parse_mode: 'HTML' });
    return true;
  }
  return true;
}
