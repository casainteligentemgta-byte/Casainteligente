import { NextRequest, NextResponse } from 'next/server';
import {
  ownerFromAppSession,
  ownerFromTelegramChat,
  ownerFromUserId,
} from '@/lib/agenda/owner';
import { runAgendaChat } from '@/lib/agenda/runAgendaChat';
import { createClient } from '@/lib/supabase/server';
import type { AgendaChatMessage, LlmProvider } from '@/types/agenda';

export async function POST(req: NextRequest) {
  let body: {
    messages?: AgendaChatMessage[];
    model?: string;
    provider?: LlmProvider;
    userId?: string;
    sessionId?: string;
    telegramChatId?: string;
  };

  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: 'JSON inválido' }, { status: 400 });
  }

  const messages = Array.isArray(body.messages) ? body.messages : [];
  const validMessages = messages.filter(
    (message): message is AgendaChatMessage =>
      (message.role === 'user' || message.role === 'assistant') &&
      typeof message.text === 'string' &&
      message.text.trim().length > 0,
  );

  if (!validMessages.length || validMessages[validMessages.length - 1].role !== 'user') {
    return NextResponse.json(
      { error: 'Se requiere al menos un mensaje del usuario como último turno.' },
      { status: 400 },
    );
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const owner =
    (user?.id ? ownerFromUserId(user.id) : null) ??
    (body.userId?.trim() ? ownerFromUserId(body.userId) : null) ??
    (body.telegramChatId?.trim() ? ownerFromTelegramChat(body.telegramChatId) : null) ??
    (body.sessionId?.trim() ? ownerFromAppSession(body.sessionId) : null);

  if (!owner) {
    return NextResponse.json(
      { error: 'Se requiere usuario autenticado, userId, sessionId o telegramChatId.' },
      { status: 401 },
    );
  }

  try {
    const response = await runAgendaChat(owner, validMessages, {
      provider: body.provider,
      model: body.model,
    });
    return NextResponse.json(response);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Error al procesar la agenda.';
    const status =
      message.includes('API_KEY') || message.includes('SUPABASE_') ? 500 : 502;
    console.error('[api/agenda/chat]', err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
