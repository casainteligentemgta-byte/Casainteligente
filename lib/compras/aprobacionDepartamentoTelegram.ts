import type { SupabaseClient } from '@supabase/supabase-js';
import {
  answerCallbackQuery,
  editTelegramMessage,
  sendTelegramMessage,
} from '@/lib/telegram/botApi';
import { isChatAllowedAsync } from '@/lib/telegram/chatWhitelist';
import { esChatCanalAdminTelegram } from '@/lib/procuras/canalAdminTelegram';
import { etiquetaEstadoProcura } from '@/lib/procuras/procuraEstados';
import { notificarProcurasTelegram } from '@/lib/procuras/notificarProcuraTelegram';
import { resolverProcuraDepartamento } from '@/lib/compras/registrarProcuraDepartamento';
import {
  exigirUsuarioSistemaTelegram,
  usuarioPuedeAprobarProcura,
} from '@/lib/compras/usuariosSistemaTelegram';

export const CB_CMP_APROBAR = 'cmp_apr_';
export const CB_CMP_RECHAZAR = 'cmp_rech_';

function escHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

export function esCallbackAprobacionDepartamentoCompras(data: string): boolean {
  return data.startsWith(CB_CMP_APROBAR) || data.startsWith(CB_CMP_RECHAZAR);
}

function parseCallback(data: string): { accion: 'aprobar' | 'rechazar'; procuraId: string } | null {
  if (data.startsWith(CB_CMP_APROBAR)) {
    return { accion: 'aprobar', procuraId: data.slice(CB_CMP_APROBAR.length) };
  }
  if (data.startsWith(CB_CMP_RECHAZAR)) {
    return { accion: 'rechazar', procuraId: data.slice(CB_CMP_RECHAZAR.length) };
  }
  return null;
}

async function puedeActuarComoAprobador(
  supabase: SupabaseClient,
  chatId: string,
  userId: string,
): Promise<
  | { ok: true; nombre: string; telegramId: number }
  | { ok: false; mensaje: string }
> {
  if (!(await isChatAllowedAsync(userId))) {
    return { ok: false, mensaje: 'Chat no autorizado' };
  }

  if (esChatCanalAdminTelegram(chatId)) {
    return { ok: true, nombre: 'Canal admin', telegramId: parseInt(userId, 10) || 0 };
  }

  const auth = await exigirUsuarioSistemaTelegram(supabase, userId);
  if (!auth.ok) return { ok: false, mensaje: auth.error };
  if (!usuarioPuedeAprobarProcura(auth.usuario)) {
    return {
      ok: false,
      mensaje: `⛔ Rol «${auth.usuario.rol}» no puede aprobar/rechazar. Se requiere Aprobador o Administrador.`,
    };
  }

  return {
    ok: true,
    nombre: auth.usuario.nombre,
    telegramId: auth.usuario.telegram_id,
  };
}

export async function manejarCallbackAprobacionDepartamentoCompras(
  supabase: SupabaseClient,
  params: {
    chatId: string;
    callbackId: string;
    data: string;
    userId: string;
    messageId?: number;
  },
): Promise<boolean> {
  if (!esCallbackAprobacionDepartamentoCompras(params.data)) return false;

  const parsed = parseCallback(params.data);
  if (!parsed?.procuraId) {
    await answerCallbackQuery(params.callbackId, 'Datos inválidos', true);
    return true;
  }

  const perm = await puedeActuarComoAprobador(supabase, params.chatId, params.userId);
  if (!perm.ok) {
    await answerCallbackQuery(params.callbackId, perm.mensaje.slice(0, 180), true);
    return true;
  }

  await answerCallbackQuery(params.callbackId, 'Procesando…');

  const resultado = await resolverProcuraDepartamento(supabase, {
    procuraId: parsed.procuraId,
    accion: parsed.accion,
    aprobadorTelegramId: perm.telegramId,
    aprobadorNombre: perm.nombre,
  });

  if (!resultado.ok) {
    await sendTelegramMessage(
      params.chatId,
      `❌ No se pudo actualizar: ${escHtml(resultado.error ?? 'Error')}`,
      { parse_mode: 'HTML' },
    );
    return true;
  }

  const { data: procura } = await supabase
    .from('ci_procuras')
    .select(
      'ticket,solicitante_nombre,material_txt,cantidad,unidad,estado,solicitante_telegram_chat_id',
    )
    .eq('id', parsed.procuraId)
    .maybeSingle();

  if (procura && parsed.accion === 'aprobar') {
    const chatSol = (procura as { solicitante_telegram_chat_id?: number | null })
      .solicitante_telegram_chat_id;
    if (chatSol) {
      await notificarProcurasTelegram(
        [
          {
            ticket: String(procura.ticket ?? resultado.ticket ?? ''),
            material_txt: String(procura.material_txt ?? ''),
            nuevo_est: resultado.estado ?? 'aprobada',
            telegram_id: String(chatSol),
          },
        ],
        `Aprobada por ${perm.nombre}`,
      );
    }
  }

  const etiqueta = parsed.accion === 'rechazar' ? '🔴 Rechazada' : '🟢 Aprobada';
  const pie =
    `\n\n${etiqueta} por <b>${escHtml(perm.nombre)}</b>\n` +
    `Estado: <b>${escHtml(etiquetaEstadoProcura(resultado.estado ?? ''))}</b>`;

  if (params.messageId != null && procura) {
    const texto =
      '🏗️ <b>PROCURA — resuelta</b>\n\n' +
      `🎫 <b>${escHtml(String(procura.ticket ?? ''))}</b>\n` +
      `👷 ${escHtml(String(procura.solicitante_nombre ?? '—'))}\n` +
      `📦 ${Number(procura.cantidad).toLocaleString('es-VE')} ${escHtml(String(procura.unidad))} · ${escHtml(String(procura.material_txt))}` +
      pie;
    try {
      await editTelegramMessage(params.chatId, params.messageId, texto, { parse_mode: 'HTML' });
      return true;
    } catch {
      /* fallback */
    }
  }

  await sendTelegramMessage(
    params.chatId,
    `✅ Procura <b>${escHtml(resultado.ticket ?? '')}</b> actualizada.${pie}`,
    { parse_mode: 'HTML' },
  );
  return true;
}

/** Botones [Aprobar] [Rechazar] para canal admin (vía larga). */
export function tecladoAprobacionDepartamento(procuraId: string) {
  return {
    inline_keyboard: [
      [
        { text: '🟢 Aprobar', callback_data: `${CB_CMP_APROBAR}${procuraId}` },
        { text: '🔴 Rechazar', callback_data: `${CB_CMP_RECHAZAR}${procuraId}` },
      ],
    ],
  };
}
