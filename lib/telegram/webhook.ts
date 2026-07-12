import { NextResponse } from 'next/server';
import {
  getTelegramBotToken,
  isChatAllowed,
  sendTelegramMessage,
  verifyTelegramWebhookSecret,
} from '@/lib/telegram/botApi';
import { enviarAyudaAgendaTelegram, manejarAgendaTelegram } from '@/lib/telegram/agendaHandler';

type TelegramUpdate = {
  message?: {
    message_id: number;
    chat: { id: number; type: string; title?: string; username?: string };
    from?: { id: number; first_name?: string; username?: string };
    text?: string;
  };
};

export function handleTelegramWebhookGet() {
  const configured = Boolean(getTelegramBotToken());
  return NextResponse.json({
    ok: true,
    service: 'casa-inteligente-telegram',
    agenda: true,
    botConfigured: configured,
  });
}

export async function handleTelegramWebhookPost(req: Request) {
  if (!verifyTelegramWebhookSecret(req)) {
    return NextResponse.json({ error: 'Webhook no autorizado' }, { status: 401 });
  }

  if (!getTelegramBotToken()) {
    return NextResponse.json({ error: 'TELEGRAM_BOT_TOKEN no configurado' }, { status: 500 });
  }

  let update: TelegramUpdate;
  try {
    update = (await req.json()) as TelegramUpdate;
  } catch {
    return NextResponse.json({ error: 'JSON inválido' }, { status: 400 });
  }

  const msg = update.message;
  if (!msg?.text?.trim()) {
    return NextResponse.json({ ok: true, skipped: 'no_text' });
  }

  const chatId = msg.chat.id;
  if (!isChatAllowed(chatId)) {
    return NextResponse.json({ ok: true, skipped: 'chat_not_allowed' });
  }

  const text = msg.text.trim();
  const lower = text.toLowerCase();

  try {
    if (lower === '/start' || lower === '/ayuda' || lower === '/help') {
      await enviarAyudaAgendaTelegram(chatId);
      return NextResponse.json({ ok: true, command: 'ayuda' });
    }

    if (lower === '/agenda') {
      await sendTelegramMessage(
        chatId,
        '📅 <b>Modo agenda activo.</b>\nEscribe lo que quieras guardar o consultar.',
        { parse_mode: 'HTML' },
      );
      return NextResponse.json({ ok: true, command: 'agenda' });
    }

    if (lower.startsWith('/')) {
      await sendTelegramMessage(
        chatId,
        'Comando no reconocido. Usa /agenda o /ayuda.',
      );
      return NextResponse.json({ ok: true, command: 'unknown' });
    }

    await manejarAgendaTelegram(chatId, text);
    return NextResponse.json({ ok: true, handled: 'agenda_message' });
  } catch (err) {
    console.error('[telegram webhook]', err);
    const message = err instanceof Error ? err.message : 'Error interno';
    await sendTelegramMessage(chatId, `⚠️ No pude procesar tu mensaje: ${message}`);
    return NextResponse.json({ ok: true, error: message });
  }
}
