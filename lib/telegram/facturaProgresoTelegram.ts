import {
  editTelegramMessage,
  sendTelegramMessageWithId,
} from '@/lib/telegram/botApi';

function barraProgreso(pct: number): string {
  const total = 10;
  const filled = Math.max(0, Math.min(total, Math.round((pct / 100) * total)));
  return `${'█'.repeat(filled)}${'░'.repeat(total - filled)}`;
}

function textoProgreso(pct: number, etapa: string): string {
  const p = Math.max(0, Math.min(100, Math.round(pct)));
  return (
    `⏳ <b>Analizando factura… ${p}%</b>\n` +
    `<code>${barraProgreso(p)}</code>\n` +
    `<i>${etapa}</i>`
  );
}

export type NotificadorProgresoFacturaTelegram = {
  reportar: (pct: number, etapa: string) => Promise<void>;
  ok: (detalleHtml: string) => Promise<void>;
  bad: (detalle: string) => Promise<void>;
};

/**
 * Mensaje único en Telegram que se actualiza con % y termina en OK o Bad.
 */
export function crearNotificadorProgresoFacturaTelegram(
  chatId: string,
): NotificadorProgresoFacturaTelegram {
  let messageId: number | null = null;
  let fase: 'cargando' | 'barra' = 'cargando';

  async function reportar(pct: number, etapa: string): Promise<void> {
    const text =
      fase === 'cargando'
        ? '⏳ Cargando…'
        : textoProgreso(pct, etapa);
    if (fase === 'cargando') {
      fase = 'barra';
    }
    if (messageId == null) {
      messageId = await sendTelegramMessageWithId(chatId, text, {
        parse_mode: 'HTML',
      });
      return;
    }
    await editTelegramMessage(chatId, messageId, text, { parse_mode: 'HTML' });
  }

  async function ok(_detalleHtml: string): Promise<void> {
    const text =
      `✅ <b>Análisis completado</b>\n` +
      `<code>${barraProgreso(100)}</code>\n` +
      `<i>Indique moneda (Bs o USD), forma de pago y almacén…</i>`;
    if (messageId != null) {
      await editTelegramMessage(chatId, messageId, text, { parse_mode: 'HTML' });
    } else {
      await sendTelegramMessageWithId(chatId, text, { parse_mode: 'HTML' });
    }
  }

  async function bad(detalleHtml: string): Promise<void> {
    const text = `❌ <b>Bad</b> — No pude analizar la factura.\n\n${detalleHtml}`;
    if (messageId != null) {
      await editTelegramMessage(chatId, messageId, text, { parse_mode: 'HTML' });
    } else {
      await sendTelegramMessageWithId(chatId, text, { parse_mode: 'HTML' });
    }
  }

  return { reportar, ok, bad };
}

/** Avance simulado mientras corre una tarea larga (p. ej. Gemini). */
export async function conProgresoSimulado(
  desde: number,
  hasta: number,
  reportar: (pct: number, etapa: string) => Promise<void>,
  etapa: string,
  trabajo: () => Promise<void>,
): Promise<void> {
  let pct = desde;
  const intervaloMs = 2500;
  const paso = Math.max(2, Math.floor((hasta - desde - 4) / 4));

  const timer = setInterval(() => {
    pct = Math.min(hasta - 4, pct + paso);
    void reportar(pct, etapa).catch(() => {});
  }, intervaloMs);

  try {
    await reportar(desde, etapa);
    await trabajo();
  } finally {
    clearInterval(timer);
    await reportar(hasta, etapa);
  }
}
