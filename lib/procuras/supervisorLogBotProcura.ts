import type { SupabaseClient } from '@supabase/supabase-js';
import { CB_CMP_APROBAR, CB_CMP_RECHAZAR } from '@/lib/compras/aprobacionDepartamentoTelegram';
import { resolverProcuraDepartamento } from '@/lib/compras/registrarProcuraDepartamento';
import { esUuidProcura } from '@/lib/compras/telegramMetadata';
import {
  CB_PROCURA_ABASTECIMIENTO_OK,
  confirmarAbastecimientoProcura,
  etiquetaResultadoAbastecimiento,
} from '@/lib/procuras/abastecimientoProcuraAprobada';
import { informarViabilidadAdminProcura } from '@/lib/procuras/informarViabilidadAdminProcura';
import {
  emitirOrdenCompraProcura,
  mensajeOrdenCompraComprador,
  cargarProcuraOrdenCompra,
} from '@/lib/procuras/emitirOrdenCompraProcura';
import { CB_CMP_VIAB_NO, CB_CMP_VIAB_SI } from '@/lib/procuras/viabilidadAdminProcuraTelegram';
import {
  answerLogBotCallbackQuery,
  editLogBotMessage,
  getTelegramLogChatId,
  isLogBotConfigured,
  sendLogBotMessage,
} from '@/lib/telegram/logBotApi';

/** Viabilidad (contador operativo). */
export const CB_LOG_VIAB_SI = 'log:via:si:';
export const CB_LOG_VIAB_NO = 'log:via:no:';
/** Project Manager. */
export const CB_LOG_PM_APROBAR = 'log:pm:apr:';
export const CB_LOG_PM_RECHAZAR = 'log:pm:rech:';
/** Depositario — verificación y abastecimiento. */
export const CB_LOG_DEP_ABASTECER = 'log:dep:abas:';
/** Comprador — reenviar orden de compra. */
export const CB_LOG_COM_ORDEN = 'log:com:orden:';

const MAX_TEXTO_LOG = 3800;

function escHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function truncar(s: string, max: number): string {
  if (s.length <= max) return s;
  return `${s.slice(0, max - 1)}…`;
}

export function formatFechaHoraVeSupervisorLog(): string {
  return new Intl.DateTimeFormat('es-VE', {
    dateStyle: 'short',
    timeStyle: 'medium',
    timeZone: 'America/Caracas',
  }).format(new Date());
}

export function nombreSupervisorDesdeCallback(from?: {
  id?: number;
  first_name?: string;
  username?: string;
}): string {
  const first = from?.first_name?.trim();
  const user = from?.username?.trim();
  if (first && user) return `${first} (@${user})`;
  if (first) return first;
  if (user) return `@${user}`;
  if (from?.id != null) return `Supervisor ${from.id}`;
  return 'Supervisor';
}

function extraerProcuraIdDesdeCallback(data: string, prefijo: string): string | null {
  if (!data.startsWith(prefijo)) return null;
  const id = data.slice(prefijo.length).trim();
  return esUuidProcura(id) ? id : null;
}

export function esCallbackSupervisorLogProcura(data: string): boolean {
  return (
    data.startsWith(CB_LOG_VIAB_SI) ||
    data.startsWith(CB_LOG_VIAB_NO) ||
    data.startsWith(CB_LOG_PM_APROBAR) ||
    data.startsWith(CB_LOG_PM_RECHAZAR) ||
    data.startsWith(CB_LOG_DEP_ABASTECER) ||
    data.startsWith(CB_LOG_COM_ORDEN)
  );
}

/** @deprecated usar esCallbackSupervisorLogProcura */
export function esCallbackViabilidadSupervisorLog(data: string): boolean {
  return data.startsWith(CB_LOG_VIAB_SI) || data.startsWith(CB_LOG_VIAB_NO);
}

export function tecladoViabilidadSupervisorLog(procuraId: string) {
  return {
    inline_keyboard: [
      [
        { text: '✅ Hay disponibilidad', callback_data: `${CB_LOG_VIAB_SI}${procuraId}` },
        { text: '⚠️ No hay disponibilidad', callback_data: `${CB_LOG_VIAB_NO}${procuraId}` },
      ],
    ],
  };
}

export function tecladoPmSupervisorLog(procuraId: string) {
  return {
    inline_keyboard: [
      [
        { text: '🟢 Aprobar (supervisor)', callback_data: `${CB_LOG_PM_APROBAR}${procuraId}` },
        { text: '🔴 Rechazar (supervisor)', callback_data: `${CB_LOG_PM_RECHAZAR}${procuraId}` },
      ],
    ],
  };
}

export function tecladoDepositarioSupervisorLog(procuraId: string) {
  return {
    inline_keyboard: [
      [
        {
          text: '✅ Confirmar verificación (supervisor)',
          callback_data: `${CB_LOG_DEP_ABASTECER}${procuraId}`,
        },
      ],
    ],
  };
}

export function tecladoCompradorSupervisorLog(procuraId: string) {
  return {
    inline_keyboard: [
      [
        {
          text: '📤 Reenviar orden al comprador',
          callback_data: `${CB_LOG_COM_ORDEN}${procuraId}`,
        },
      ],
    ],
  };
}

/** Convierte botones del bot operativo en acciones del supervisor en el log bot. */
export function mapearTecladoOperativoASupervisorLog(reply_markup?: unknown): unknown | null {
  if (!reply_markup || typeof reply_markup !== 'object') return null;
  const kb = reply_markup as { inline_keyboard?: { callback_data?: string }[][] };
  const firstCb = kb.inline_keyboard?.flat().find((b) => b.callback_data?.trim())?.callback_data;
  if (!firstCb) return null;

  if (firstCb.startsWith(CB_CMP_VIAB_SI) || firstCb.startsWith(CB_CMP_VIAB_NO)) {
    const id = firstCb.startsWith(CB_CMP_VIAB_SI)
      ? firstCb.slice(CB_CMP_VIAB_SI.length).trim()
      : firstCb.slice(CB_CMP_VIAB_NO.length).trim();
    return esUuidProcura(id) ? tecladoViabilidadSupervisorLog(id) : null;
  }
  if (firstCb.startsWith(CB_CMP_APROBAR) || firstCb.startsWith(CB_CMP_RECHAZAR)) {
    const id = firstCb.startsWith(CB_CMP_APROBAR)
      ? firstCb.slice(CB_CMP_APROBAR.length).trim()
      : firstCb.slice(CB_CMP_RECHAZAR.length).trim();
    return esUuidProcura(id) ? tecladoPmSupervisorLog(id) : null;
  }
  if (firstCb.startsWith(CB_PROCURA_ABASTECIMIENTO_OK)) {
    const id = firstCb.slice(CB_PROCURA_ABASTECIMIENTO_OK.length).trim();
    return esUuidProcura(id) ? tecladoDepositarioSupervisorLog(id) : null;
  }
  return null;
}

const SIN_TECLADO = { reply_markup: { inline_keyboard: [] as [] } };

async function finalizarMensajeLogSupervisor(params: {
  chatId: string | number;
  messageId: number;
  textoOriginal: string;
  ok: boolean;
  detalle: string;
}): Promise<void> {
  const stamp = formatFechaHoraVeSupervisorLog();
  const icono = params.ok ? '✅' : '❌';
  await editLogBotMessage(
    params.chatId,
    params.messageId,
    `${params.textoOriginal}\n\n` +
      `${icono} <b>[${escHtml(stamp)}]</b> <b>Supervisor:</b> ${escHtml(params.detalle)}`,
    { parse_mode: 'HTML', ...SIN_TECLADO },
  );
}

async function manejarViabilidadSupervisor(
  supabase: SupabaseClient,
  params: {
    data: string;
    callbackId: string;
    chatId: string | number;
    messageId: number;
    textoOriginal: string;
    from?: { id?: number; first_name?: string; username?: string };
  },
): Promise<boolean> {
  const viabilidad = params.data.startsWith(CB_LOG_VIAB_SI) ? 'si' : 'no';
  const procuraId = extraerProcuraIdDesdeCallback(
    params.data,
    viabilidad === 'si' ? CB_LOG_VIAB_SI : CB_LOG_VIAB_NO,
  );
  if (!procuraId) {
    await answerLogBotCallbackQuery(params.callbackId, 'Datos inválidos', true);
    return true;
  }

  const supervisorNombre = nombreSupervisorDesdeCallback(params.from);
  await answerLogBotCallbackQuery(params.callbackId, 'Registrando viabilidad…');

  const resultado = await informarViabilidadAdminProcura(supabase, {
    procuraId,
    viabilidad,
    adminNombre: supervisorNombre,
    adminTelegramId: params.from?.id ?? null,
    adminUsuarioId: params.from?.id != null ? String(params.from.id) : null,
    origen: 'telegram_log_supervisor',
    informadoPorRol: 'supervisor',
  });

  const label = viabilidad === 'si' ? 'Hay disponibilidad' : 'No hay disponibilidad';
  if (!resultado.ok) {
    await finalizarMensajeLogSupervisor({
      ...params,
      ok: false,
      detalle: resultado.error ?? 'Error',
    });
    return true;
  }

  const pmNota =
    resultado.pmsNotificados && resultado.pmsNotificados > 0
      ? `${label}. PM notificado (${resultado.pmsNotificados}).`
      : `${label}. Sin PM Telegram para notificar.`;

  await finalizarMensajeLogSupervisor({ ...params, ok: true, detalle: pmNota });
  return true;
}

async function manejarPmSupervisor(
  supabase: SupabaseClient,
  params: {
    data: string;
    callbackId: string;
    chatId: string | number;
    messageId: number;
    textoOriginal: string;
    from?: { id?: number; first_name?: string; username?: string };
  },
): Promise<boolean> {
  const aprobar = params.data.startsWith(CB_LOG_PM_APROBAR);
  const procuraId = extraerProcuraIdDesdeCallback(
    params.data,
    aprobar ? CB_LOG_PM_APROBAR : CB_LOG_PM_RECHAZAR,
  );
  if (!procuraId) {
    await answerLogBotCallbackQuery(params.callbackId, 'Datos inválidos', true);
    return true;
  }

  const supervisorNombre = nombreSupervisorDesdeCallback(params.from);
  const telegramId = params.from?.id ?? 0;
  await answerLogBotCallbackQuery(
    params.callbackId,
    aprobar ? 'Aprobando procura…' : 'Rechazando procura…',
  );

  const resultado = await resolverProcuraDepartamento(supabase, {
    procuraId,
    accion: aprobar ? 'aprobar' : 'rechazar',
    aprobadorTelegramId: telegramId,
    aprobadorNombre: `Supervisor: ${supervisorNombre}`,
    motivoRechazo: aprobar
      ? undefined
      : `Rechazada por supervisor desde log bot (${supervisorNombre})`,
  });

  if (!resultado.ok) {
    await finalizarMensajeLogSupervisor({
      ...params,
      ok: false,
      detalle: resultado.error ?? 'Error',
    });
    return true;
  }

  const detalle = aprobar
    ? `Procura aprobada. ${resultado.estado ?? 'aprobada'}.`
    : `Procura rechazada.`;
  await finalizarMensajeLogSupervisor({ ...params, ok: true, detalle });
  return true;
}

async function manejarDepositarioSupervisor(
  supabase: SupabaseClient,
  params: {
    data: string;
    callbackId: string;
    chatId: string | number;
    messageId: number;
    textoOriginal: string;
    from?: { id?: number; first_name?: string; username?: string };
  },
): Promise<boolean> {
  const procuraId = extraerProcuraIdDesdeCallback(params.data, CB_LOG_DEP_ABASTECER);
  if (!procuraId) {
    await answerLogBotCallbackQuery(params.callbackId, 'Datos inválidos', true);
    return true;
  }

  const supervisorNombre = nombreSupervisorDesdeCallback(params.from);
  await answerLogBotCallbackQuery(params.callbackId, 'Verificando almacén…');

  const resultado = await confirmarAbastecimientoProcura(supabase, {
    procuraId,
    autorNombre: `Supervisor: ${supervisorNombre}`,
  });

  if (!resultado.ok) {
    await finalizarMensajeLogSupervisor({
      ...params,
      ok: false,
      detalle: resultado.error ?? 'Error',
    });
    return true;
  }

  await finalizarMensajeLogSupervisor({
    ...params,
    ok: true,
    detalle: etiquetaResultadoAbastecimiento(resultado),
  });
  return true;
}

async function manejarCompradorSupervisor(
  supabase: SupabaseClient,
  params: {
    data: string;
    callbackId: string;
    chatId: string | number;
    messageId: number;
    textoOriginal: string;
    from?: { id?: number; first_name?: string; username?: string };
  },
): Promise<boolean> {
  const procuraId = extraerProcuraIdDesdeCallback(params.data, CB_LOG_COM_ORDEN);
  if (!procuraId) {
    await answerLogBotCallbackQuery(params.callbackId, 'Datos inválidos', true);
    return true;
  }

  const supervisorNombre = nombreSupervisorDesdeCallback(params.from);
  await answerLogBotCallbackQuery(params.callbackId, 'Reenviando orden…');

  const resultado = await emitirOrdenCompraProcura(supabase, {
    procuraId,
    autorNombre: `Supervisor: ${supervisorNombre}`,
    motivo: 'Reenvío de orden por supervisor (log bot)',
  });

  if (!resultado.ok) {
    await finalizarMensajeLogSupervisor({
      ...params,
      ok: false,
      detalle: resultado.error ?? 'Error',
    });
    return true;
  }

  const notif = resultado.compradoresNotificados ?? 0;
  const detalle =
    notif > 0
      ? `Orden reenviada a ${notif} comprador(es).`
      : 'Orden registrada; sin compradores Telegram activos.';
  await finalizarMensajeLogSupervisor({ ...params, ok: true, detalle });
  return true;
}

/**
 * Supervisor del flujo procura en el bot de logs.
 * Puede actuar como contador operativo, PM, depositario o comprador (reenvío).
 */
export async function manejarCallbackSupervisorLogProcura(
  supabase: SupabaseClient,
  params: {
    callbackId: string;
    data: string;
    chatId: string | number;
    messageId: number;
    textoOriginal: string;
    from?: { id?: number; first_name?: string; username?: string };
  },
): Promise<boolean> {
  if (!esCallbackSupervisorLogProcura(params.data)) return false;

  const allowedChat = getTelegramLogChatId();
  if (!allowedChat || String(params.chatId) !== allowedChat) {
    await answerLogBotCallbackQuery(params.callbackId, 'Chat no autorizado', true);
    return true;
  }

  if (params.data.startsWith(CB_LOG_VIAB_SI) || params.data.startsWith(CB_LOG_VIAB_NO)) {
    return manejarViabilidadSupervisor(supabase, params);
  }
  if (params.data.startsWith(CB_LOG_PM_APROBAR) || params.data.startsWith(CB_LOG_PM_RECHAZAR)) {
    return manejarPmSupervisor(supabase, params);
  }
  if (params.data.startsWith(CB_LOG_DEP_ABASTECER)) {
    return manejarDepositarioSupervisor(supabase, params);
  }
  if (params.data.startsWith(CB_LOG_COM_ORDEN)) {
    return manejarCompradorSupervisor(supabase, params);
  }

  return false;
}

/** @deprecated usar manejarCallbackSupervisorLogProcura */
export async function manejarCallbackViabilidadSupervisorLogBot(
  supabase: SupabaseClient,
  params: Parameters<typeof manejarCallbackSupervisorLogProcura>[1],
): Promise<boolean> {
  return manejarCallbackSupervisorLogProcura(supabase, params);
}

/** Réplica dedicada: orden de compra → comprador(es) + supervisor en log bot. */
export async function replicarOrdenCompraProcuraEnLogBot(params: {
  procuraId: string;
  mensaje: string;
  ticket: string;
  destinatarios: { nombre: string; chatId: number }[];
}): Promise<void> {
  if (!isLogBotConfigured()) return;

  const logChat = getTelegramLogChatId();
  if (!logChat) return;

  const bloquePara =
    params.destinatarios.length > 0
      ? '<b>Para comprador:</b>\n' +
        params.destinatarios
          .map(
            (d) =>
              `• ${escHtml(d.nombre.trim() || 'Comprador')} (<i>chat ${escHtml(String(d.chatId))}</i>)`,
          )
          .join('\n')
      : '<b>Para comprador:</b> <i>sin destinatario Telegram activo</i>';

  const lineasCabecera = [
    '<b>[Procura · orden de compra]</b>',
    `<b>Ticket:</b> ${escHtml(params.ticket.trim() || '—')}`,
    bloquePara,
    '<b>Supervisor (log):</b> puede reenviar la orden si el comprador no responde.',
  ];

  const texto = truncar(`${lineasCabecera.join('\n')}\n\n${params.mensaje}`, MAX_TEXTO_LOG);
  await sendLogBotMessage(logChat, texto, {
    parse_mode: 'HTML',
    reply_markup: tecladoCompradorSupervisorLog(params.procuraId.trim()),
  });
}

export function replicarOrdenCompraProcuraEnLogBotAsync(
  params: Parameters<typeof replicarOrdenCompraProcuraEnLogBot>[0],
): void {
  void replicarOrdenCompraProcuraEnLogBot(params).catch((e) => {
    console.warn('[supervisorLogBot] orden compra', e instanceof Error ? e.message : e);
  });
}

export async function replicarOrdenCompraProcuraDesdeFila(
  supabase: SupabaseClient,
  params: {
    procuraId: string;
    autorNombre: string;
    motivo?: string | null;
    cantidadCompra?: number | null;
    compradores: { nombre: string; telegram_id: number }[];
  },
): Promise<void> {
  const procura = await cargarProcuraOrdenCompra(supabase, params.procuraId);
  if (!procura) return;

  const mensaje = mensajeOrdenCompraComprador(procura, {
    autorNombre: params.autorNombre,
    motivo: params.motivo,
    cantidadCompra: params.cantidadCompra,
  });

  replicarOrdenCompraProcuraEnLogBotAsync({
    procuraId: params.procuraId,
    mensaje,
    ticket: String(procura.ticket ?? ''),
    destinatarios: params.compradores.map((c) => ({
      nombre: c.nombre,
      chatId: c.telegram_id,
    })),
  });
}
