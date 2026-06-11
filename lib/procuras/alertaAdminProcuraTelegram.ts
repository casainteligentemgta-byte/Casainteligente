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
import { etiquetaCapituloMaestro } from '@/lib/compras/capitulosMaestro';

function escHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function nombreObra(
  rel: { nombre?: string } | { nombre?: string }[] | null | undefined,
): string {
  if (!rel) return '—';
  if (Array.isArray(rel)) return rel[0]?.nombre?.trim() || '—';
  return rel.nombre?.trim() || '—';
}

export type AlertaProcuraAdminRow = {
  id: string;
  ticket: string;
  solicitante_nombre?: string | null;
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

/** Envía alerta al canal admin y DM a Project Manager + Administrador. */
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
      'id,ticket,estado,solicitante_nombre,material_txt,cantidad,unidad,observaciones,prioridad,monto_estimado_usd,capitulo_maestro_id,proyecto_id,ci_proyectos(nombre),ci_compras_capitulos_maestro(codigo,nombre)',
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

  const capRel = row.ci_compras_capitulos_maestro;
  const capLabel = capRel
    ? etiquetaCapituloMaestro({
        codigo: String(capRel.codigo ?? ''),
        nombre: String(capRel.nombre ?? ''),
      })
    : null;
  const obra = capLabel || nombreObra(row.ci_proyectos);
  const solicitante = row.solicitante_nombre?.trim() || '—';
  const prioridad =
    row.prioridad?.trim() || prioridadProcuraDesdeObs(row.observaciones, alertas);
  const cantidad = Number(row.cantidad).toLocaleString('es-VE');
  const montoUsd =
    row.monto_estimado_usd != null && Number.isFinite(Number(row.monto_estimado_usd))
      ? `\n💵 Estimado: <b>USD ${Number(row.monto_estimado_usd).toFixed(2)}</b>`
      : '';

  const msg =
    '🏗️ <b>ALERTA DE PROCURA PENDIENTE</b>\n\n' +
    `🎫 <b>Ticket:</b> ${escHtml(row.ticket)}\n` +
    `👷‍♂️ <b>Solicitante:</b> ${escHtml(solicitante)}\n` +
    `📁 <b>Capítulo / Obra:</b> ${escHtml(obra)}\n` +
    `📦 <b>Material:</b> ${cantidad} ${escHtml(row.unidad)} de ${escHtml(row.material_txt)}\n` +
    `🔴 <b>Prioridad:</b> ${escHtml(prioridad)}${montoUsd}\n\n` +
    '¿Autoriza el Project Manager?';

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
  if (canal) {
    try {
      await sendTelegramMessage(canal, msg, {
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
  const cuerpoDm = msg.replace('🏗️ <b>ALERTA DE PROCURA PENDIENTE</b>\n\n', '');
  const msgDmPm =
    '👷‍♂️ <b>ALERTA — Procura pendiente (Project Manager)</b>\n\n' + cuerpoDm;
  const msgDmAdmin =
    '🛡️ <b>ALERTA — Procura pendiente (Administrador)</b>\n\n' + cuerpoDm;

  let dmsEnviados = 0;
  for (const ap of aprobadores) {
    if (canal && String(ap.chatId) === canal) continue;
    const msgDm = ap.rol === 'Administrador' ? msgDmAdmin : msgDmPm;
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
