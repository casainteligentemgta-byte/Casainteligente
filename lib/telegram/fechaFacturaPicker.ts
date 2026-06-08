import type { SupabaseClient } from '@supabase/supabase-js';
import {
  auditoriaFechaCompra,
  exigeConfirmacionFechaAnomala,
} from '@/lib/contabilidad/auditoriaFechaCompra';
import type { ExtractedCanalHeader } from '@/lib/contabilidad/extractedCanal';
import { answerCallbackQuery, sendTelegramMessage } from '@/lib/telegram/botApi';
import { getTelegramEstado, setTelegramContexto } from '@/lib/telegram/estados';
import { resumenFacturaCompradorHtml } from '@/lib/telegram/mensajesFactura';

const PREFIX = 'ff:';

export function esCallbackFechaFactura(data: string): boolean {
  return (
    data === `${PREFIX}ok` ||
    data === `${PREFIX}hoy` ||
    data.startsWith(`${PREFIX}set:`)
  );
}

export function fechaFacturaRequiereConfirmacion(fechaIso: string): boolean {
  const audit = auditoriaFechaCompra(fechaIso);
  return audit.nivel !== 'ok';
}

export async function enviarConfirmacionFechaFacturaTelegram(
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
  const extracted = (row?.extracted ?? {}) as ExtractedCanalHeader;
  const fecha = String(extracted.date ?? '').slice(0, 10) || '—';
  const audit = auditoriaFechaCompra(fecha);
  const hoy = new Date().toISOString().slice(0, 10);

  await sendTelegramMessage(
    chatId,
    `📅 <b>Revise la fecha de la factura</b>\n\n` +
      resumenFacturaCompradorHtml(extracted, { sinMoneda: true }) +
      `\n\n⚠️ ${audit.mensaje}\n\n` +
      `<i>Confirme la fecha detectada o use la de hoy antes de continuar.</i>`,
    {
      parse_mode: 'HTML',
      reply_markup: {
        inline_keyboard: [
          [{ text: `✅ Fecha ${fecha} es correcta`, callback_data: `${PREFIX}ok` }],
          [{ text: `📆 Usar hoy (${hoy})`, callback_data: `${PREFIX}hoy` }],
        ],
      },
    },
  );
}

async function continuarAMoneda(
  supabase: SupabaseClient,
  chatId: string,
  pendingId: string,
): Promise<void> {
  const { enviarPickerMonedaFacturaTelegram } = await import('@/lib/telegram/monedaFacturaPicker');
  await enviarPickerMonedaFacturaTelegram(supabase, chatId, pendingId);
}

export async function manejarCallbackFechaFacturaTelegram(
  supabase: SupabaseClient,
  params: { chatId: string; callbackId: string; data: string },
): Promise<boolean> {
  if (!esCallbackFechaFactura(params.data)) return false;

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

  let nuevaFecha = String(prev.date ?? '').slice(0, 10);
  if (params.data === `${PREFIX}hoy`) {
    nuevaFecha = new Date().toISOString().slice(0, 10);
  } else if (params.data.startsWith(`${PREFIX}set:`)) {
    nuevaFecha = params.data.slice(`${PREFIX}set:`.length).slice(0, 10);
  }

  const audit = auditoriaFechaCompra(nuevaFecha);
  if (exigeConfirmacionFechaAnomala(audit) && params.data !== `${PREFIX}ok`) {
    await answerCallbackQuery(
      params.callbackId,
      'Use «Fecha correcta» o cambie a la de hoy',
      true,
    );
    return true;
  }

  const nextExtracted: ExtractedCanalHeader = {
    ...prev,
    date: nuevaFecha,
    fecha_auditoria_confirmada: fechaFacturaRequiereConfirmacion(
      String(prev.date ?? '').slice(0, 10),
    )
      ? true
      : prev.fecha_auditoria_confirmada,
  };
  const { error } = await supabase
    .from('ci_facturas_canal_pendientes')
    .update({
      extracted: nextExtracted,
      updated_at: new Date().toISOString(),
    } as never)
    .eq('id', pendingId);

  if (error) {
    await answerCallbackQuery(params.callbackId, 'No se pudo guardar la fecha', true);
    return true;
  }

  await answerCallbackQuery(params.callbackId, 'Fecha registrada');
  await continuarAMoneda(supabase, params.chatId, pendingId);
  return true;
}

/** Tras OCR: confirma fecha si es sospechosa; si no, pasa directo a moneda. */
export async function continuarPostOcrFacturaTelegram(
  supabase: SupabaseClient,
  chatId: string,
  pendingId: string,
  extracted: ExtractedCanalHeader,
): Promise<void> {
  const fecha = String(extracted.date ?? '').slice(0, 10);
  if (fechaFacturaRequiereConfirmacion(fecha)) {
    await enviarConfirmacionFechaFacturaTelegram(supabase, chatId, pendingId);
    return;
  }
  const { enviarPickerMonedaFacturaTelegram } = await import('@/lib/telegram/monedaFacturaPicker');
  await enviarPickerMonedaFacturaTelegram(supabase, chatId, pendingId);
}
