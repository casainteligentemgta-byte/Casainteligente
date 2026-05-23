import { NextResponse } from 'next/server';
import {
  getTelegramBotToken,
  isChatAllowed,
  sendTelegramMessage,
} from '@/lib/telegram/botApi';
import {
  extraerArgumentoStock,
  manejarComandoStockTelegram,
} from '@/lib/telegram/stockCommand';
import { telegramSupabaseAdmin } from '@/lib/telegram/supabaseAdmin';
import {
  handleTelegramWebhookPost,
  type TelegramUpdate,
} from '@/lib/telegram/webhook';

/** Telegram exige HTTP 200; un 503/502 hace que marque el webhook como fallido. */
function respuestaWebhook(body: Record<string, unknown>, status = 200) {
  return NextResponse.json(body, { status });
}

export function handleTelegramWebhookGet() {
  const token = getTelegramBotToken();
  const serviceRole = Boolean(
    process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() ||
      process.env.SUPABASE_SECRET_KEY?.trim() ||
      process.env.SUPABASE_SERVICE_KEY?.trim(),
  );
  return respuestaWebhook({
    ok: true,
    bot: Boolean(token),
    supabaseServiceRole: serviceRole,
    hint: token
      ? 'Webhook Casa Inteligente (factura, obra, gasto, /stock inventario)'
      : 'Configure TELEGRAM_BOT_TOKEN en Vercel (Production) y redeploy.',
    path: '/api/webhooks/telegram',
  });
}

export async function handleTelegramWebhookRoutePost(req: Request) {
  if (!getTelegramBotToken()) {
    console.error('[telegram webhook] TELEGRAM_BOT_TOKEN no configurado en el servidor');
    return respuestaWebhook({
      ok: true,
      error: 'TELEGRAM_BOT_TOKEN',
      hint: 'Añada TELEGRAM_BOT_TOKEN en Vercel → Environment Variables (Production) y redeploy.',
    });
  }

  let update: TelegramUpdate;
  try {
    update = (await req.json()) as TelegramUpdate;
  } catch {
    return respuestaWebhook({ ok: true, skipped: 'invalid_json' });
  }

  const msg = update.message;
  if (!msg) {
    return respuestaWebhook({ ok: true, skipped: 'no_message' });
  }

  const chatId = String(msg.chat.id);
  if (!isChatAllowed(chatId)) {
    try {
      await sendTelegramMessage(
        chatId,
        '⛔ Chat no autorizado. Contacte al administrador.',
      );
    } catch (err) {
      console.error('[telegram webhook] chat no autorizado, sendMessage falló', err);
    }
    return respuestaWebhook({ ok: true, denied: true });
  }

  const text = msg.text?.trim() ?? '';
  if (text.toLowerCase().startsWith('/stock')) {
    const argumento = extraerArgumentoStock(text);
    const admin = telegramSupabaseAdmin();
    if (!admin.ok) {
      try {
        await sendTelegramMessage(
          chatId,
          '⚠️ Servidor sin <b>SUPABASE_SERVICE_ROLE_KEY</b>. Contacte al administrador.',
          { parse_mode: 'HTML' },
        );
      } catch (err) {
        console.error('[telegram webhook] /stock sin supabase admin', err);
      }
      return respuestaWebhook({ ok: true, error: 'supabase_admin' });
    }
    try {
      await manejarComandoStockTelegram({ supabase: admin.client, chatId, keyword: argumento });
    } catch (err) {
      console.error('[telegram webhook] /stock', err);
      return respuestaWebhook({
        ok: true,
        error: err instanceof Error ? err.message : 'stock_command_failed',
      });
    }
    return respuestaWebhook({ ok: true, command: 'stock' });
  }

  return handleTelegramWebhookPost(update);
}
