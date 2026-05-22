import { NextResponse } from 'next/server';
import {
  getTelegramBotToken,
  isChatAllowed,
  sendTelegramMessage,
} from '@/lib/telegram/botApi';
import { procesarComandoTelegram } from '@/lib/telegram/commands';
import {
  etiquetaContexto,
  getTelegramEstado,
  setTelegramContexto,
  type TelegramContexto,
} from '@/lib/telegram/estados';
import { interpretarTextoTelegramGemini } from '@/lib/telegram/geminiIntent';
import {
  manejarFacturaTelegram,
  manejarFotoObraTelegram,
  manejarGastoObraTelegram,
} from '@/lib/telegram/mediaHandlers';
import { telegramSupabaseAdmin } from '@/lib/telegram/supabaseAdmin';

export type TelegramUpdate = {
  message?: {
    message_id: number;
    text?: string;
    chat: { id: number; type: string; username?: string; first_name?: string };
    photo?: Array<{ file_id: string; file_size?: number }>;
    document?: {
      file_id: string;
      mime_type?: string;
      file_name?: string;
    };
    caption?: string;
  };
};

function chatLabel(msg: NonNullable<TelegramUpdate['message']>): string {
  return msg.chat.username ?? msg.chat.first_name ?? `chat_${msg.chat.id}`;
}

function resolveFileId(msg: NonNullable<TelegramUpdate['message']>): string | null {
  if (msg.photo?.length) {
    return msg.photo[msg.photo.length - 1].file_id;
  }
  const doc = msg.document;
  if (
    doc &&
    (doc.mime_type?.startsWith('image/') || doc.mime_type === 'application/pdf')
  ) {
    return doc.file_id;
  }
  return null;
}

async function mensajeEstado(chatId: string, contexto: TelegramContexto, proyectoId: string | null) {
  const proy = proyectoId ? `\nProyecto: <code>${proyectoId}</code>` : '';
  await sendTelegramMessage(
    chatId,
    `📌 Contexto: <b>${etiquetaContexto(contexto)}</b>${proy}`,
    { parse_mode: 'HTML' },
  );
}

async function aplicarComando(
  supabase: ReturnType<typeof telegramSupabaseAdmin>,
  chatId: string,
  cmd: ReturnType<typeof procesarComandoTelegram>,
): Promise<void> {
  if (cmd.mensaje === '__ESTADO__') {
    const est = await getTelegramEstado(supabase, chatId);
    await mensajeEstado(chatId, est.contexto, est.proyecto_id);
    return;
  }

  if (cmd.contexto || cmd.resetProyecto) {
    await setTelegramContexto(supabase, chatId, {
      ...(cmd.contexto ? { contexto: cmd.contexto } : {}),
      ...(cmd.resetProyecto ? { proyecto_id: null, pending_factura_id: null } : {}),
      ...(cmd.proyectoId !== undefined ? { proyecto_id: cmd.proyectoId } : {}),
    });
  }

  if (cmd.mensaje) {
    await sendTelegramMessage(chatId, cmd.mensaje, { parse_mode: 'HTML' });
  }
}

export function handleTelegramWebhookGet() {
  return NextResponse.json({
    ok: true,
    bot: Boolean(getTelegramBotToken()),
    hint: 'Webhook multi-contexto Casa Inteligente (factura, obra, gasto)',
    path: '/api/telegram',
  });
}

export async function handleTelegramWebhookPost(req: Request) {
  try {
    if (!getTelegramBotToken()) {
      return NextResponse.json({ error: 'TELEGRAM_BOT_TOKEN no configurado' }, { status: 503 });
    }

    const update = (await req.json()) as TelegramUpdate;
    const msg = update.message;
    if (!msg) {
      return NextResponse.json({ ok: true, skipped: 'no_message' });
    }

    const chatId = String(msg.chat.id);
    if (!isChatAllowed(chatId)) {
      await sendTelegramMessage(
        chatId,
        '⛔ Chat no autorizado. Contacte al administrador.',
      );
      return NextResponse.json({ ok: true, denied: true });
    }

    const supabase = telegramSupabaseAdmin();
    const label = chatLabel(msg);
    const texto = msg.text?.trim() ?? '';

    if (texto) {
      const cmd = procesarComandoTelegram(texto);
      if (cmd.handled) {
        await aplicarComando(supabase, chatId, cmd);
        return NextResponse.json({ ok: true, command: true });
      }

      const estado = await getTelegramEstado(supabase, chatId);
      const intent = await interpretarTextoTelegramGemini(texto, estado.contexto);
      if (intent?.contexto) {
        await setTelegramContexto(supabase, chatId, {
          contexto: intent.contexto,
          ...(intent.proyecto_id !== undefined ? { proyecto_id: intent.proyecto_id } : {}),
        });
        const reply =
          intent.reply ??
          `Modo <b>${etiquetaContexto(intent.contexto)}</b> activado (Gemini).`;
        await sendTelegramMessage(chatId, reply, { parse_mode: 'HTML' });
        return NextResponse.json({ ok: true, gemini_intent: intent.contexto });
      }
    }

    const fileId = resolveFileId(msg);
    if (!fileId) {
      const estado = await getTelegramEstado(supabase, chatId);
      await sendTelegramMessage(
        chatId,
        `📌 Estás en: <b>${etiquetaContexto(estado.contexto)}</b>\n` +
          'Envía foto/PDF o usa /ayuda.',
        { parse_mode: 'HTML' },
      );
      return NextResponse.json({ ok: true, hint: 'no_media' });
    }

    const estado = await getTelegramEstado(supabase, chatId);
    const caption = msg.caption?.trim();

    switch (estado.contexto) {
      case 'factura':
        await manejarFacturaTelegram({
          supabase,
          chatId,
          chatLabel: label,
          fileId,
        });
        break;
      case 'obra':
        await manejarFotoObraTelegram({
          supabase,
          chatId,
          estado,
          fileId,
          caption,
        });
        break;
      case 'gasto_obra':
        await manejarGastoObraTelegram({
          supabase,
          chatId,
          estado,
          fileId,
          caption,
        });
        break;
      default:
        await sendTelegramMessage(
          chatId,
          'Elige un modo antes de enviar archivos:\n/factura · /obra &lt;uuid&gt; · /gasto',
          { parse_mode: 'HTML' },
        );
    }

    return NextResponse.json({ ok: true, contexto: estado.contexto });
  } catch (err: unknown) {
    console.error('[telegram webhook]', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Error webhook' },
      { status: 500 },
    );
  }
}
