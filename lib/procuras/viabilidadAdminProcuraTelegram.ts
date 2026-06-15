import type { SupabaseClient } from '@supabase/supabase-js';
import { answerCallbackQuery, sendTelegramMessage } from '@/lib/telegram/botApi';
import {
  exigirUsuarioSistemaTelegram,
  usuarioEsAdministradorProcura,
} from '@/lib/compras/usuariosSistemaTelegram';
import {
  prioridadProcuraDesdeObs,
  cargarAlertasConfig,
} from '@/lib/alertas/alertasConfig';
import {
  construirMensajePmDecisionProcura,
  resumenStockDesdeEvaluacion,
  type FilaProcuraMensaje,
} from '@/lib/procuras/mensajeAlertaProcuraTelegram';
import { listarProjectManagersProcuraTelegram } from '@/lib/procuras/aprobadoresProcuraTelegram';
import { tecladoAprobacionDepartamento } from '@/lib/compras/aprobacionDepartamentoTelegram';
import { esUuidProcura } from '@/lib/compras/telegramMetadata';
import { informarViabilidadAdminProcura } from '@/lib/procuras/informarViabilidadAdminProcura';

export const CB_CMP_VIAB_SI = 'cmp:via:si:';
export const CB_CMP_VIAB_NO = 'cmp:via:no:';

const SELECT_PROCURA_ALERTA = `
  id,ticket,estado,solicitante_nombre,solicitante_telegram_chat_id,material_txt,cantidad,unidad,
  observaciones,prioridad,monto_estimado_usd,capitulo_maestro_id,proyecto_id,
  cantidad_despacho,cantidad_compra,stock_almacen_detectado,
  viabilidad_presupuestaria,viabilidad_informada_por,
  ci_proyectos(nombre),ci_compras_capitulos_maestro(codigo,nombre)
`;

export function esCallbackViabilidadAdminProcura(data: string): boolean {
  return data.startsWith(CB_CMP_VIAB_SI) || data.startsWith(CB_CMP_VIAB_NO);
}

function parseCallbackViabilidad(
  data: string,
): { procuraId: string; viabilidad: 'si' | 'no' } | null {
  if (data.startsWith(CB_CMP_VIAB_SI)) {
    const id = data.slice(CB_CMP_VIAB_SI.length).trim();
    return esUuidProcura(id) ? { procuraId: id, viabilidad: 'si' } : null;
  }
  if (data.startsWith(CB_CMP_VIAB_NO)) {
    const id = data.slice(CB_CMP_VIAB_NO.length).trim();
    return esUuidProcura(id) ? { procuraId: id, viabilidad: 'no' } : null;
  }
  return null;
}

function tecladoViabilidadAdmin(procuraId: string) {
  return {
    inline_keyboard: [
      [
        { text: '✅ Hay disponibilidad', callback_data: `${CB_CMP_VIAB_SI}${procuraId}` },
        { text: '⚠️ No hay disponibilidad', callback_data: `${CB_CMP_VIAB_NO}${procuraId}` },
      ],
    ],
  };
}

export { tecladoViabilidadAdmin };

async function cargarFilaProcuraMensaje(
  supabase: SupabaseClient,
  procuraId: string,
): Promise<FilaProcuraMensaje | null> {
  const { data, error } = await supabase
    .from('ci_procuras')
    .select(SELECT_PROCURA_ALERTA)
    .eq('id', procuraId.trim())
    .maybeSingle();

  if (error || !data) return null;
  return data as FilaProcuraMensaje;
}

function esChatSolicitante(chatId: string | number, solicitanteChatId?: number | null): boolean {
  if (solicitanteChatId == null || !Number.isFinite(solicitanteChatId)) return false;
  return String(chatId) === String(Math.trunc(solicitanteChatId));
}

/** Notifica a PMs tras informe de viabilidad del Administrador. */
export async function enviarAlertaPmTrasViabilidadAdmin(
  supabase: SupabaseClient,
  procuraId: string,
): Promise<{ enviados: number }> {
  const row = await cargarFilaProcuraMensaje(supabase, procuraId);
  if (!row || String(row.estado ?? '').toLowerCase() !== 'pendiente_pm') {
    return { enviados: 0 };
  }

  const { config: alertas } = await cargarAlertasConfig(supabase);
  const prioridad = row.prioridad?.trim() || prioridadProcuraDesdeObs(row.observaciones, alertas);
  const stock = resumenStockDesdeEvaluacion(
    {
      cantidadSolicitada: Number(row.cantidad),
      cantidadDespacho: Number(row.cantidad_despacho ?? 0),
      cantidadCompra: Number(row.cantidad_compra ?? row.cantidad),
      stockDisponible: Number(row.stock_almacen_detectado ?? 0),
    },
    row.unidad,
  );

  const texto = construirMensajePmDecisionProcura(row, prioridad, stock);
  const replyMarkup = tecladoAprobacionDepartamento(row.id);
  const solicitanteChatId =
    row.solicitante_telegram_chat_id != null
      ? Number(row.solicitante_telegram_chat_id)
      : null;

  const pms = await listarProjectManagersProcuraTelegram(
    supabase,
    row.proyecto_id?.trim() || null,
  );

  let enviados = 0;
  for (const pm of pms) {
    if (esChatSolicitante(pm.chatId, solicitanteChatId)) continue;
    try {
      await sendTelegramMessage(String(pm.chatId), texto, {
        parse_mode: 'HTML',
        reply_markup: replyMarkup,
        rolDestinatario: 'Project Manager',
      });
      enviados += 1;
    } catch (e) {
      console.warn('[viabilidadAdminProcura] PM', pm.nombre, e);
    }
  }

  return { enviados };
}

export async function manejarCallbackViabilidadAdminProcuraTelegram(
  supabase: SupabaseClient,
  params: { chatId: string; callbackId: string; data: string; userId: string },
): Promise<boolean> {
  if (!esCallbackViabilidadAdminProcura(params.data)) return false;

  const parsed = parseCallbackViabilidad(params.data);
  if (!parsed) {
    await answerCallbackQuery(params.callbackId, 'Datos inválidos', true);
    return true;
  }

  const auth = await exigirUsuarioSistemaTelegram(supabase, params.userId);
  if (!auth.ok) {
    await answerCallbackQuery(params.callbackId, auth.error.slice(0, 180), true);
    return true;
  }
  if (!usuarioEsAdministradorProcura(auth.usuario)) {
    await answerCallbackQuery(
      params.callbackId,
      'Solo el Administrador puede informar disponibilidad presupuestaria.',
      true,
    );
    return true;
  }

  const resultado = await informarViabilidadAdminProcura(supabase, {
    procuraId: parsed.procuraId,
    viabilidad: parsed.viabilidad,
    adminNombre: auth.usuario.nombre,
    adminTelegramId: auth.usuario.telegram_id,
  });

  if (!resultado.ok) {
    await answerCallbackQuery(params.callbackId, resultado.error?.slice(0, 180) ?? 'Error', true);
    return true;
  }

  const label = parsed.viabilidad === 'si' ? 'Hay disponibilidad' : 'No hay disponibilidad';
  await answerCallbackQuery(params.callbackId, `${label} — avisando al PM`);

  if (!resultado.pmsNotificados) {
    await sendTelegramMessage(
      params.chatId,
      '⚠️ Viabilidad registrada, pero no hay PM con Telegram activo para notificar.',
      { parse_mode: 'HTML' },
    );
  }

  return true;
}
