import type { SupabaseClient } from '@supabase/supabase-js';
import {
  answerCallbackQuery,
  editTelegramMessage,
  sendTelegramMessage,
} from '@/lib/telegram/botApi';
import { isChatAllowedAsync } from '@/lib/telegram/chatWhitelist';
import { esChatCanalAdminTelegram } from '@/lib/procuras/canalAdminTelegram';
import {
  puedeAprobarProcuraTelegram,
  permisosEnforcementActivo,
  resolverActorTelegram,
} from '@/lib/auth/permisos';
import {
  obtenerUsuarioSistemaTelegram,
  usuarioPuedeAprobarProcura,
} from '@/lib/compras/usuariosSistemaTelegram';
import { emitirOrdenCompraProcura } from '@/lib/procuras/emitirOrdenCompraProcura';
import { etiquetaEstadoProcura } from '@/lib/procuras/procuraEstados';
import {
  CB_PROCURA_ADMIN_ALMACEN,
  CB_PROCURA_ADMIN_APROBAR,
  CB_PROCURA_ADMIN_RECHAZAR,
} from '@/lib/procuras/procuraAdminCallbacks';

export {
  CB_PROCURA_ADMIN_ALMACEN,
  CB_PROCURA_ADMIN_APROBAR,
  CB_PROCURA_ADMIN_RECHAZAR,
} from '@/lib/procuras/procuraAdminCallbacks';

type AccionAdmin = 'aprobar' | 'almacen' | 'rechazar';

function escHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

export function esCallbackProcuraAdmin(data: string): boolean {
  return (
    data.startsWith(CB_PROCURA_ADMIN_APROBAR) ||
    data.startsWith(CB_PROCURA_ADMIN_ALMACEN) ||
    data.startsWith(CB_PROCURA_ADMIN_RECHAZAR)
  );
}

function parseCallbackProcuraAdmin(data: string): { accion: AccionAdmin; procuraId: string } | null {
  if (data.startsWith(CB_PROCURA_ADMIN_APROBAR)) {
    return { accion: 'aprobar', procuraId: data.slice(CB_PROCURA_ADMIN_APROBAR.length) };
  }
  if (data.startsWith(CB_PROCURA_ADMIN_ALMACEN)) {
    return { accion: 'almacen', procuraId: data.slice(CB_PROCURA_ADMIN_ALMACEN.length) };
  }
  if (data.startsWith(CB_PROCURA_ADMIN_RECHAZAR)) {
    return { accion: 'rechazar', procuraId: data.slice(CB_PROCURA_ADMIN_RECHAZAR.length) };
  }
  return null;
}

async function puedeAutorizarProcuraAdmin(
  supabase: SupabaseClient,
  chatId: string,
  userId: string,
  accion: AccionAdmin,
): Promise<boolean> {
  if (!(await isChatAllowedAsync(userId))) return false;

  const usuarioDept = await obtenerUsuarioSistemaTelegram(supabase, userId);
  if (usuarioDept && usuarioPuedeAprobarProcura(usuarioDept)) {
    return true;
  }

  if (!permisosEnforcementActivo()) {
    if (esChatCanalAdminTelegram(chatId)) return false;
    return true;
  }

  const actor = await resolverActorTelegram(supabase, userId);
  return puedeAprobarProcuraTelegram(actor, accion);
}

async function procesarAccionProcuraAdmin(
  supabase: SupabaseClient,
  procuraId: string,
  accion: AccionAdmin,
  autorNombre: string,
): Promise<{
  ok: boolean;
  ticket?: string;
  estado?: string;
  error?: string;
  compradoresNotificados?: number;
}> {
  if (accion === 'aprobar') {
    return emitirOrdenCompraProcura(supabase, {
      procuraId,
      autorNombre,
      motivo: `Compra autorizada por ${autorNombre} (Telegram)`,
    });
  }

  const estado = accion === 'rechazar' ? 'rechazada' : 'aprobada';
  const motivo =
    accion === 'rechazar'
      ? `Rechazada por ${autorNombre} (Telegram)`
      : `Autorizada desde almacén por ${autorNombre} (Telegram)`;

  const { data, error } = await supabase.rpc(
    'procesar_procuras_lote' as 'ci_registrar_ingreso_manual_campo',
    {
      p_ids: [procuraId],
      p_nuevo_estado: estado,
      p_motivo: motivo,
    } as never,
  );

  if (error) {
    return { ok: false, error: error.message };
  }

  const filas = (data ?? []) as Array<{
    ticket: string;
    material_txt: string;
    nuevo_est: string;
    telegram_id: string | null;
  }>;

  if (filas.length) {
    const { notificarProcurasTelegram } = await import('@/lib/procuras/notificarProcuraTelegram');
    await notificarProcurasTelegram(
      filas.map((f) => ({
        ticket: f.ticket,
        material_txt: f.material_txt,
        nuevo_est: f.nuevo_est,
        telegram_id: f.telegram_id,
      })),
      motivo,
    );
  }

  return {
    ok: true,
    ticket: filas[0]?.ticket,
    estado: filas[0]?.nuevo_est ?? estado,
  };
}

export async function manejarCallbackProcuraAdminTelegram(
  supabase: SupabaseClient,
  params: {
    chatId: string;
    callbackId: string;
    data: string;
    userId: string;
    messageId?: number;
  },
): Promise<boolean> {
  if (!esCallbackProcuraAdmin(params.data)) return false;

  const parsed = parseCallbackProcuraAdmin(params.data);
  if (!parsed?.procuraId) {
    await answerCallbackQuery(params.callbackId, 'Datos inválidos', true);
    return true;
  }

  if (!(await puedeAutorizarProcuraAdmin(supabase, params.chatId, params.userId, parsed.accion))) {
    await answerCallbackQuery(params.callbackId, 'No autorizado para esta acción', true);
    return true;
  }

  const actor = await resolverActorTelegram(supabase, params.userId);
  const autorNombre = actor.nombre?.trim() || params.userId;

  await answerCallbackQuery(params.callbackId, 'Procesando…');

  const resultado = await procesarAccionProcuraAdmin(
    supabase,
    parsed.procuraId,
    parsed.accion,
    autorNombre,
  );

  if (!resultado.ok) {
    await sendTelegramMessage(
      params.chatId,
      `❌ No se pudo actualizar la procura: ${escHtml(resultado.error ?? 'Error')}`,
      { parse_mode: 'HTML' },
    );
    return true;
  }

  const etiquetaAccion =
    parsed.accion === 'rechazar'
      ? '🔴 Rechazada'
      : parsed.accion === 'almacen'
        ? '📦 Aprobada (almacén)'
        : '🟢 Orden de compra';

  const compradoresPie =
    parsed.accion === 'aprobar' &&
    resultado.compradoresNotificados != null &&
    resultado.compradoresNotificados > 0
      ? `\n🛒 Avisados ${resultado.compradoresNotificados} comprador(es).`
      : parsed.accion === 'aprobar'
        ? '\n⚠️ Sin compradores Telegram activos.'
        : '';

  const pie =
    `\n\n${etiquetaAccion} por <code>${escHtml(autorNombre)}</code>${compradoresPie}\n` +
    `Estado: <b>${escHtml(etiquetaEstadoProcura(resultado.estado ?? ''))}</b>`;

  if (params.messageId != null) {
    try {
      const { data: procura } = await supabase
        .from('ci_procuras')
        .select('ticket,solicitante_nombre,material_txt,cantidad,unidad,ci_proyectos(nombre)')
        .eq('id', parsed.procuraId)
        .maybeSingle();

      if (procura) {
        const rel = procura.ci_proyectos as
          | { nombre?: string }
          | { nombre?: string }[]
          | null
          | undefined;
        const obra = Array.isArray(rel) ? rel[0]?.nombre : rel?.nombre;
        const texto =
          '🏗️ <b>PROCURA — resuelta</b>\n\n' +
          `🎫 <b>Ticket:</b> ${escHtml(String(procura.ticket ?? resultado.ticket ?? ''))}\n` +
          `👷‍♂️ <b>Solicitante:</b> ${escHtml(String(procura.solicitante_nombre ?? '—'))}\n` +
          `📁 <b>Obra:</b> ${escHtml(String(obra ?? '—'))}\n` +
          `📦 <b>Material:</b> ${Number(procura.cantidad).toLocaleString('es-VE')} ${escHtml(String(procura.unidad))} de ${escHtml(String(procura.material_txt))}` +
          pie;
        await editTelegramMessage(params.chatId, params.messageId, texto, { parse_mode: 'HTML' });
        return true;
      }
    } catch {
      /* fallback abajo */
    }
  }

  await sendTelegramMessage(
    params.chatId,
    `✅ Procura <b>${escHtml(resultado.ticket ?? '')}</b> actualizada.${pie}`,
    { parse_mode: 'HTML' },
  );
  return true;
}
