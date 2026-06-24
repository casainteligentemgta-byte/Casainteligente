import type { SupabaseClient } from '@supabase/supabase-js';
import { CB_CMP_APROBAR, CB_CMP_RECHAZAR } from '@/lib/compras/aprobacionDepartamentoTelegram';
import { resolverProcuraDepartamento } from '@/lib/compras/registrarProcuraDepartamento';
import { esUuidProcura } from '@/lib/compras/telegramMetadata';
import {
  type AccionFundamentoSupervisor,
  type ContextoAuditoriaSupervisor,
  type FundamentoDisponibilidad,
  ORIGEN_SUPERVISOR_LOG,
  callbackFundamentoSupervisor,
  esCallbackFundamentoSupervisor,
  etiquetaFundamento,
  nombreActorSupervisorFormal,
  parseCallbackFundamentoSupervisor,
} from '@/lib/procuras/auditoriaSupervisorProcura';
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
import type { AlmacenStockEntidad } from '@/lib/procuras/disponibilidadMaterialProcura';
import { CB_CMP_VIAB_NO, CB_CMP_VIAB_SI } from '@/lib/procuras/viabilidadAdminProcuraTelegram';
import {
  answerLogBotCallbackQuery,
  editLogBotMessage,
  getTelegramLogChatId,
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

type ParamsCallbackSupervisor = {
  data: string;
  callbackId: string;
  chatId: string | number;
  messageId: number;
  textoOriginal: string;
  from?: { id?: number; first_name?: string; username?: string };
};

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

function contextoAuditoria(
  params: ParamsCallbackSupervisor,
  rolFacultado: ContextoAuditoriaSupervisor['rolFacultado'],
  accion: string,
  fundamento?: FundamentoDisponibilidad | null,
): ContextoAuditoriaSupervisor {
  return {
    actorNombre: nombreSupervisorDesdeCallback(params.from),
    actorTelegramId: params.from?.id ?? null,
    fundamento: fundamento ?? null,
    rolFacultado,
    accion,
  };
}

export function esCallbackSupervisorLogProcura(data: string): boolean {
  return (
    data.startsWith(CB_LOG_VIAB_SI) ||
    data.startsWith(CB_LOG_VIAB_NO) ||
    data.startsWith(CB_LOG_PM_APROBAR) ||
    data.startsWith(CB_LOG_PM_RECHAZAR) ||
    data.startsWith(CB_LOG_DEP_ABASTECER) ||
    data.startsWith(CB_LOG_COM_ORDEN) ||
    esCallbackFundamentoSupervisor(data)
  );
}

/** @deprecated usar esCallbackSupervisorLogProcura */
export function esCallbackViabilidadSupervisorLog(data: string): boolean {
  return data.startsWith(CB_LOG_VIAB_SI) || data.startsWith(CB_LOG_VIAB_NO);
}

export function tecladoFundamentoSupervisorLog(
  accion: AccionFundamentoSupervisor,
  procuraId: string,
) {
  return {
    inline_keyboard: [
      [
        {
          text: '💰 Financiera',
          callback_data: callbackFundamentoSupervisor(accion, 'financiero', procuraId),
        },
        {
          text: '📦 Física',
          callback_data: callbackFundamentoSupervisor(accion, 'fisico', procuraId),
        },
      ],
      [
        {
          text: '💰📦 Ambas',
          callback_data: callbackFundamentoSupervisor(accion, 'ambos', procuraId),
        },
      ],
    ],
  };
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
        { text: '🟢 Aprobar', callback_data: `${CB_LOG_PM_APROBAR}${procuraId}` },
        { text: '🔴 Rechazar', callback_data: `${CB_LOG_PM_RECHAZAR}${procuraId}` },
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

async function mostrarSubmenuFundamento(
  params: ParamsCallbackSupervisor,
  accion: AccionFundamentoSupervisor,
  procuraId: string,
  etiquetaAccion: string,
): Promise<void> {
  await answerLogBotCallbackQuery(params.callbackId, 'Seleccione fundamento…');
  await editLogBotMessage(
    params.chatId,
    params.messageId,
    `${params.textoOriginal}\n\n` +
      `🔎 <b>Auditoría formal — ${escHtml(etiquetaAccion)}</b>\n` +
      'Indique el <b>fundamento</b> de la disponibilidad confirmada:',
    {
      parse_mode: 'HTML',
      reply_markup: tecladoFundamentoSupervisorLog(accion, procuraId),
    },
  );
}

async function ejecutarViabilidadSupervisor(
  supabase: SupabaseClient,
  params: ParamsCallbackSupervisor,
  viabilidad: 'si' | 'no',
  procuraId: string,
  fundamento?: FundamentoDisponibilidad | null,
): Promise<void> {
  const supervisorNombre = nombreSupervisorDesdeCallback(params.from);

  const resultado = await informarViabilidadAdminProcura(supabase, {
    procuraId,
    viabilidad,
    adminNombre: supervisorNombre,
    adminTelegramId: params.from?.id ?? null,
    adminUsuarioId: params.from?.id != null ? String(params.from.id) : null,
    origen: ORIGEN_SUPERVISOR_LOG,
    informadoPorRol: 'supervisor',
    fundamento: viabilidad === 'si' ? fundamento : 'financiero',
  });

  const label =
    viabilidad === 'si'
      ? 'Hay disponibilidad presupuestaria (stock físico verificado en sistema)'
      : 'No hay disponibilidad (auditoría formal)';

  if (!resultado.ok) {
    await finalizarMensajeLogSupervisor({
      ...params,
      ok: false,
      detalle: resultado.error ?? 'Error',
    });
    return;
  }

  const pmNota =
    resultado.pmsNotificados && resultado.pmsNotificados > 0
      ? `${label}. PM notificado (${resultado.pmsNotificados}).`
      : `${label}. Sin PM Telegram para notificar.`;

  await finalizarMensajeLogSupervisor({ ...params, ok: true, detalle: pmNota });
}

async function manejarIntentoViabilidadSupervisor(
  supabase: SupabaseClient,
  params: ParamsCallbackSupervisor,
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

  if (viabilidad === 'no') {
    await answerLogBotCallbackQuery(params.callbackId, 'Registrando…');
    await ejecutarViabilidadSupervisor(supabase, params, 'no', procuraId, 'financiero');
    return true;
  }

  await answerLogBotCallbackQuery(params.callbackId, 'Registrando viabilidad…');
  await ejecutarViabilidadSupervisor(supabase, params, 'si', procuraId, 'financiero');
  return true;
}

async function manejarPmSupervisorIntento(
  supabase: SupabaseClient,
  params: ParamsCallbackSupervisor,
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

  if (!aprobar) {
    const supervisorNombre = nombreSupervisorDesdeCallback(params.from);
    const telegramId = params.from?.id ?? 0;
    await answerLogBotCallbackQuery(params.callbackId, 'Rechazando procura…');

    const auditoria = contextoAuditoria(params, 'pm', 'pm_rechazar');
    const resultado = await resolverProcuraDepartamento(supabase, {
      procuraId,
      accion: 'rechazar',
      aprobadorTelegramId: telegramId,
      aprobadorNombre: nombreActorSupervisorFormal(supervisorNombre),
      motivoRechazo: `Rechazada por supervisor (auditoría formal, canal log) — ${supervisorNombre}`,
      auditoriaSupervisor: auditoria,
    });

    if (!resultado.ok) {
      await finalizarMensajeLogSupervisor({
        ...params,
        ok: false,
        detalle: resultado.error ?? 'Error',
      });
      return true;
    }

    await finalizarMensajeLogSupervisor({ ...params, ok: true, detalle: 'Procura rechazada (auditoría formal).' });
    return true;
  }

  await answerLogBotCallbackQuery(params.callbackId, 'Aprobando procura…');
  await ejecutarPmAprobacionSupervisor(supabase, params, procuraId, 'financiero');
  return true;
}

async function ejecutarPmAprobacionSupervisor(
  supabase: SupabaseClient,
  params: ParamsCallbackSupervisor,
  procuraId: string,
  fundamento: FundamentoDisponibilidad,
): Promise<void> {
  const supervisorNombre = nombreSupervisorDesdeCallback(params.from);
  const telegramId = params.from?.id ?? 0;
  const auditoria = contextoAuditoria(params, 'pm', 'pm_aprobar', fundamento);

  const resultado = await resolverProcuraDepartamento(supabase, {
    procuraId,
    accion: 'aprobar',
    aprobadorTelegramId: telegramId,
    aprobadorNombre: nombreActorSupervisorFormal(supervisorNombre),
    auditoriaSupervisor: auditoria,
  });

  if (!resultado.ok) {
    await finalizarMensajeLogSupervisor({
      ...params,
      ok: false,
      detalle: resultado.error ?? 'Error',
    });
    return;
  }

  await finalizarMensajeLogSupervisor({
    ...params,
    ok: true,
    detalle: `Procura aprobada. ${resultado.estado ?? 'aprobada'}.`,
  });
}

async function manejarDepositarioSupervisorIntento(
  supabase: SupabaseClient,
  params: ParamsCallbackSupervisor,
): Promise<boolean> {
  const procuraId = extraerProcuraIdDesdeCallback(params.data, CB_LOG_DEP_ABASTECER);
  if (!procuraId) {
    await answerLogBotCallbackQuery(params.callbackId, 'Datos inválidos', true);
    return true;
  }

  await mostrarSubmenuFundamento(params, 'dep:abas', procuraId, 'verificación de almacén');
  return true;
}

async function ejecutarDepositarioSupervisor(
  supabase: SupabaseClient,
  params: ParamsCallbackSupervisor,
  procuraId: string,
  fundamento: FundamentoDisponibilidad,
): Promise<void> {
  const supervisorNombre = nombreSupervisorDesdeCallback(params.from);
  const auditoria = contextoAuditoria(params, 'depositario', 'depositario_abastecer', fundamento);

  const resultado = await confirmarAbastecimientoProcura(supabase, {
    procuraId,
    autorNombre: nombreActorSupervisorFormal(supervisorNombre),
    auditoriaSupervisor: auditoria,
  });

  if (!resultado.ok) {
    await finalizarMensajeLogSupervisor({
      ...params,
      ok: false,
      detalle: resultado.error ?? 'Error',
    });
    return;
  }

  await finalizarMensajeLogSupervisor({
    ...params,
    ok: true,
    detalle: `${etiquetaResultadoAbastecimiento(resultado)} (${etiquetaFundamento(fundamento)}).`,
  });
}

async function manejarCompradorSupervisorIntento(
  supabase: SupabaseClient,
  params: ParamsCallbackSupervisor,
): Promise<boolean> {
  const procuraId = extraerProcuraIdDesdeCallback(params.data, CB_LOG_COM_ORDEN);
  if (!procuraId) {
    await answerLogBotCallbackQuery(params.callbackId, 'Datos inválidos', true);
    return true;
  }

  await mostrarSubmenuFundamento(params, 'com:ord', procuraId, 'reenvío orden de compra');
  return true;
}

async function ejecutarCompradorSupervisor(
  supabase: SupabaseClient,
  params: ParamsCallbackSupervisor,
  procuraId: string,
  fundamento: FundamentoDisponibilidad,
): Promise<void> {
  const supervisorNombre = nombreSupervisorDesdeCallback(params.from);
  const auditoria = contextoAuditoria(params, 'comprador', 'comprador_orden', fundamento);

  const resultado = await emitirOrdenCompraProcura(supabase, {
    procuraId,
    autorNombre: nombreActorSupervisorFormal(supervisorNombre),
    motivo: 'Reenvío de orden por supervisor (auditoría formal, canal log)',
    auditoriaSupervisor: auditoria,
  });

  if (!resultado.ok) {
    await finalizarMensajeLogSupervisor({
      ...params,
      ok: false,
      detalle: resultado.error ?? 'Error',
    });
    return;
  }

  const notif = resultado.compradoresNotificados ?? 0;
  const detalle =
    notif > 0
      ? `Orden reenviada a ${notif} comprador(es) (${etiquetaFundamento(fundamento)}).`
      : `Orden registrada; sin compradores Telegram (${etiquetaFundamento(fundamento)}).`;
  await finalizarMensajeLogSupervisor({ ...params, ok: true, detalle });
}

async function manejarConfirmacionFundamentoSupervisor(
  supabase: SupabaseClient,
  params: ParamsCallbackSupervisor,
): Promise<boolean> {
  const parsed = parseCallbackFundamentoSupervisor(params.data);
  if (!parsed) {
    await answerLogBotCallbackQuery(params.callbackId, 'Datos inválidos', true);
    return true;
  }

  await answerLogBotCallbackQuery(params.callbackId, 'Registrando auditoría formal…');

  switch (parsed.accion) {
    case 'via:si':
      await ejecutarViabilidadSupervisor(
        supabase,
        params,
        'si',
        parsed.procuraId,
        parsed.fundamento,
      );
      break;
    case 'pm:apr':
      await ejecutarPmAprobacionSupervisor(supabase, params, parsed.procuraId, parsed.fundamento);
      break;
    case 'dep:abas':
      await ejecutarDepositarioSupervisor(supabase, params, parsed.procuraId, parsed.fundamento);
      break;
    case 'com:ord':
      await ejecutarCompradorSupervisor(supabase, params, parsed.procuraId, parsed.fundamento);
      break;
    default:
      await answerLogBotCallbackQuery(params.callbackId, 'Acción desconocida', true);
  }

  return true;
}

/**
 * Supervisor del flujo procura en el bot de logs.
 * Viabilidad y PM: un solo clic (sin submenú financiera/física; el stock se verifica en sistema).
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

  if (esCallbackFundamentoSupervisor(params.data)) {
    return manejarConfirmacionFundamentoSupervisor(supabase, params);
  }
  if (params.data.startsWith(CB_LOG_VIAB_SI) || params.data.startsWith(CB_LOG_VIAB_NO)) {
    return manejarIntentoViabilidadSupervisor(supabase, params);
  }
  if (params.data.startsWith(CB_LOG_PM_APROBAR) || params.data.startsWith(CB_LOG_PM_RECHAZAR)) {
    return manejarPmSupervisorIntento(supabase, params);
  }
  if (params.data.startsWith(CB_LOG_DEP_ABASTECER)) {
    return manejarDepositarioSupervisorIntento(supabase, params);
  }
  if (params.data.startsWith(CB_LOG_COM_ORDEN)) {
    return manejarCompradorSupervisorIntento(supabase, params);
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

/** Réplica orden de compra en log bot (implementación en espejoSalidaLogBot). */
export {
  replicarOrdenCompraProcuraEnLogBot,
  replicarOrdenCompraProcuraEnLogBotAsync,
} from '@/lib/telegram/espejoSalidaLogBot';

export async function replicarOrdenCompraProcuraDesdeFila(
  supabase: SupabaseClient,
  params: {
    procuraId: string;
    autorNombre: string;
    motivo?: string | null;
    cantidadCompra?: number | null;
    almacenesEntidad?: AlmacenStockEntidad[];
    compradores: { nombre: string; telegram_id: number }[];
  },
): Promise<void> {
  const { replicarOrdenCompraProcuraEnLogBot: replicar } = await import(
    '@/lib/telegram/espejoSalidaLogBot'
  );
  const procura = await cargarProcuraOrdenCompra(supabase, params.procuraId);
  if (!procura) return;

  const mensaje = mensajeOrdenCompraComprador(procura, {
    autorNombre: params.autorNombre,
    motivo: params.motivo,
    cantidadCompra: params.cantidadCompra,
    almacenesEntidad: params.almacenesEntidad,
  });

  await replicar({
    procuraId: params.procuraId,
    mensaje,
    ticket: String(procura.ticket ?? ''),
    destinatarios: params.compradores.map((c) => ({
      nombre: c.nombre,
      chatId: c.telegram_id,
    })),
    sinCompradorConfigurado: params.compradores.length === 0,
  });
}
