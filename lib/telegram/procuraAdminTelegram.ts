import type { SupabaseClient } from '@supabase/supabase-js';
import {
  answerCallbackQuery,
  editTelegramMessage,
  sendTelegramMessage,
} from '@/lib/telegram/botApi';
import { isChatAllowedAsync } from '@/lib/telegram/chatWhitelist';
import { esChatCanalAdminTelegram } from '@/lib/procuras/canalAdminTelegram';
import { notificarProcurasTelegram } from '@/lib/procuras/notificarProcuraTelegram';
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
  chatId: string,
  userId: string,
): Promise<boolean> {
  if (esChatCanalAdminTelegram(chatId)) {
    return isChatAllowedAsync(userId);
  }
  return isChatAllowedAsync(userId);
}

async function procesarAccionProcuraAdmin(
  supabase: SupabaseClient,
  procuraId: string,
  accion: AccionAdmin,
  autorNombre: string,
): Promise<{ ok: boolean; ticket?: string; estado?: string; error?: string }> {
  const estado =
    accion === 'rechazar' ? 'rechazada' : accion === 'almacen' ? 'aprobada' : 'en_compra';
  const motivo =
    accion === 'rechazar'
      ? `Rechazada por ${autorNombre} (Telegram)`
      : accion === 'almacen'
        ? `Autorizada desde almacén por ${autorNombre} (Telegram)`
        : `Compra autorizada por ${autorNombre} (Telegram)`;

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

  if (!(await puedeAutorizarProcuraAdmin(params.chatId, params.userId))) {
    await answerCallbackQuery(params.callbackId, 'No autorizado', true);
    return true;
  }

  const autorNombre = params.userId;

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
        : '🟢 En compra';

  const pie =
    `\n\n${etiquetaAccion} por <code>${escHtml(autorNombre)}</code>\n` +
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
