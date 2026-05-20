import { createClient } from '@supabase/supabase-js';
import {
  getTelegramBotToken,
  isChatAllowed,
  sendTelegramMessage,
} from '@/lib/telegram/botApi';
import { processTelegramInvoicePhoto } from '@/lib/telegram/processInvoiceFromTelegram';
import { NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 180;

function supabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const key =
    process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();
  if (!url || !key) throw new Error('Supabase no configurado');
  return createClient(url, key);
}

type TelegramUpdate = {
  message?: {
    message_id: number;
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

/** GET: verificación opcional (Telegram no la exige para bots normales). */
export async function GET() {
  return NextResponse.json({
    ok: true,
    bot: Boolean(getTelegramBotToken()),
    hint: 'POST webhook para recibir fotos de facturas',
  });
}

export async function POST(req: Request) {
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
        '⛔ Este chat no está autorizado para enviar facturas. Contacte al administrador.',
      );
      return NextResponse.json({ ok: true, denied: true });
    }

    let fileId: string | null = null;
    if (msg.photo?.length) {
      const best = msg.photo[msg.photo.length - 1];
      fileId = best.file_id;
    } else if (msg.document?.mime_type?.startsWith('image/') || msg.document?.mime_type === 'application/pdf') {
      fileId = msg.document.file_id;
    }

    if (!fileId) {
      await sendTelegramMessage(
        chatId,
        '📷 Envíe una <b>foto</b> o <b>PDF</b> de la factura de compra.\n\nSe analizará con IA y quedará pendiente de confirmación en la web.',
        { parse_mode: 'HTML' },
      );
      return NextResponse.json({ ok: true, hint: 'send_photo' });
    }

    const chatLabel =
      msg.chat.username ??
      msg.chat.first_name ??
      `chat_${chatId}`;

    const supabase = supabaseAdmin();
    const { data: pending, error: insErr } = await supabase
      .from('ci_facturas_canal_pendientes')
      .insert({
        canal: 'telegram',
        chat_id: chatId,
        chat_label: chatLabel,
        estado: 'pendiente',
      })
      .select('id')
      .single();

    if (insErr || !pending) {
      console.error('[telegram webhook] insert', insErr);
      await sendTelegramMessage(chatId, '❌ Error interno al registrar la factura.');
      return NextResponse.json({ error: insErr?.message }, { status: 500 });
    }

    await sendTelegramMessage(chatId, '⏳ Procesando factura con IA…');

    await processTelegramInvoicePhoto({
      pendingId: pending.id,
      chatId,
      fileId,
      chatLabel,
    });

    return NextResponse.json({ ok: true, pendingId: pending.id });
  } catch (err: unknown) {
    console.error('[POST /api/webhooks/telegram]', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Error webhook' },
      { status: 500 },
    );
  }
}
