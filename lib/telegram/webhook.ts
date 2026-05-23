import { NextResponse } from 'next/server';
import type { SupabaseClient } from '@supabase/supabase-js';
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
import { manejarVozBitacoraTelegram } from '@/lib/telegram/bitacoraVoice';
import { mensajeModoFacturasActivado } from '@/lib/telegram/mensajesFactura';
import { telegramSupabaseAdmin } from '@/lib/telegram/supabaseAdmin';

const CMD_FACTURAS = /^\/facturas?(@\S+)?\s*$/i;

export type TelegramUpdate = {
  message?: {
    message_id: number;
    text?: string;
    chat: { id: number; type: string; username?: string; first_name?: string };
    photo?: Array<{ file_id: string; file_size?: number }>;
    voice?: {
      file_id: string;
      duration?: number;
      mime_type?: string;
    };
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
  supabase: SupabaseClient,
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

async function avisoErrorTelegram(chatId: string, err: unknown): Promise<void> {
  const detalle =
    err instanceof Error ? err.message.slice(0, 300) : 'Error interno del servidor';
  try {
    await sendTelegramMessage(
      chatId,
      `❌ <b>Error del bot</b>\n<code>${detalle.replace(/&/g, '&amp;').replace(/</g, '&lt;')}</code>`,
      { parse_mode: 'HTML' },
    );
  } catch {
    /* sin token o red */
  }
}

/** /facturas y /factura: responde siempre por Telegram aunque falle Supabase. */
async function manejarComandoFacturasDirecto(chatId: string): Promise<{
  ok: boolean;
  warn?: string;
}> {
  await sendTelegramMessage(chatId, mensajeModoFacturasActivado(), {
    parse_mode: 'HTML',
  });

  const admin = telegramSupabaseAdmin();
  if (!admin.ok) {
    await sendTelegramMessage(
      chatId,
      '⚠️ El servidor no tiene <b>SUPABASE_SERVICE_ROLE_KEY</b> (Vercel → Variables de entorno). ' +
        'La factura por foto puede fallar hasta configurarlo.',
      { parse_mode: 'HTML' },
    );
    return { ok: true, warn: 'supabase_config' };
  }

  try {
    await setTelegramContexto(admin.client, chatId, { contexto: 'factura' });
  } catch (err) {
    console.error('[telegram /facturas estado]', err);
    await sendTelegramMessage(
      chatId,
      '⚠️ Recibí el comando pero no pude guardar el estado en BD. ' +
        'Ejecuta <code>npm run db:apply-lulo-telegram</code> o revisa Supabase.',
      { parse_mode: 'HTML' },
    );
    return { ok: true, warn: 'estado_db' };
  }

  return { ok: true };
}

export async function handleTelegramWebhookPost(reqOrUpdate: Request | TelegramUpdate) {
  let chatIdParaError: string | null = null;

  try {
    if (!getTelegramBotToken()) {
      console.error('[telegram] TELEGRAM_BOT_TOKEN no configurado en el servidor');
      return NextResponse.json({ ok: true, error: 'TELEGRAM_BOT_TOKEN' });
    }

    const update =
      reqOrUpdate instanceof Request
        ? ((await reqOrUpdate.json()) as TelegramUpdate)
        : reqOrUpdate;
    const msg = update.message;
    if (!msg) {
      return NextResponse.json({ ok: true, skipped: 'no_message' });
    }

    const chatId = String(msg.chat.id);
    chatIdParaError = chatId;

    if (!isChatAllowed(chatId)) {
      await sendTelegramMessage(
        chatId,
        '⛔ Chat no autorizado. Contacte al administrador.',
      );
      return NextResponse.json({ ok: true, denied: true });
    }

    const label = chatLabel(msg);
    const texto = msg.text?.trim() ?? '';

    if (texto && CMD_FACTURAS.test(texto)) {
      const r = await manejarComandoFacturasDirecto(chatId);
      return NextResponse.json({ ok: true, command: 'facturas', warn: r.warn });
    }

    const admin = telegramSupabaseAdmin();
    if (!admin.ok) {
      await sendTelegramMessage(
        chatId,
        '⚠️ Servidor sin credenciales Supabase (service role). Contacte al administrador.',
        { parse_mode: 'HTML' },
      );
      return NextResponse.json({ ok: true, error: 'supabase_admin' });
    }

    const supabase = admin.client;

    if (texto) {
      const cmd = procesarComandoTelegram(texto);
      if (cmd.handled) {
        try {
          await aplicarComando(supabase, chatId, cmd);
        } catch (err) {
          console.error('[telegram comando]', err);
          await avisoErrorTelegram(chatId, err);
        }
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

    if (msg.voice?.file_id) {
      const estado = await getTelegramEstado(supabase, chatId);
      if (estado.contexto === 'esperando_audio_bitacora') {
        await manejarVozBitacoraTelegram({
          supabase,
          chatId,
          estado,
          fileId: msg.voice.file_id,
          durationSec: msg.voice.duration,
        });
        return NextResponse.json({ ok: true, bitacora_voz: true });
      }
      await sendTelegramMessage(
        chatId,
        '🎙️ Para registrar una bitácora por voz, primero usa <code>/bitacora</code> ' +
          '(con proyecto vinculado vía <code>/obra &lt;uuid&gt;</code>).',
        { parse_mode: 'HTML' },
      );
      return NextResponse.json({ ok: true, hint: 'voice_wrong_context' });
    }

    const fileId = resolveFileId(msg);
    if (!fileId) {
      const estado = await getTelegramEstado(supabase, chatId);
      await sendTelegramMessage(
        chatId,
        `📌 Estás en: <b>${etiquetaContexto(estado.contexto)}</b>\n` +
          (estado.contexto === 'esperando_audio_bitacora'
            ? 'Envía una <b>nota de voz</b> con el reporte de campo.'
            : 'Envía foto/PDF, nota de voz (/bitacora) o usa /ayuda.'),
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
    if (chatIdParaError) {
      await avisoErrorTelegram(chatIdParaError, err);
    }
    return NextResponse.json({
      ok: true,
      error: err instanceof Error ? err.message : 'Error webhook',
    });
  }
}
