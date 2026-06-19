import { NextResponse } from 'next/server';
import { liberarFacturaCanalDesdeLogBot } from '@/lib/telegram/liberarFacturaCanalLogBot';
import {
  answerLogBotCallbackQuery,
  editLogBotMessage,
  getTelegramLogChatId,
  isLogBotConfigured,
} from '@/lib/telegram/logBotApi';
import { telegramSupabaseAdmin } from '@/lib/telegram/supabaseAdmin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 30;

type TelegramCallbackQuery = {
  id: string;
  from?: { id?: number; first_name?: string; username?: string };
  message?: {
    message_id?: number;
    chat?: { id?: number | string };
    text?: string;
  };
  data?: string;
};

type TelegramUpdate = {
  update_id?: number;
  callback_query?: TelegramCallbackQuery;
};

function formatFechaHoraVe(): string {
  return new Intl.DateTimeFormat('es-VE', {
    dateStyle: 'short',
    timeStyle: 'medium',
    timeZone: 'America/Caracas',
  }).format(new Date());
}

function escMarkdown(s: string): string {
  return s.replace(/([_*[`\\])/g, '\\$1');
}

async function handleLiberarFactura(params: {
  pendingId: string;
  callbackId: string;
  chatId: string | number;
  messageId: number;
  textoOriginal: string;
}): Promise<void> {
  await answerLogBotCallbackQuery(params.callbackId, 'Destrabando…');

  const admin = telegramSupabaseAdmin();
  if (!admin.ok) {
    await answerLogBotCallbackQuery(params.callbackId, 'Supabase no configurado', true);
    return;
  }

  const result = await liberarFacturaCanalDesdeLogBot(admin.client, params.pendingId);
  const stamp = formatFechaHoraVe();

  if (!result.ok) {
    await editLogBotMessage(
      params.chatId,
      params.messageId,
      `${escMarkdown(params.textoOriginal)}\n\n` +
        `❌ *\\[${escMarkdown(stamp)}\\]* No se pudo destrabar: ${escMarkdown(result.reason)}`,
      { parse_mode: 'Markdown' },
    );
    return;
  }

  await editLogBotMessage(
    params.chatId,
    params.messageId,
    `${escMarkdown(params.textoOriginal)}\n\n` +
      `✅ *\\[${escMarkdown(stamp)}\\]* Operación Ejecutada: Factura destrabada\\.`,
    { parse_mode: 'Markdown' },
  );
}

/**
 * Webhook aislado del bot de logs/infraestructura.
 * Solo procesa callback_query de botones inline (no comandos de texto).
 */
export async function POST(req: Request) {
  if (!isLogBotConfigured()) {
    return NextResponse.json({ ok: false, error: 'Log bot no configurado' }, { status: 503 });
  }

  let update: TelegramUpdate;
  try {
    update = (await req.json()) as TelegramUpdate;
  } catch {
    return NextResponse.json({ ok: false, error: 'JSON inválido' }, { status: 400 });
  }

  const cq = update.callback_query;
  if (!cq?.id || !cq.data) {
    return NextResponse.json({ ok: true, ignored: true });
  }

  const allowedChatId = getTelegramLogChatId()!;
  const chatId = cq.message?.chat?.id;
  const messageId = cq.message?.message_id;

  if (chatId == null || String(chatId) !== allowedChatId) {
    await answerLogBotCallbackQuery(cq.id, 'Chat no autorizado', true);
    return NextResponse.json({ ok: false, error: 'forbidden' }, { status: 403 });
  }

  if (messageId == null) {
    await answerLogBotCallbackQuery(cq.id, 'Mensaje no encontrado', true);
    return NextResponse.json({ ok: true });
  }

  const textoOriginal = cq.message?.text ?? 'Alerta Casa Inteligente';

  if (cq.data.startsWith('liberar_factura:')) {
    const pendingId = cq.data.slice('liberar_factura:'.length).trim();
    if (!pendingId) {
      await answerLogBotCallbackQuery(cq.id, 'ID inválido', true);
      return NextResponse.json({ ok: true });
    }

    await handleLiberarFactura({
      pendingId,
      callbackId: cq.id,
      chatId,
      messageId,
      textoOriginal,
    });
    return NextResponse.json({ ok: true, action: 'liberar_factura', pendingId });
  }

  await answerLogBotCallbackQuery(cq.id, 'Acción desconocida', true);
  return NextResponse.json({ ok: true, ignored: true });
}

export async function GET() {
  return NextResponse.json({
    ok: true,
    service: 'webhook-logs',
    configured: isLogBotConfigured(),
  });
}
