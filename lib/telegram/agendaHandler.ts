import { ownerFromTelegramChat } from '@/lib/agenda/owner';
import { runAgendaChat } from '@/lib/agenda/runAgendaChat';
import { sendTelegramMessage } from '@/lib/telegram/botApi';
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
  const response = await runAgendaChat(
    owner,
    [{ role: 'user', text: trimmed }],
    { provider },
  );

  const providerLabel = response.provider === 'openai' ? 'OpenAI' : 'Gemini';
  await sendTelegramMessage(
    chatId,
    `${response.reply}\n\n<i>— Agenda · ${providerLabel}</i>`,
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
      '/ayuda — esta ayuda',
      '',
      'Ejemplos:',
      '• Guarda cita médica el próximo martes a las 10:00',
      '• ¿Qué cumpleaños tengo en agosto?',
      '• Recuérdame reunión con proveedor el 2026-07-20',
      '',
      'Proveedor IA: Gemini u OpenAI (configurable en servidor).',
    ].join('\n'),
    { parse_mode: 'HTML' },
  );
}
