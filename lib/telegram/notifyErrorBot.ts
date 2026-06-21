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

/** Escapa caracteres reservados de HTML (modo Telegram). */
function escHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

/** Etiquetas de bloque bimonetario en alertas de compra confirmada. */
const ETIQUETAS_BIMONET_BOLD = /^(Moneda origen|Total Bs|Total USD|Tasa BCV):/;

function formatearCuerpoLogBot(mensaje: string): string {
  return mensaje
    .split('\n')
    .map((linea) => {
      const t = linea.trimEnd();
      if (!t) return '';
      const idx = t.indexOf(':');
      if (idx > 0 && ETIQUETAS_BIMONET_BOLD.test(t.slice(0, idx + 1))) {
        const etiqueta = t.slice(0, idx);
        const valor = t.slice(idx + 1).trimStart();
        return `<b>${escHtml(etiqueta)}:</b> ${escHtml(valor)}`;
      }
      return escHtml(t);
    })
    .join('\n');
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
  const prefijo = opts?.origen ? `<b>[${escHtml(opts.origen)}]</b>\n` : '';
  const text = `${prefijo}${formatearCuerpoLogBot(mensaje)}`;

  await sendLogBotMessage(chatId, text, {
    parse_mode: 'HTML',
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

/** Aviso al chat de logs cuando un comprador envía foto/PDF por /facturas. */
export async function notificarFacturaCanalRecibida(params: {
  pendingId: string;
  chatLabel?: string | null;
  canal?: string;
  reproceso?: boolean;
}): Promise<void> {
  const label = params.chatLabel?.trim() || '—';
  const canal = params.canal?.trim() || 'telegram';
  const prefijo = params.reproceso ? 'Factura reenviada (reproceso OCR)' : 'Factura cargada por comprador';
  await notifyErrorBot(
    `${prefijo}\n` + `ID: ${params.pendingId}\n` + `Usuario: ${label}\n` + `Canal: ${canal}`,
    { origen: 'Compras / Factura' },
  );
}

export function notificarFacturaCanalRecibidaAsync(params: {
  pendingId: string;
  chatLabel?: string | null;
  canal?: string;
  reproceso?: boolean;
}): void {
  void notificarFacturaCanalRecibida(params).catch((e) => {
    console.warn('[notificarFacturaCanalRecibida]', e instanceof Error ? e.message : e);
  });
}

/** OCR terminó: datos básicos para monitoreo en el chat de logs. */
export async function notificarFacturaCanalExtraida(params: {
  pendingId: string;
  chatLabel?: string | null;
  invoiceNumber?: string | null;
  supplierName?: string | null;
  supplierRif?: string | null;
}): Promise<void> {
  const label = params.chatLabel?.trim() || '—';
  await notifyErrorBot(
    `OCR completado — factura lista para confirmar\n` +
      `ID: ${params.pendingId}\n` +
      `Usuario: ${label}\n` +
      `Nº: ${params.invoiceNumber?.trim() || '—'}\n` +
      `Proveedor: ${params.supplierName?.trim() || '—'}\n` +
      `RIF: ${params.supplierRif?.trim() || '—'}`,
    { origen: 'Compras / Factura' },
  );
}

export function notificarFacturaCanalExtraidaAsync(params: {
  pendingId: string;
  chatLabel?: string | null;
  invoiceNumber?: string | null;
  supplierName?: string | null;
  supplierRif?: string | null;
}): void {
  void notificarFacturaCanalExtraida(params).catch((e) => {
    console.warn('[notificarFacturaCanalExtraida]', e instanceof Error ? e.message : e);
  });
}
