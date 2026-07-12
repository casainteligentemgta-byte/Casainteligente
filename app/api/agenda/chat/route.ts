import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createClient } from '@/lib/supabase/server';
import { runAgendaChat, type AgendaChatMessage } from '@/lib/gemini/agendaChat';

export async function POST(req: NextRequest) {
  let body: {
    messages?: AgendaChatMessage[];
    model?: string;
    userId?: string;
  };

  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: 'JSON inválido' }, { status: 400 });
  }

  const messages = Array.isArray(body.messages) ? body.messages : [];
  const validMessages = messages.filter(
    (message): message is AgendaChatMessage =>
      (message.role === 'user' || message.role === 'model') &&
      typeof message.text === 'string' &&
      message.text.trim().length > 0,
  );

  if (!validMessages.length || validMessages[validMessages.length - 1].role !== 'user') {
    return NextResponse.json(
      { error: 'Se requiere al menos un mensaje del usuario como último turno.' },
      { status: 400 },
    );
  }

  const cookieStore = cookies();
  const supabase = createClient(cookieStore);
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const userId = user?.id ?? body.userId?.trim();
  if (!userId) {
    return NextResponse.json(
      { error: 'Se requiere un usuario autenticado o userId en el cuerpo de la petición.' },
      { status: 401 },
    );
  }

  try {
    const response = await runAgendaChat(userId, validMessages, body.model);
    return NextResponse.json(response);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Error al procesar la agenda.';
    const status = message.includes('GEMINI_API_KEY') || message.includes('SUPABASE_') ? 500 : 502;
    console.error('[api/agenda/chat]', err);
    return NextResponse.json({ error: message }, { status });
  }
}
