import {
  editTelegramMessage,
  sendTelegramMessageWithId,
} from '@/lib/telegram/botApi';
import { textoProgresoCargaAgua } from '@/lib/telegram/mensajesAgua';

/** Muestra barra de progreso mientras se recibe/guarda la foto del camión. */
export async function notificarCargaFotoCamionAgua(chatId: string): Promise<void> {
  const etapas: Array<{ pct: number; texto: string; pausaMs?: number }> = [
    { pct: 10, texto: 'Recibiendo foto del camión de agua…', pausaMs: 400 },
    { pct: 45, texto: 'Verificando imagen…', pausaMs: 500 },
    { pct: 75, texto: 'Guardando en el sistema…', pausaMs: 400 },
    { pct: 100, texto: 'Foto del camión cargada correctamente.', pausaMs: 300 },
  ];

  let messageId: number | null = null;
  for (const step of etapas) {
    const html = textoProgresoCargaAgua(step.pct, step.texto);
    if (messageId == null) {
      messageId = await sendTelegramMessageWithId(chatId, html, { parse_mode: 'HTML' });
    } else {
      await editTelegramMessage(chatId, messageId, html, { parse_mode: 'HTML' });
    }
    if (step.pausaMs) {
      await new Promise((r) => setTimeout(r, step.pausaMs));
    }
  }
}

/** Progreso durante subida final (camión + prueba + IA). */
export async function crearNotificadorProgresoRegistroAgua(chatId: string): Promise<{
  reportar: (pct: number, etapa: string) => Promise<void>;
  finalizar: (textoHtml: string) => Promise<void>;
  error: (texto: string) => Promise<void>;
}> {
  let messageId: number | null = null;

  async function reportar(pct: number, etapa: string): Promise<void> {
    const text = textoProgresoCargaAgua(pct, etapa);
    if (messageId == null) {
      messageId = await sendTelegramMessageWithId(chatId, text, { parse_mode: 'HTML' });
    } else {
      await editTelegramMessage(chatId, messageId, text, { parse_mode: 'HTML' });
    }
  }

  async function finalizar(textoHtml: string): Promise<void> {
    if (messageId != null) {
      await editTelegramMessage(chatId, messageId, textoHtml, { parse_mode: 'HTML' });
    } else {
      await sendTelegramMessageWithId(chatId, textoHtml, { parse_mode: 'HTML' });
    }
  }

  async function error(texto: string): Promise<void> {
    const html = `❌ ${texto}`;
    if (messageId != null) {
      await editTelegramMessage(chatId, messageId, html, { parse_mode: 'HTML' });
    } else {
      await sendTelegramMessageWithId(chatId, html, { parse_mode: 'HTML' });
    }
  }

  return { reportar, finalizar, error };
}
