import type { SupabaseClient } from '@supabase/supabase-js';
import { sendTelegramMessage } from '@/lib/telegram/botApi';
import {
  cargarAlertasConfig,
  debeAlertarProcura,
  prioridadProcuraDesdeObs,
  resolverCanalAdminEfectivo,
} from '@/lib/alertas/alertasConfig';
import {
  CB_PROCURA_ADMIN_ALMACEN,
  CB_PROCURA_ADMIN_APROBAR,
  CB_PROCURA_ADMIN_RECHAZAR,
} from '@/lib/procuras/procuraAdminCallbacks';
import { listarAprobadoresProcuraTelegram } from '@/lib/procuras/aprobadoresProcuraTelegram';
import { tecladoAprobacionDepartamento } from '@/lib/compras/aprobacionDepartamentoTelegram';
import { construirMensajesProcuraRegistradaPendiente } from '@/lib/procuras/mensajeAlertaProcuraTelegram';

export type AlertaProcuraAdminRow = {
  id: string;
  ticket: string;
  solicitante_nombre?: string | null;
  solicitante_telegram_chat_id?: number | null;
  material_txt: string;
  cantidad: number;
  unidad: string;
  estado: string;
  observaciones?: string | null;
  proyecto_id?: string | null;
  ci_proyectos?: { nombre: string } | { nombre: string }[] | null;
  capitulo_maestro_id?: string | null;
  prioridad?: string | null;
  monto_estimado_usd?: number | null;
};

export type ResultadoAlertaProcuraPendiente = {
  enviado: boolean;
  canalAdmin: boolean;
  dmsEnviados: number;
};

function esChatSolicitante(chatId: string | number, solicitanteChatId?: number | null): boolean {
  if (solicitanteChatId == null || !Number.isFinite(solicitanteChatId)) return false;
  return String(chatId) === String(Math.trunc(solicitanteChatId));
}

/** Envía alerta al canal admin y DM a Project Manager + Administrador (no al solicitante). */
export async function enviarAlertaProcuraPendienteAdmin(
  supabase: SupabaseClient,
  procuraId: string,
): Promise<ResultadoAlertaProcuraPendiente> {
  const { config: alertas } = await cargarAlertasConfig(supabase);
  const canal = resolverCanalAdminEfectivo(alertas);
  const sinCanal = !canal;
  if (sinCanal) {
    console.warn('[alertaAdminProcura] Canal admin Telegram no configurado');
  }

  const { data, error } = await supabase
    .from('ci_procuras')
    .select(
      'id,ticket,estado,solicitante_nombre,solicitante_telegram_chat_id,material_txt,cantidad,unidad,observaciones,prioridad,monto_estimado_usd,capitulo_maestro_id,proyecto_id,ci_proyectos(nombre),ci_compras_capitulos_maestro(codigo,nombre)',
    )
    .eq('id', procuraId.trim())
    .maybeSingle();

  if (error || !data) {
    console.warn('[alertaAdminProcura] no se pudo cargar procura', procuraId, error?.message);
    return { enviado: false, canalAdmin: false, dmsEnviados: 0 };
  }

  const row = data as AlertaProcuraAdminRow & {
    ci_compras_capitulos_maestro?: { codigo?: string; nombre?: string } | null;
  };
  if (!debeAlertarProcura(row.estado, alertas)) {
    return { enviado: false, canalAdmin: false, dmsEnviados: 0 };
  }

  const solicitanteChatId =
    row.solicitante_telegram_chat_id != null
      ? Number(row.solicitante_telegram_chat_id)
      : null;

  const prioridad =
    row.prioridad?.trim() || prioridadProcuraDesdeObs(row.observaciones, alertas);
  const mensajes = construirMensajesProcuraRegistradaPendiente(row, prioridad);

  const replyMarkup = row.capitulo_maestro_id
    ? tecladoAprobacionDepartamento(row.id)
    : {
        inline_keyboard: [
          [
            { text: '🟢 Aprobar compra', callback_data: `${CB_PROCURA_ADMIN_APROBAR}${row.id}` },
            { text: '📦 Usar almacén', callback_data: `${CB_PROCURA_ADMIN_ALMACEN}${row.id}` },
          ],
          [{ text: '🔴 Rechazar', callback_data: `${CB_PROCURA_ADMIN_RECHAZAR}${row.id}` }],
        ],
      };

  let canalAdmin = false;
  if (canal && !esChatSolicitante(canal, solicitanteChatId)) {
    try {
      await sendTelegramMessage(canal, mensajes.canalAdmin, {
        parse_mode: 'HTML',
        reply_markup: replyMarkup,
      });
      canalAdmin = true;
    } catch (e) {
      console.warn('[alertaAdminProcura] canal admin', e);
    }
  }

  const proyectoId = row.proyecto_id?.trim() || null;
  let aprobadores: Awaited<ReturnType<typeof listarAprobadoresProcuraTelegram>> = [];
  try {
    aprobadores = await listarAprobadoresProcuraTelegram(supabase, proyectoId);
  } catch (e) {
    console.warn('[alertaAdminProcura] listar aprobadores', e);
  }

  const dmMarkup = tecladoAprobacionDepartamento(row.id);

  let dmsEnviados = 0;
  for (const ap of aprobadores) {
    if (esChatSolicitante(ap.chatId, solicitanteChatId)) continue;
    if (canal && String(ap.chatId) === canal) continue;

    const msgDm =
      ap.rol === 'Administrador' ? mensajes.dmAdministrador : mensajes.dmProjectManager;
    try {
      await sendTelegramMessage(String(ap.chatId), msgDm, {
        parse_mode: 'HTML',
        reply_markup: dmMarkup,
        rolDestinatario:
          ap.rol === 'Administrador' ? 'Administrador' : 'Project Manager',
      });
      dmsEnviados += 1;
    } catch (e) {
      console.warn('[alertaAdminProcura] DM destinatario', ap.nombre, ap.chatId, e);
    }
  }

  return {
    enviado: canalAdmin || dmsEnviados > 0,
    canalAdmin,
    dmsEnviados,
  };
}
