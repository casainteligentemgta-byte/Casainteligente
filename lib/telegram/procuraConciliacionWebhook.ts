import type { SupabaseClient } from '@supabase/supabase-js';
import {
  answerCallbackQuery,
  editTelegramMessage,
  sendTelegramMessage,
} from '@/lib/telegram/botApi';
import type { TelegramUpdate } from '@/lib/telegram/webhook';

const PR_TICKET_RE = /(PR-\d{4,6})/i;
const CB_PREFIX = 'pr_conc:';

export function textoTieneTicketProcura(text: string): RegExpMatchArray | null {
  return text.match(PR_TICKET_RE);
}

type ProcuraConciliacionRow = {
  id: string;
  ticket: string;
  estado: string;
  material_txt: string;
  cantidad: number;
  unidad: string;
  monto_estimado_usd: number | null;
};

export async function manejarMensajeTicketProcura(
  supabase: SupabaseClient,
  chatId: string,
  text: string,
): Promise<boolean> {
  const match = textoTieneTicketProcura(text);
  if (!match) return false;

  const ticket = match[1].toUpperCase();
  const { data, error } = await supabase
    .from('ci_procuras')
    .select('id,ticket,estado,material_txt,cantidad,unidad,monto_estimado_usd')
    .eq('ticket', ticket)
    .maybeSingle();

  if (error || !data) {
    await sendTelegramMessage(
      chatId,
      `❌ No encontré la procura <b>${ticket}</b>. Verifique el código PR-XXXX.`,
      { parse_mode: 'HTML' },
    );
    return true;
  }

  const p = data as ProcuraConciliacionRow;
  const monto =
    p.monto_estimado_usd != null
      ? `\n💵 Monto est.: <b>$${Number(p.monto_estimado_usd).toFixed(2)}</b>`
      : '';

  await sendTelegramMessage(
    chatId,
    `📋 <b>Procura ${p.ticket}</b>\n` +
      `Material: ${p.material_txt}\n` +
      `Cantidad: <b>${p.cantidad} ${p.unidad}</b>\n` +
      `Estado: <i>${p.estado}</i>${monto}\n\n` +
      `¿Confirmar conciliación de compra?`,
    {
      parse_mode: 'HTML',
      reply_markup: {
        inline_keyboard: [
          [
            { text: '✅ Sí, confirmar', callback_data: `${CB_PREFIX}SI:${p.id}` },
            { text: '❌ No', callback_data: `${CB_PREFIX}NO:${p.id}` },
          ],
        ],
      },
    },
  );
  return true;
}

export async function manejarCallbackConciliacionProcura(
  supabase: SupabaseClient,
  update: TelegramUpdate,
): Promise<boolean> {
  const cb = update.callback_query;
  if (!cb?.data?.startsWith(CB_PREFIX)) return false;

  const chatId = String(cb.message?.chat?.id ?? cb.from.id);
  const data = cb.data.slice(CB_PREFIX.length);
  const [accion, procuraId] = data.split(':');
  const callbackId = cb.id;

  if (!procuraId) {
    await answerCallbackQuery(callbackId, 'Datos inválidos');
    return true;
  }

  if (accion === 'NO') {
    await answerCallbackQuery(callbackId, 'Cancelado');
    if (cb.message?.message_id) {
      await editTelegramMessage(chatId, cb.message.message_id, 'Conciliación cancelada.', {
        reply_markup: { inline_keyboard: [] },
      });
    }
    await sendTelegramMessage(chatId, 'Conciliación cancelada.');
    return true;
  }

  if (accion !== 'SI') {
    await answerCallbackQuery(callbackId, 'Acción desconocida');
    return true;
  }

  const { data: procura, error: errProcura } = await supabase
    .from('ci_procuras')
    .select('id,ticket,material_txt,cantidad,unidad,monto_estimado_usd')
    .eq('id', procuraId)
    .maybeSingle();

  if (errProcura || !procura) {
    await answerCallbackQuery(callbackId, 'Procura no encontrada');
    return true;
  }

  const items = [
    {
      material_txt: procura.material_txt,
      cantidad: procura.cantidad,
      unidad: procura.unidad,
    },
  ];

  const { error: rpcErr } = await supabase.rpc('ci_procesar_conciliacion_compra', {
    p_procura_id: procuraId,
    p_monto_usd: procura.monto_estimado_usd,
    p_items: items,
  });

  if (rpcErr) {
    await answerCallbackQuery(callbackId, 'Error al procesar');
    await sendTelegramMessage(
      chatId,
      `⚠️ No se pudo conciliar <b>${procura.ticket}</b>: ${rpcErr.message}`,
      { parse_mode: 'HTML' },
    );
    return true;
  }

  await answerCallbackQuery(callbackId, 'Conciliación registrada');
  if (cb.message?.message_id) {
    await editTelegramMessage(
      chatId,
      cb.message.message_id,
      `✅ Conciliación aplicada a <b>${procura.ticket}</b>.`,
      { parse_mode: 'HTML', reply_markup: { inline_keyboard: [] } },
    );
  }

  await sendTelegramMessage(
    chatId,
    `✅ Procura <b>${procura.ticket}</b> conciliada correctamente.`,
    { parse_mode: 'HTML' },
  );
  return true;
}
