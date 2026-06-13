import type { SupabaseClient } from '@supabase/supabase-js';
import { sendTelegramMessage } from '@/lib/telegram/botApi';
import {
  cargarAlertasConfig,
  debeAlertarProcura,
  prioridadProcuraDesdeObs,
} from '@/lib/alertas/alertasConfig';
import { listarAdministradoresProcuraTelegram } from '@/lib/procuras/aprobadoresProcuraTelegram';
import {
  construirMensajeAdminViabilidadProcura,
  resumenStockDesdeEvaluacion,
  type FilaProcuraMensaje,
} from '@/lib/procuras/mensajeAlertaProcuraTelegram';
import { tecladoViabilidadAdmin } from '@/lib/procuras/viabilidadAdminProcuraTelegram';

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

/** Solo Administrador: informar viabilidad presupuestaria (vía larga). */
export async function enviarAlertaProcuraPendienteAdmin(
  supabase: SupabaseClient,
  procuraId: string,
): Promise<ResultadoAlertaProcuraPendiente> {
  const { config: alertas } = await cargarAlertasConfig(supabase);

  const { data, error } = await supabase
    .from('ci_procuras')
    .select(
      'id,ticket,estado,solicitante_nombre,solicitante_telegram_chat_id,material_txt,cantidad,unidad,observaciones,prioridad,monto_estimado_usd,capitulo_maestro_id,proyecto_id,cantidad_despacho,cantidad_compra,stock_almacen_detectado,ci_proyectos(nombre),ci_compras_capitulos_maestro(codigo,nombre)',
    )
    .eq('id', procuraId.trim())
    .maybeSingle();

  if (error || !data) {
    console.warn('[alertaAdminProcura] no se pudo cargar procura', procuraId, error?.message);
    return { enviado: false, canalAdmin: false, dmsEnviados: 0 };
  }

  const row = data as FilaProcuraMensaje;
  if (!debeAlertarProcura(row.estado, alertas)) {
    return { enviado: false, canalAdmin: false, dmsEnviados: 0 };
  }

  const solicitanteChatId =
    row.solicitante_telegram_chat_id != null
      ? Number(row.solicitante_telegram_chat_id)
      : null;

  const prioridad =
    row.prioridad?.trim() || prioridadProcuraDesdeObs(row.observaciones, alertas);
  const stock = resumenStockDesdeEvaluacion(
    {
      cantidadSolicitada: Number(row.cantidad),
      cantidadDespacho: Number(row.cantidad_despacho ?? 0),
      cantidadCompra: Number(row.cantidad_compra ?? row.cantidad),
      stockDisponible: Number(row.stock_almacen_detectado ?? 0),
    },
    row.unidad,
  );
  const mensaje = construirMensajeAdminViabilidadProcura(row, prioridad, stock);
  const replyMarkup = tecladoViabilidadAdmin(row.id);

  const proyectoId = row.proyecto_id?.trim() || null;
  let administradores: Awaited<ReturnType<typeof listarAdministradoresProcuraTelegram>> = [];
  try {
    administradores = await listarAdministradoresProcuraTelegram(supabase, proyectoId);
  } catch (e) {
    console.warn('[alertaAdminProcura] listar administradores', e);
  }

  let dmsEnviados = 0;
  for (const adm of administradores) {
    if (esChatSolicitante(adm.chatId, solicitanteChatId)) continue;

    try {
      await sendTelegramMessage(String(adm.chatId), mensaje, {
        parse_mode: 'HTML',
        reply_markup: replyMarkup,
        rolDestinatario: 'Administrador',
      });
      dmsEnviados += 1;
    } catch (e) {
      console.warn('[alertaAdminProcura] DM administrador', adm.nombre, adm.chatId, e);
    }
  }

  return {
    enviado: dmsEnviados > 0,
    canalAdmin: false,
    dmsEnviados,
  };
}
