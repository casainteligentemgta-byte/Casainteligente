import { getTelegramLogChatId, isLogBotConfigured, sendLogBotMessage } from '@/lib/telegram/logBotApi';

export type InlineKeyboardButton = {
  text: string;
  callback_data: string;
};

export type InlineKeyboardMarkup = {
  inline_keyboard: InlineKeyboardButton[][];
};

export function botonLiberarFactura(pendingFacturaId: string): InlineKeyboardMarkup {
  return {
    inline_keyboard: [
      [{ text: '🔓 Destrabar Factura', callback_data: `liberar_factura:${pendingFacturaId}` }],
    ],
  };
}

export type NotifyErrorBotOptions = {
  reply_markup?: InlineKeyboardMarkup;
  /** Etiqueta corta del origen (ej. OCR, webhook). */
  origen?: string;
};

/** Escapa caracteres reservados de Markdown (modo legacy de Telegram). */
function escMarkdown(s: string): string {
  return s.replace(/([_*[`\\])/g, '\\$1');
}

/**
 * Envía alerta al bot de logs/infraestructura (token y chat aislados del bot operativo).
 */
export async function notifyErrorBot(
  mensaje: string,
  opts?: NotifyErrorBotOptions,
): Promise<boolean> {
  if (!isLogBotConfigured()) {
    console.warn('[notifyErrorBot] TELEGRAM_LOG_BOT_TOKEN o TELEGRAM_LOG_CHAT_ID no configurados');
    return false;
  }

  const chatId = getTelegramLogChatId()!;
  const prefijo = opts?.origen ? `*\\[${escMarkdown(opts.origen)}\\]*\n` : '';
  const text = `${prefijo}${escMarkdown(mensaje)}`;

  await sendLogBotMessage(chatId, text, {
    parse_mode: 'Markdown',
    reply_markup: opts?.reply_markup,
  });
  return true;
}

/** Fire-and-forget: no bloquea el flujo principal del bot operativo. */
export function notifyErrorBotAsync(mensaje: string, opts?: NotifyErrorBotOptions): void {
  void notifyErrorBot(mensaje, opts).catch((e) => {
    console.warn('[notifyErrorBot]', e instanceof Error ? e.message : e);
  });
}

export async function notificarFacturaCanalAtascada(params: {
  pendingId: string;
  detalle: string;
  chatLabel?: string | null;
}): Promise<void> {
  const label = params.chatLabel?.trim() || '—';
  await notifyErrorBot(
    `Factura canal atascada\n` +
      `ID: ${params.pendingId}\n` +
      `Usuario: ${label}\n` +
      `${params.detalle}`,
    {
      origen: 'OCR / Canal',
      reply_markup: botonLiberarFactura(params.pendingId),
    },
  );
}

export function notificarFacturaCanalAtascadaAsync(params: {
  pendingId: string;
  detalle: string;
  chatLabel?: string | null;
}): void {
  void notificarFacturaCanalAtascada(params).catch((e) => {
    console.warn('[notificarFacturaCanalAtascada]', e instanceof Error ? e.message : e);
  });
}
