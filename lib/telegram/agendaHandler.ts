import { ownerFromTelegramChat } from '@/lib/agenda/owner';
import { runAgendaChat } from '@/lib/agenda/runAgendaChat';
import { sendTelegramMessage } from '@/lib/telegram/botApi';
import {
  clearTelegramAgendaHistory,
  getTelegramHistoryLimit,
  loadTelegramAgendaHistory,
  saveTelegramAgendaHistory,
} from '@/lib/telegram/agendaSession';
import type { LlmProvider } from '@/types/agenda';

export async function manejarAgendaTelegram(
  chatId: string | number,
  texto: string,
  provider?: LlmProvider,
): Promise<void> {
  const trimmed = texto.trim();
  if (!trimmed) {
    await sendTelegramMessage(
      chatId,
      '📅 Escribe algo como:\n• "Guarda el cumpleaños de Ana el 2026-08-15"\n• "¿Qué cumpleaños hay en agosto?"',
    );
    return;
  }

  const owner = ownerFromTelegramChat(chatId);
  const history = await loadTelegramAgendaHistory(chatId);
  const messages = [...history, { role: 'user' as const, text: trimmed }];

  const response = await runAgendaChat(owner, messages, { provider });

  await saveTelegramAgendaHistory(
    chatId,
    [...messages, { role: 'assistant', text: response.reply }],
    response.provider,
  );

  const providerLabel = response.provider === 'openai' ? 'OpenAI' : 'Gemini';
  const historyNote =
    history.length > 0
      ? `\n<i>Contexto: ${Math.min(history.length + 2, getTelegramHistoryLimit())} mensajes</i>`
      : '';

  await sendTelegramMessage(
    chatId,
    `${response.reply}\n\n<i>— Agenda · ${providerLabel}</i>${historyNote}`,
    { parse_mode: 'HTML' },
  );
}

export async function limpiarHistorialAgendaTelegram(chatId: string | number): Promise<void> {
  await clearTelegramAgendaHistory(chatId);
  await sendTelegramMessage(
    chatId,
    '🧹 <b>Historial borrado.</b>\nEmpezamos conversación nueva. ¿Qué quieres guardar o consultar?',
    { parse_mode: 'HTML' },
  );
}

export async function enviarAyudaAgendaTelegram(chatId: string | number): Promise<void> {
  await sendTelegramMessage(
    chatId,
    [
      '📅 <b>Agenda Casa Inteligente</b>',
      '',
      'Comandos:',
      '/agenda — activar modo agenda',
      '/limpiar — borrar historial y empezar de cero',
      '/ayuda — esta ayuda',
      '',
      'Ejemplos:',
      '• Guarda cita médica el próximo martes a las 10:00',
      '• ¿Qué cumpleaños tengo en agosto?',
      '• Recuérdame reunión con proveedor el 2026-07-20',
      '',
      `El bot recuerda hasta ${getTelegramHistoryLimit()} mensajes recientes.`,
      'Proveedor IA: Gemini u OpenAI (configurable en servidor).',
    ].join('\n'),
    { parse_mode: 'HTML' },
  );
}
