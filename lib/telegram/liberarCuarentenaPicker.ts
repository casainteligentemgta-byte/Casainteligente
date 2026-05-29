import type { SupabaseClient } from '@supabase/supabase-js';
import {
  approveQualityInspection,
  formatApproveError,
} from '@/lib/almacen/approveQualityInspection';
import {
  etiquetaInspeccionCuarentena,
  listarInspeccionesCuarentenaPendientes,
} from '@/lib/almacen/listarInspeccionesCuarentena';
import { answerCallbackQuery, sendTelegramMessage } from '@/lib/telegram/botApi';

const PREFIX_PAGE = 'lc:';
const PREFIX_APROBAR = 'la:';
const PREFIX_RECHAZAR = 'lr:';
const PAGE_SIZE = 6;

function truncar(s: string, max = 52): string {
  const t = s.trim();
  return t.length <= max ? t : `${t.slice(0, max - 1)}…`;
}

export function esCallbackLiberarCuarentena(data: string): boolean {
  return (
    data.startsWith(PREFIX_PAGE) ||
    data.startsWith(PREFIX_APROBAR) ||
    data.startsWith(PREFIX_RECHAZAR)
  );
}

function callbackPage(page: number): string {
  return `${PREFIX_PAGE}${page}`;
}

function callbackAprobar(id: string): string {
  return `${PREFIX_APROBAR}${id}`;
}

function callbackRechazar(id: string): string {
  return `${PREFIX_RECHAZAR}${id}`;
}

function buildKeyboard(
  rows: Awaited<ReturnType<typeof listarInspeccionesCuarentenaPendientes>>,
  page: number,
) {
  const totalPages = Math.max(1, Math.ceil(rows.length / PAGE_SIZE));
  const safePage = Math.min(Math.max(0, page), totalPages - 1);
  const slice = rows.slice(safePage * PAGE_SIZE, safePage * PAGE_SIZE + PAGE_SIZE);

  const buttons: Array<Array<{ text: string; callback_data: string }>> = slice.map((insp) => {
    const label = truncar(`✅ ${etiquetaInspeccionCuarentena(insp)}`);
    return [
      { text: label, callback_data: callbackAprobar(insp.id) },
      { text: '❌', callback_data: callbackRechazar(insp.id) },
    ];
  });

  if (totalPages > 1) {
    const nav: Array<{ text: string; callback_data: string }> = [];
    if (safePage > 0) nav.push({ text: '◀', callback_data: callbackPage(safePage - 1) });
    nav.push({ text: `${safePage + 1}/${totalPages}`, callback_data: callbackPage(safePage) });
    if (safePage < totalPages - 1) nav.push({ text: '▶', callback_data: callbackPage(safePage + 1) });
    buttons.push(nav);
  }

  return { inline_keyboard: buttons };
}

export async function manejarComandoLiberarCuarentenaTelegram(
  supabase: SupabaseClient,
  chatId: string,
  page = 0,
): Promise<void> {
  const inspecciones = await listarInspeccionesCuarentenaPendientes(supabase);
  if (!inspecciones.length) {
    await sendTelegramMessage(
      chatId,
      '✅ No hay material pendiente en cuarentena.',
      { parse_mode: 'HTML' },
    );
    return;
  }

  await sendTelegramMessage(
    chatId,
    '📦 <b>Liberar material de cuarentena</b>\n' +
      `<i>${inspecciones.length} ítem(s) pendiente(s). Toca ✅ para sumar stock al almacén asignado.</i>`,
    { parse_mode: 'HTML', reply_markup: buildKeyboard(inspecciones, page) },
  );
}

export async function manejarCallbackLiberarCuarentenaTelegram(
  supabase: SupabaseClient,
  params: { chatId: string; callbackId: string; data: string },
): Promise<boolean> {
  if (params.data.startsWith(PREFIX_PAGE)) {
    const page = Number(params.data.slice(PREFIX_PAGE.length));
    if (!Number.isFinite(page) || page < 0) return false;
    await answerCallbackQuery(params.callbackId);
    await manejarComandoLiberarCuarentenaTelegram(supabase, params.chatId, Math.floor(page));
    return true;
  }

  if (params.data.startsWith(PREFIX_APROBAR)) {
    const inspectionId = params.data.slice(PREFIX_APROBAR.length).trim();
    if (!inspectionId) return false;

    const { data: insp } = await supabase
      .from('quality_inspections')
      .select('id, status, line_description, quantity')
      .eq('id', inspectionId)
      .maybeSingle();

    if (!insp || insp.status !== 'PENDIENTE') {
      await answerCallbackQuery(params.callbackId, 'Ya procesado o no encontrado', true);
      return true;
    }

    try {
      await approveQualityInspection(supabase, inspectionId, null);
      await answerCallbackQuery(params.callbackId, 'Liberado ✓');
      const desc = String(insp.line_description ?? 'Material').trim();
      await sendTelegramMessage(
        params.chatId,
        `✅ <b>Material liberado</b>\n${desc} · ${Number(insp.quantity) || 0} uds\n` +
          '<i>Stock disponible en el almacén de la factura (mov. 101).</i>',
        { parse_mode: 'HTML' },
      );
      await manejarComandoLiberarCuarentenaTelegram(supabase, params.chatId, 0);
    } catch (err) {
      await answerCallbackQuery(params.callbackId, 'Error al liberar', true);
      await sendTelegramMessage(
        params.chatId,
        `❌ ${formatApproveError(err)}`,
        { parse_mode: 'HTML' },
      );
    }
    return true;
  }

  if (params.data.startsWith(PREFIX_RECHAZAR)) {
    const inspectionId = params.data.slice(PREFIX_RECHAZAR.length).trim();
    if (!inspectionId) return false;

    const { data: insp } = await supabase
      .from('quality_inspections')
      .select('id, status')
      .eq('id', inspectionId)
      .maybeSingle();

    if (!insp || insp.status !== 'PENDIENTE') {
      await answerCallbackQuery(params.callbackId, 'Ya procesado', true);
      return true;
    }

    const { error } = await supabase
      .from('quality_inspections')
      .update({ status: 'RECHAZADO', inspected_at: new Date().toISOString() })
      .eq('id', inspectionId);

    await answerCallbackQuery(params.callbackId, error ? 'Error' : 'Rechazado');
    if (error) {
      await sendTelegramMessage(params.chatId, `❌ ${error.message}`, { parse_mode: 'HTML' });
    } else {
      await sendTelegramMessage(
        params.chatId,
        '❌ Ítem rechazado en cuarentena (no suma stock).',
        { parse_mode: 'HTML' },
      );
      await manejarComandoLiberarCuarentenaTelegram(supabase, params.chatId, 0);
    }
    return true;
  }

  return false;
}
