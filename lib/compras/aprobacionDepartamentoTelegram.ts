import type { SupabaseClient } from '@supabase/supabase-js';
import {
  answerCallbackQuery,
  editTelegramMessage,
  sendTelegramMessage,
} from '@/lib/telegram/botApi';
import { isChatAllowedAsync } from '@/lib/telegram/chatWhitelist';
import {
  getTelegramEstado,
  setTelegramContexto,
} from '@/lib/telegram/estados';
import { esChatCanalAdminTelegram } from '@/lib/procuras/canalAdminTelegram';
import { etiquetaEstadoProcura } from '@/lib/procuras/procuraEstados';
import { resolverProcuraDepartamento } from '@/lib/compras/registrarProcuraDepartamento';
import { etiquetaResultadoAbastecimiento } from '@/lib/procuras/abastecimientoProcuraAprobada';
import {
  esUuidProcura,
  parseMetadataMotivoRechazo,
} from '@/lib/compras/telegramMetadata';
import {
  exigirUsuarioSistemaTelegram,
  usuarioEsProjectManagerProcura,
  usuarioPuedeInformarViabilidadProcura,
} from '@/lib/compras/usuariosSistemaTelegram';
import { esPmNominaProyecto } from '@/lib/procuras/aprobadoresProcuraTelegram';

export const CB_CMP_APROBAR = 'cmp_apr_';
export const CB_CMP_RECHAZAR_CANCEL = 'cmp_rech_cancel:';
export const CB_CMP_RECHAZAR = 'cmp_rech_';

const MIN_CHARS_MOTIVO_RECHAZO = 3;

function escHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

export function esEsperandoMotivoRechazoProcura(estado: {
  contexto: string;
}): boolean {
  return estado.contexto === 'esperando_motivo_rechazo';
}

export function esCallbackAprobacionDepartamentoCompras(data: string): boolean {
  return (
    data.startsWith(CB_CMP_APROBAR) ||
    data.startsWith(CB_CMP_RECHAZAR_CANCEL) ||
    data.startsWith(CB_CMP_RECHAZAR)
  );
}

function parseCallback(
  data: string,
): { accion: 'aprobar' | 'rechazar' | 'cancelar_rechazo'; procuraId: string } | null {
  if (data.startsWith(CB_CMP_RECHAZAR_CANCEL)) {
    const procuraId = data.slice(CB_CMP_RECHAZAR_CANCEL.length).trim();
    return esUuidProcura(procuraId) ? { accion: 'cancelar_rechazo', procuraId } : null;
  }
  if (data.startsWith(CB_CMP_APROBAR)) {
    const procuraId = data.slice(CB_CMP_APROBAR.length).trim();
    return esUuidProcura(procuraId) ? { accion: 'aprobar', procuraId } : null;
  }
  if (data.startsWith(CB_CMP_RECHAZAR)) {
    const procuraId = data.slice(CB_CMP_RECHAZAR.length).trim();
    return esUuidProcura(procuraId) ? { accion: 'rechazar', procuraId } : null;
  }
  return null;
}

async function puedeActuarComoProjectManager(
  supabase: SupabaseClient,
  chatId: string,
  userId: string,
  proyectoId?: string | null,
): Promise<
  | { ok: true; nombre: string; telegramId: number }
  | { ok: false; mensaje: string }
> {
  if (!(await isChatAllowedAsync(userId))) {
    return { ok: false, mensaje: 'Chat no autorizado' };
  }

  const auth = await exigirUsuarioSistemaTelegram(supabase, userId);
  if (auth.ok && usuarioEsProjectManagerProcura(auth.usuario)) {
    const pidUsuario = auth.usuario.proyecto_id?.trim() || null;
    const pidProcura = proyectoId?.trim() || null;
    if (pidUsuario && pidProcura && pidUsuario !== pidProcura) {
      return { ok: false, mensaje: '⛔ No eres Project Manager de esta obra.' };
    }
    return {
      ok: true,
      nombre: auth.usuario.nombre,
      telegramId: auth.usuario.telegram_id,
    };
  }

  const tid = parseInt(userId, 10);
  const pmNomina = await esPmNominaProyecto(
    supabase,
    userId,
    proyectoId?.trim() || null,
  );
  if (pmNomina.ok && Number.isFinite(tid)) {
    return { ok: true, nombre: pmNomina.nombre, telegramId: tid };
  }

  if (auth.ok && usuarioPuedeInformarViabilidadProcura(auth.usuario)) {
    return {
      ok: false,
      mensaje:
        '⛔ El Contador informa viabilidad presupuestaria; la aprobación la hace el Project Manager.',
    };
  }

  if (!auth.ok) return { ok: false, mensaje: auth.error };
  return {
    ok: false,
    mensaje: `⛔ Rol «${auth.usuario.rol}» no puede aprobar/rechazar. Se requiere Project Manager.`,
  };
}

type ProcuraAprobacionRow = {
  id: string;
  ticket: string;
  estado: string;
  solicitante_nombre: string | null;
  material_txt: string;
  cantidad: number;
  unidad: string;
  solicitante_telegram_chat_id: number | null;
  proyecto_id: string | null;
};

async function cargarProcuraParaAprobacion(
  supabase: SupabaseClient,
  procuraId: string,
): Promise<ProcuraAprobacionRow | null> {
  const { data, error } = await supabase
    .from('ci_procuras')
    .select(
      'id,ticket,estado,solicitante_nombre,material_txt,cantidad,unidad,solicitante_telegram_chat_id,proyecto_id',
    )
    .eq('id', procuraId.trim())
    .maybeSingle();

  if (error) {
    console.warn('[aprobacionDepartamento] cargar procura:', error.message);
    throw new Error(error.message);
  }
  if (!data) return null;
  return data as ProcuraAprobacionRow;
}

function chatPrivadoAprobador(userId: string): string {
  return userId.trim();
}

async function iniciarCapturaMotivoRechazo(
  supabase: SupabaseClient,
  params: {
    procuraId: string;
    userId: string;
    aprobadorNombre: string;
    aprobadorTelegramId: number;
    canalChatId: string;
    canalMessageId?: number;
  },
): Promise<{ ok: boolean; error?: string }> {
  try {
    const procura = await cargarProcuraParaAprobacion(supabase, params.procuraId);
    if (!procura) return { ok: false, error: 'Procura no encontrada' };

    const estadoActual = String(procura.estado ?? '').toLowerCase();
    if (estadoActual === 'solicitada') {
      return {
        ok: false,
        error: 'La procura espera validación del Administrador.',
      };
    }
    if (estadoActual !== 'pendiente_pm') {
      return {
        ok: false,
        error: `La procura ya está en estado «${etiquetaEstadoProcura(estadoActual)}»`,
      };
    }

    const ticket = String(procura.ticket ?? params.procuraId);
    const chatAprobador = chatPrivadoAprobador(params.userId);

    await setTelegramContexto(supabase, chatAprobador, {
      contexto: 'esperando_motivo_rechazo',
      reemplazarMetadata: true,
      metadata: {
        procura_id: params.procuraId,
        procura_ticket: ticket,
        aprobador_nombre: params.aprobadorNombre,
        aprobador_telegram_id: params.aprobadorTelegramId,
        canal_admin_chat_id: params.canalChatId,
        ...(params.canalMessageId != null
          ? { canal_admin_message_id: params.canalMessageId }
          : {}),
      },
    });

    await sendTelegramMessage(
      chatAprobador,
      `📝 Por favor, escribe el <b>motivo del rechazo</b> para la procura <b>${escHtml(ticket)}</b>:\n\n` +
        `📦 ${escHtml(String(procura.material_txt))}\n` +
        `🔢 ${Number(procura.cantidad).toLocaleString('es-VE')} ${escHtml(String(procura.unidad))}\n\n` +
        '<i>Mínimo 3 caracteres. El solicitante recibirá tu mensaje.</i>\n' +
        '<i>También puedes usar /cancelar o el botón de abajo.</i>',
      {
        parse_mode: 'HTML',
        reply_markup: {
          inline_keyboard: [
            [
              {
                text: '❌ Cancelar Rechazo',
                callback_data: `${CB_CMP_RECHAZAR_CANCEL}${params.procuraId}`,
              },
            ],
          ],
        },
      },
    );

    if (
      params.canalMessageId != null &&
      esChatCanalAdminTelegram(params.canalChatId) &&
      params.canalChatId !== chatAprobador
    ) {
      const pie =
        `\n\n⏳ <b>Rechazo pendiente</b> — esperando motivo de <b>${escHtml(params.aprobadorNombre)}</b>`;
      const texto =
        '🏗️ <b>PROCURA — en revisión</b>\n\n' +
        `🎫 <b>${escHtml(ticket)}</b>\n` +
        `👷 ${escHtml(String(procura.solicitante_nombre ?? '—'))}\n` +
        `📦 ${Number(procura.cantidad).toLocaleString('es-VE')} ${escHtml(String(procura.unidad))} · ${escHtml(String(procura.material_txt))}` +
        pie;
      try {
        await editTelegramMessage(params.canalChatId, params.canalMessageId, texto, {
          parse_mode: 'HTML',
        });
      } catch {
        /* mensaje del canal puede no ser editable */
      }
    }

    return { ok: true };
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Error al iniciar rechazo';
    console.warn('[aprobacionDepartamento] iniciarCaptura:', msg);
    return { ok: false, error: msg };
  }
}

async function editarMensajeCanalTrasResolucion(
  meta: ReturnType<typeof parseMetadataMotivoRechazo>,
  procura: ProcuraAprobacionRow,
  pie: string,
): Promise<void> {
  const chatCanal = meta.canal_admin_chat_id?.trim();
  const messageId = meta.canal_admin_message_id;
  if (!chatCanal || messageId == null) return;

  const texto =
    '🏗️ <b>PROCURA — resuelta</b>\n\n' +
    `🎫 <b>${escHtml(String(procura.ticket))}</b>\n` +
    `👷 ${escHtml(String(procura.solicitante_nombre ?? '—'))}\n` +
    `📦 ${Number(procura.cantidad).toLocaleString('es-VE')} ${escHtml(String(procura.unidad))} · ${escHtml(String(procura.material_txt))}` +
    pie;

  try {
    await editTelegramMessage(chatCanal, messageId, texto, { parse_mode: 'HTML' });
  } catch {
    /* fallback silencioso */
  }
}

async function restaurarMensajeCanalEnRevision(
  meta: ReturnType<typeof parseMetadataMotivoRechazo>,
  procura: ProcuraAprobacionRow,
): Promise<void> {
  const chatCanal = meta.canal_admin_chat_id?.trim();
  const messageId = meta.canal_admin_message_id;
  if (!chatCanal || messageId == null || !esChatCanalAdminTelegram(chatCanal)) return;

  const texto =
    '🏗️ <b>PROCURA — en revisión</b>\n\n' +
    `🎫 <b>${escHtml(String(procura.ticket))}</b>\n` +
    `👷 ${escHtml(String(procura.solicitante_nombre ?? '—'))}\n` +
    `📦 ${Number(procura.cantidad).toLocaleString('es-VE')} ${escHtml(String(procura.unidad))} · ${escHtml(String(procura.material_txt))}`;

  try {
    await editTelegramMessage(chatCanal, messageId, texto, {
      parse_mode: 'HTML',
      reply_markup: tecladoAprobacionDepartamento(String(procura.id)),
    });
  } catch {
    /* mensaje del canal puede no ser editable */
  }
}

/** Libera el estado de captura de motivo sin modificar la procura (sigue en solicitada). */
async function cancelarCapturaMotivoRechazo(
  supabase: SupabaseClient,
  chatId: string,
  procuraIdEsperado?: string,
): Promise<{ ok: boolean; mensaje: string }> {
  const estado = await getTelegramEstado(supabase, chatId);
  if (!esEsperandoMotivoRechazoProcura(estado)) {
    return { ok: false, mensaje: 'No hay un rechazo en curso.' };
  }

  const meta = parseMetadataMotivoRechazo(estado);
  const procuraId = meta.procura_id?.trim();
  if (!procuraId || !esUuidProcura(procuraId)) {
    await setTelegramContexto(supabase, chatId, { contexto: 'menu', metadata: {} });
    return { ok: false, mensaje: 'Sesión de rechazo inválida.' };
  }

  if (procuraIdEsperado && procuraId !== procuraIdEsperado.trim()) {
    return { ok: false, mensaje: 'La procura no coincide con la sesión activa.' };
  }

  const procura = await cargarProcuraParaAprobacion(supabase, procuraId);
  if (!procura) {
    await setTelegramContexto(supabase, chatId, { contexto: 'menu', metadata: {} });
    return { ok: false, mensaje: 'Procura no encontrada.' };
  }

  if (String(procura.estado ?? '').toLowerCase() !== 'pendiente_pm') {
    await setTelegramContexto(supabase, chatId, { contexto: 'menu', metadata: {} });
    return {
      ok: false,
      mensaje: `La procura ya está en estado «${etiquetaEstadoProcura(procura.estado)}».`,
    };
  }

  await restaurarMensajeCanalEnRevision(meta, procura);
  await setTelegramContexto(supabase, chatId, { contexto: 'menu', metadata: {} });

  return {
    ok: true,
    mensaje:
      `↩️ Rechazo cancelado. La procura <b>${escHtml(String(meta.procura_ticket ?? procura.ticket))}</b> ` +
      'sigue pendiente del <b>Project Manager</b>.',
  };
}

/** Captura el texto del motivo tras pulsar [Rechazar] en el canal admin. */
export async function manejarTextoMotivoRechazoProcura(
  supabase: SupabaseClient,
  chatId: string,
  texto: string,
): Promise<boolean> {
  const estado = await getTelegramEstado(supabase, chatId);
  if (!esEsperandoMotivoRechazoProcura(estado)) return false;

  if (/^\/cancelar\b/i.test(texto.trim())) {
    const cancel = await cancelarCapturaMotivoRechazo(supabase, chatId);
    await sendTelegramMessage(chatId, cancel.ok ? cancel.mensaje : `⚠️ ${cancel.mensaje}`, {
      parse_mode: 'HTML',
    });
    return true;
  }

  const meta = parseMetadataMotivoRechazo(estado);
  const procuraId = meta.procura_id?.trim();
  if (!procuraId || !esUuidProcura(procuraId)) {
    await setTelegramContexto(supabase, chatId, { contexto: 'menu', metadata: {} });
    await sendTelegramMessage(chatId, '⚠️ Sesión de rechazo inválida. Intenta de nuevo.', {
      parse_mode: 'HTML',
    });
    return true;
  }

  const motivo = texto.trim();
  if (motivo.length < MIN_CHARS_MOTIVO_RECHAZO) {
    await sendTelegramMessage(
      chatId,
      `⚠️ El motivo debe tener al menos ${MIN_CHARS_MOTIVO_RECHAZO} caracteres.`,
      { parse_mode: 'HTML' },
    );
    return true;
  }

  const aprobadorNombre = meta.aprobador_nombre?.trim() || 'Aprobador';
  const aprobadorTelegramId = meta.aprobador_telegram_id ?? (parseInt(chatId, 10) || 0);

  try {
    const resultado = await resolverProcuraDepartamento(supabase, {
      procuraId,
      accion: 'rechazar',
      aprobadorTelegramId,
      aprobadorNombre,
      motivoRechazo: motivo,
    });

    if (!resultado.ok) {
      await sendTelegramMessage(
        chatId,
        `❌ No se pudo rechazar: ${escHtml(resultado.error ?? 'Error')}`,
        { parse_mode: 'HTML' },
      );
      return true;
    }

    const procura = await cargarProcuraParaAprobacion(supabase, procuraId);
    if (procura) {
      const pie =
        `\n\n🔴 <b>Rechazada</b> por <b>${escHtml(aprobadorNombre)}</b>\n` +
        `💬 ${escHtml(motivo)}\n` +
        `Estado: <b>${escHtml(etiquetaEstadoProcura(resultado.estado ?? 'rechazada'))}</b>`;
      await editarMensajeCanalTrasResolucion(meta, procura, pie);
    }

    await setTelegramContexto(supabase, chatId, { contexto: 'menu', metadata: {} });

    await sendTelegramMessage(
      chatId,
      `✅ Procura <b>${escHtml(meta.procura_ticket ?? resultado.ticket ?? '')}</b> rechazada.\n` +
        'El solicitante fue notificado.',
      { parse_mode: 'HTML' },
    );
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Error';
    console.warn('[aprobacionDepartamento] texto motivo:', msg);
    await sendTelegramMessage(
      chatId,
      `❌ Error al procesar el rechazo: ${escHtml(msg)}`,
      { parse_mode: 'HTML' },
    );
  }

  return true;
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

  const procuraPreview = await cargarProcuraParaAprobacion(supabase, parsed.procuraId);
  if (procuraPreview) {
    const estPrev = String(procuraPreview.estado ?? '').toLowerCase();
    if (estPrev === 'solicitada') {
      await answerCallbackQuery(
        params.callbackId,
        'Espera validación del Administrador.',
        true,
      );
      return true;
    }
    if (estPrev !== 'pendiente_pm') {
      await answerCallbackQuery(params.callbackId, 'Esta procura ya fue resuelta.', true);
      return true;
    }
  }

  const perm = await puedeActuarComoProjectManager(
    supabase,
    params.chatId,
    params.userId,
    procuraPreview?.proyecto_id,
  );
  if (!perm.ok) {
    await answerCallbackQuery(params.callbackId, perm.mensaje.slice(0, 180), true);
    return true;
  }

  if (parsed.accion === 'cancelar_rechazo') {
    const chatAprobador = chatPrivadoAprobador(params.userId);
    if (params.chatId !== chatAprobador) {
      await answerCallbackQuery(params.callbackId, 'Usa este botón en tu chat privado', true);
      return true;
    }

    const cancel = await cancelarCapturaMotivoRechazo(
      supabase,
      chatAprobador,
      parsed.procuraId,
    );
    await answerCallbackQuery(
      params.callbackId,
      cancel.ok ? 'Rechazo cancelado' : cancel.mensaje.slice(0, 180),
      !cancel.ok,
    );
    await sendTelegramMessage(
      chatAprobador,
      cancel.ok ? cancel.mensaje : `⚠️ ${cancel.mensaje}`,
      { parse_mode: 'HTML' },
    );
    return true;
  }

  if (parsed.accion === 'rechazar') {
    await answerCallbackQuery(params.callbackId, 'Escribe el motivo en tu chat privado');
    const captura = await iniciarCapturaMotivoRechazo(supabase, {
      procuraId: parsed.procuraId,
      userId: params.userId,
      aprobadorNombre: perm.nombre,
      aprobadorTelegramId: perm.telegramId,
      canalChatId: params.chatId,
      canalMessageId: params.messageId,
    });
    if (!captura.ok) {
      await sendTelegramMessage(
        chatPrivadoAprobador(params.userId),
        `❌ ${escHtml(captura.error ?? 'No se pudo iniciar el rechazo')}`,
        { parse_mode: 'HTML' },
      );
    }
    return true;
  }

  await answerCallbackQuery(params.callbackId, 'Procesando…');

  try {
    const resultado = await resolverProcuraDepartamento(supabase, {
      procuraId: parsed.procuraId,
      accion: 'aprobar',
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

    const procura = await cargarProcuraParaAprobacion(supabase, parsed.procuraId);

    const pie =
      `\n\n🟢 <b>Aprobada</b> por <b>${escHtml(perm.nombre)}</b>\n` +
      `${escHtml(etiquetaResultadoAbastecimiento({ ok: true, estado: resultado.estado, ticket: resultado.ticket, modo: resultado.estado === 'aprobada' ? 'pendiente_depositario' : 'ejecutado', compraEmitida: (resultado.compradoresNotificados ?? 0) > 0 }))}\n` +
      `Estado: <b>${escHtml(etiquetaEstadoProcura(resultado.estado ?? 'aprobada'))}</b>`;

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
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Error';
    console.warn('[aprobacionDepartamento] aprobar:', msg);
    await sendTelegramMessage(
      params.chatId,
      `❌ Error al aprobar: ${escHtml(msg)}`,
      { parse_mode: 'HTML' },
    );
  }

  return true;
}

/** Botones [Aprobar] [Rechazar] para el Project Manager (vía larga, tras viabilidad Admin). */
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
