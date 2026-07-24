import { getTelegramLogChatId, isLogBotConfigured, sendLogBotMessage } from '@/lib/telegram/logBotApi';
import {
  mapearTecladoOperativoASupervisorLog,
  tecladoCompradorSupervisorLog,
  tecladoPmSupervisorLog,
  tecladoViabilidadSupervisorLog,
} from '@/lib/procuras/supervisorLogBotProcura';
import {
  modoPruebasTelegramActivo,
  resolverEtiquetaRolDestinatario,
} from '@/lib/telegram/enrutamientoPruebasTelegram';
import {
  type AccionDestinatarioLog,
  pieDestinatarioLog,
  pieDestinatariosLog,
} from '@/lib/telegram/pieDestinatarioLog';

const MAX_TEXTO_LOG = 3800;

/** Réplica de salida al chat de logs (opt-out con TELEGRAM_LOG_ESPEJO_SALIDA=false). */
export function isLogEspejoSalidaActivo(): boolean {
  if (!isLogBotConfigured()) return false;
  const flag = process.env.TELEGRAM_LOG_ESPEJO_SALIDA?.trim().toLowerCase();
  return flag !== 'false' && flag !== '0';
}

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

function resumirTecladoInline(reply_markup?: unknown): string | null {
  if (!reply_markup || typeof reply_markup !== 'object') return null;
  const kb = reply_markup as { inline_keyboard?: { text?: string }[][] };
  if (!kb.inline_keyboard?.length) return null;
  const labels = kb.inline_keyboard
    .flat()
    .map((b) => b.text?.trim())
    .filter(Boolean) as string[];
  if (!labels.length) return null;
  return labels.slice(0, 8).join(' · ');
}

/** Copia al bot de logs cada mensaje enviado por el bot operativo a un chat/personaje. */
export async function espejarSalidaTelegramLog(params: {
  chatIdDestinoOriginal: string | number;
  textoEnviado: string;
  rolDestinatario?: string | null;
  nombreDestinatario?: string | null;
  accionLogDestinatario?: AccionDestinatarioLog;
  contextoLogEspejo?: string | null;
  /** El pie ya va en textoEnviado (bot operativo); no duplicar. */
  pieYaIncluido?: boolean;
  plain?: boolean;
  reply_markup?: unknown;
}): Promise<void> {
  if (!isLogEspejoSalidaActivo()) return;

  const logChat = getTelegramLogChatId();
  if (!logChat) return;

  const destinoOriginal = String(Math.trunc(Number(params.chatIdDestinoOriginal)));
  if (destinoOriginal === logChat.trim()) return;

  const lineasCabecera: string[] = [];
  const contexto = params.contextoLogEspejo?.trim();
  if (contexto) {
    lineasCabecera.push(`<b>${escHtml(contexto)}</b>`);
  }
  lineasCabecera.push(`<i>chat destino ${escHtml(destinoOriginal)}</i>`);
  if (modoPruebasTelegramActivo()) {
    lineasCabecera.push('<i>↪ redirigido en modo pruebas</i>');
  }

  const tecladoSupervisor = mapearTecladoOperativoASupervisorLog(params.reply_markup);
  if (tecladoSupervisor) {
    lineasCabecera.push(
      '<b>Supervisor (log):</b> puede actuar en nombre del destinatario.',
    );
  } else {
    const teclado = resumirTecladoInline(params.reply_markup);
    if (teclado) lineasCabecera.push(`🔘 ${escHtml(teclado)}`);
  }

  const cuerpo = params.plain ? escHtml(params.textoEnviado) : params.textoEnviado;
  let pie = '';
  if (!params.pieYaIncluido) {
    const rol =
      params.rolDestinatario?.trim() ||
      (await resolverEtiquetaRolDestinatario(params.chatIdDestinoOriginal));
    pie = pieDestinatarioLog({
      rol,
      nombre: params.nombreDestinatario,
      chatId: params.chatIdDestinoOriginal,
      accion: params.accionLogDestinatario,
    });
  }

  const prefijo = lineasCabecera.length ? `${lineasCabecera.join('\n')}\n\n` : '';
  const texto = truncar(`${prefijo}${cuerpo}${pie}`, MAX_TEXTO_LOG);

  await sendLogBotMessage(logChat, texto, {
    parse_mode: 'HTML',
    ...(tecladoSupervisor ? { reply_markup: tecladoSupervisor } : {}),
  });
}

export function espejarSalidaTelegramLogAsync(
  params: Parameters<typeof espejarSalidaTelegramLog>[0],
): void {
  void espejarSalidaTelegramLog(params).catch((e) => {
    console.warn('[espejoSalidaLogBot]', e instanceof Error ? e.message : e);
  });
}

/** Réplica dedicada: alerta de viabilidad procura → contador(es) + supervisor en log bot. */
export async function replicarAlertaProcuraAdminEnLogBot(params: {
  procuraId: string;
  mensaje: string;
  ticket: string;
  destinatarios: { nombre: string; chatId: number }[];
  /** Sin filas Contador/Administrador en ci_usuarios_sistema_telegram. */
  sinContadorConfigurado?: boolean;
}): Promise<void> {
  if (!isLogBotConfigured()) return;

  const logChat = getTelegramLogChatId();
  if (!logChat) return;

  const lineasCabecera = [
    '<b>[Procura · viabilidad presupuestaria]</b>',
    `<b>Ticket:</b> ${escHtml(params.ticket.trim() || '—')}`,
  ];

  let pie: string;
  if (params.sinContadorConfigurado) {
    pie = pieDestinatarioLog({
      rol: 'Contador (revisor de fondos)',
      accion: 'informar_viabilidad',
    });
    lineasCabecera.push('⚠️ <i>Sin contador Telegram configurado</i>');
  } else {
    pie = pieDestinatariosLog(
      params.destinatarios.map((d) => ({
        rol: 'Contador',
        nombre: d.nombre.trim() || 'Contador',
        chatId: d.chatId,
      })),
      'informar_viabilidad',
    );
  }

  const supervisor =
    '\n\n<b>Supervisor (log):</b> puede actuar en nombre del contador si no responde.';
  const texto = truncar(
    `${lineasCabecera.join('\n')}\n\n${params.mensaje}${pie}${supervisor}`,
    MAX_TEXTO_LOG,
  );
  const replyMarkup = tecladoViabilidadSupervisorLog(params.procuraId.trim());
  await sendLogBotMessage(logChat, texto, { parse_mode: 'HTML', reply_markup: replyMarkup });
}

export function replicarAlertaProcuraAdminEnLogBotAsync(
  params: Parameters<typeof replicarAlertaProcuraAdminEnLogBot>[0],
): void {
  void replicarAlertaProcuraAdminEnLogBot(params).catch((e) => {
    console.warn('[espejoSalidaLogBot] alerta admin procura', e instanceof Error ? e.message : e);
  });
}

/** Réplica dedicada: decisión PM tras viabilidad + supervisor en log bot. */
export async function replicarAlertaPmProcuraEnLogBot(params: {
  procuraId: string;
  mensaje: string;
  ticket: string;
  destinatarios: { nombre: string; chatId: number }[];
  sinPmConfigurado?: boolean;
}): Promise<void> {
  if (!isLogBotConfigured()) return;

  const logChat = getTelegramLogChatId();
  if (!logChat) return;

  const lineasCabecera = [
    '<b>[Procura · decisión PM]</b>',
    `<b>Ticket:</b> ${escHtml(params.ticket.trim() || '—')}`,
  ];

  let pie: string;
  if (params.sinPmConfigurado) {
    pie = pieDestinatarioLog({
      rol: 'Project Manager',
      accion: 'aprobar_rechazar',
    });
    lineasCabecera.push('⚠️ <i>Sin PM con Telegram activo</i>');
  } else {
    pie = pieDestinatariosLog(
      params.destinatarios.map((d) => ({
        rol: 'Project Manager',
        nombre: d.nombre.trim() || 'Project Manager',
        chatId: d.chatId,
      })),
      'aprobar_rechazar',
    );
  }

  const supervisor =
    '\n\n<b>Supervisor (log):</b> puede aprobar o rechazar en nombre del PM si no responde.';
  const texto = truncar(
    `${lineasCabecera.join('\n')}\n\n${params.mensaje}${pie}${supervisor}`,
    MAX_TEXTO_LOG,
  );
  const replyMarkup = tecladoPmSupervisorLog(params.procuraId.trim());
  await sendLogBotMessage(logChat, texto, { parse_mode: 'HTML', reply_markup: replyMarkup });
}

/** Réplica dedicada: orden de compra → comprador(es) + supervisor en log bot. */
export async function replicarOrdenCompraProcuraEnLogBot(params: {
  procuraId: string;
  mensaje: string;
  ticket: string;
  destinatarios: { nombre: string; chatId: number }[];
  sinCompradorConfigurado?: boolean;
}): Promise<void> {
  if (!isLogBotConfigured()) return;

  const logChat = getTelegramLogChatId();
  if (!logChat) return;

  const lineasCabecera = [
    '<b>[Procura · orden de compra]</b>',
    `<b>Ticket:</b> ${escHtml(params.ticket.trim() || '—')}`,
  ];

  let pie: string;
  if (params.sinCompradorConfigurado) {
    pie = pieDestinatarioLog({
      rol: 'Comprador',
      accion: 'ejecutar_compra',
    });
    lineasCabecera.push('⚠️ <i>Sin comprador Telegram activo</i>');
  } else {
    pie = pieDestinatariosLog(
      params.destinatarios.map((d) => ({
        rol: 'Comprador',
        nombre: d.nombre.trim() || 'Comprador',
        chatId: d.chatId,
      })),
      'ejecutar_compra',
    );
  }

  const supervisor =
    '\n\n<b>Supervisor (log):</b> auditoría formal — puede reenviar la orden si el comprador no responde.';
  const texto = truncar(
    `${lineasCabecera.join('\n')}\n\n${params.mensaje}${pie}${supervisor}`,
    MAX_TEXTO_LOG,
  );
  await sendLogBotMessage(logChat, texto, {
    parse_mode: 'HTML',
    reply_markup: tecladoCompradorSupervisorLog(params.procuraId.trim()),
  });
}

export function replicarOrdenCompraProcuraEnLogBotAsync(
  params: Parameters<typeof replicarOrdenCompraProcuraEnLogBot>[0],
): void {
  void replicarOrdenCompraProcuraEnLogBot(params).catch((e) => {
    console.warn('[espejoSalidaLogBot] orden compra', e instanceof Error ? e.message : e);
  });
}
