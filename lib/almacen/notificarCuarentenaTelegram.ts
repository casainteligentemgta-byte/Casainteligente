import { getTelegramBotToken, sendTelegramMessage } from '@/lib/telegram/botApi';

export type NotificarCuarentenaParams = {
  invoiceNumber: string;
  supplierName: string;
  lineCount: number;
  proyectoNombre?: string | null;
  ubicacionNombre?: string | null;
  baseUrl?: string;
  /** Si se omite, usa TELEGRAM_ALMACEN_CHAT_IDS / fallback env. */
  chatIds?: string[];
};

export type NotificarCuarentenaResult = {
  ok: boolean;
  skipped?: boolean;
  enviados?: number;
  destinatarios?: string[];
};

/** Chats del depositario / almacén (TELEGRAM_ALMACEN_CHAT_IDS o fallback a ALLOWED / CHAT_ID). */
export function getTelegramAlmacenChatIds(): string[] {
  const almacen = process.env.TELEGRAM_ALMACEN_CHAT_IDS?.trim();
  if (almacen) {
    return almacen
      .split(/[,;\s]+/)
      .map((s) => s.trim())
      .filter(Boolean);
  }

  const allowed = process.env.TELEGRAM_ALLOWED_CHAT_IDS?.trim();
  if (allowed) {
    return allowed
      .split(/[,;\s]+/)
      .map((s) => s.trim())
      .filter(Boolean);
  }

  const single = process.env.TELEGRAM_CHAT_ID?.trim();
  return single ? [single] : [];
}

export async function notificarNuevaCuarentenaTelegram(
  params: NotificarCuarentenaParams,
): Promise<NotificarCuarentenaResult> {
  if (!getTelegramBotToken()) {
    return { ok: false, skipped: true };
  }

  const chatIds = params.chatIds?.length ? params.chatIds : getTelegramAlmacenChatIds();
  if (!chatIds.length) {
    return { ok: false, skipped: true };
  }

  const base =
    params.baseUrl?.replace(/\/$/, '') ||
    process.env.NEXT_PUBLIC_BASE_URL?.replace(/\/$/, '') ||
    'https://casainteligente.company';

  const url = `${base}/almacen/procurement/quality`;
  const proyecto = params.proyectoNombre?.trim();
  const ubicacion = params.ubicacionNombre?.trim();

  const lineasExtra = [
    proyecto ? `Obra: <b>${escapeHtml(proyecto)}</b>` : null,
    ubicacion ? `Almacén: <b>${escapeHtml(ubicacion)}</b>` : null,
  ]
    .filter(Boolean)
    .join('\n');

  const text =
    `📦 <b>Nueva mercancía en cuarentena</b>\n\n` +
    `Factura <b>${escapeHtml(params.invoiceNumber)}</b>\n` +
    `Proveedor: ${escapeHtml(params.supplierName)}\n` +
    `${params.lineCount} línea(s) pendientes de inspección\n` +
    (lineasExtra ? `${lineasExtra}\n` : '') +
    `\n<a href="${url}">Abrir cuarentena</a>`;

  let enviados = 0;
  for (const chatId of chatIds) {
    try {
      await sendTelegramMessage(chatId, text);
      enviados += 1;
    } catch (err) {
      console.warn('[cuarentena-telegram]', chatId, err);
    }
  }

  return { ok: enviados > 0, enviados, destinatarios: chatIds };
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}
