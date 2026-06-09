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
  ci_proyectos?: { nombre: string } | { nombre: string }[] | null;
};

/** Envía alerta al canal admin con botones Aprobar / Almacén / Rechazar. */
export async function enviarAlertaProcuraPendienteAdmin(
  supabase: SupabaseClient,
  procuraId: string,
): Promise<boolean> {
  const { config: alertas } = await cargarAlertasConfig(supabase);
  const canal = resolverCanalAdminEfectivo(alertas);
  if (!canal) {
    console.warn('[alertaAdminProcura] Canal admin Telegram no configurado');
    return false;
  }

  const { data, error } = await supabase
    .from('ci_procuras')
    .select(
      'id,ticket,estado,solicitante_nombre,material_txt,cantidad,unidad,observaciones,ci_proyectos(nombre)',
    )
    .eq('id', procuraId.trim())
    .maybeSingle();

  if (error || !data) {
    console.warn('[alertaAdminProcura] no se pudo cargar procura', procuraId, error?.message);
    return false;
  }

  const row = data as AlertaProcuraAdminRow;
  if (!debeAlertarProcura(row.estado, alertas)) return false;

  const obra = nombreObra(row.ci_proyectos);
  const solicitante = row.solicitante_nombre?.trim() || '—';
  const prioridad = prioridadProcuraDesdeObs(row.observaciones, alertas);
  const cantidad = Number(row.cantidad).toLocaleString('es-VE');

  const msg =
    '🏗️ <b>ALERTA DE PROCURA PENDIENTE</b>\n\n' +
    `🎫 <b>Ticket:</b> ${escHtml(row.ticket)}\n` +
    `👷‍♂️ <b>Solicitante:</b> ${escHtml(solicitante)}\n` +
    `📁 <b>Obra:</b> ${escHtml(obra)}\n` +
    `📦 <b>Material:</b> ${cantidad} ${escHtml(row.unidad)} de ${escHtml(row.material_txt)}\n` +
    `🔴 <b>Prioridad:</b> ${escHtml(prioridad)}\n\n` +
    '¿Deseas autorizar este requerimiento?';

  await sendTelegramMessage(canal, msg, {
    parse_mode: 'HTML',
    reply_markup: {
      inline_keyboard: [
        [
          { text: '🟢 Aprobar compra', callback_data: `${CB_PROCURA_ADMIN_APROBAR}${row.id}` },
          { text: '📦 Usar almacén', callback_data: `${CB_PROCURA_ADMIN_ALMACEN}${row.id}` },
        ],
        [{ text: '🔴 Rechazar', callback_data: `${CB_PROCURA_ADMIN_RECHAZAR}${row.id}` }],
      ],
    },
  });

  return true;
}
