import { getTelegramLogChatId, isLogBotConfigured, sendLogBotMessage } from '@/lib/telegram/logBotApi';
import {
  mapearTecladoOperativoASupervisorLog,
  tecladoViabilidadSupervisorLog,
} from '@/lib/procuras/supervisorLogBotProcura';
import {
  modoPruebasTelegramActivo,
  resolverEtiquetaRolDestinatario,
} from '@/lib/telegram/enrutamientoPruebasTelegram';

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
  plain?: boolean;
  reply_markup?: unknown;
}): Promise<void> {
  if (!isLogEspejoSalidaActivo()) return;

  const logChat = getTelegramLogChatId();
  if (!logChat) return;

  const destinoOriginal = String(Math.trunc(Number(params.chatIdDestinoOriginal)));
  if (destinoOriginal === logChat.trim()) return;

  const actor =
    params.rolDestinatario?.trim() ||
    (await resolverEtiquetaRolDestinatario(params.chatIdDestinoOriginal));

  const lineasCabecera = [
    `📤 <b>Para: ${escHtml(actor)}</b>`,
    `<i>chat ${escHtml(destinoOriginal)}</i>`,
  ];
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
  const texto = truncar(`${lineasCabecera.join('\n')}\n\n${cuerpo}`, MAX_TEXTO_LOG);

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

  let bloquePara: string;
  if (params.sinContadorConfigurado) {
    bloquePara =
      '⚠️ <i>Sin contador Telegram configurado</i>\n' +
      '<b>Para:</b> Contador (revisor de fondos)';
  } else if (params.destinatarios.length > 0) {
    bloquePara =
      '<b>Para contador:</b>\n' +
      params.destinatarios
        .map(
          (d) =>
            `• ${escHtml(d.nombre.trim() || 'Contador')} (<i>chat ${escHtml(String(d.chatId))}</i>)`,
        )
        .join('\n');
  } else {
    bloquePara = '<b>Para contador:</b> <i>sin destinatario disponible</i>';
  }

  const lineasCabecera = [
    '<b>[Procura · viabilidad presupuestaria]</b>',
    `<b>Ticket:</b> ${escHtml(params.ticket.trim() || '—')}`,
    bloquePara,
    '<b>Supervisor (log):</b> puede actuar en nombre del contador si no responde.',
  ];

  const texto = truncar(`${lineasCabecera.join('\n')}\n\n${params.mensaje}`, MAX_TEXTO_LOG);
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
