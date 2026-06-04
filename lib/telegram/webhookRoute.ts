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
import { manejarComandoStockConsultaTelegram } from '@/lib/telegram/stockConsultaTelegram';
import { telegramSupabaseAdmin } from '@/lib/telegram/supabaseAdmin';
import { manejarComandoAguaTelegram } from '@/lib/telegram/aguaRegistro';
import { manejarComandoIngresoFacturaTelegram } from '@/lib/telegram/ingresoFacturaTelegram';
import {
  manejarComandoIngresoManualTelegram,
  manejarComandoNotaEntregaTelegram,
  manejarComandoEmergenciaTelegram,
} from '@/lib/telegram/ingresoManualTelegram';
import { esComandoAgua, primerTokenComando } from '@/lib/telegram/parseComandoTelegram';
import {
  handleTelegramWebhookPost,
  handleTelegramCallbackQuery,
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
      ? 'Webhook Casa Inteligente (factura, obra, gasto, /agua, /stock inventario)'
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
  const callback = update.callback_query;

  if (callback) {
    const chatId = callback.message?.chat?.id
      ? String(callback.message.chat.id)
      : String(callback.from.id);
    if (!isChatAllowed(chatId)) {
      try {
        await sendTelegramMessage(chatId, '⛔ Chat no autorizado. Contacte al administrador.');
      } catch (err) {
        console.error('[telegram webhook] callback chat no autorizado', err);
      }
      return respuestaWebhook({ ok: true, denied: true });
    }
    return handleTelegramCallbackQuery(update);
  }

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
  const cmd = primerTokenComando(text);

  if (esComandoAgua(text)) {
    const admin = telegramSupabaseAdmin();
    if (!admin.ok) {
      try {
        await sendTelegramMessage(
          chatId,
          '⚠️ Servidor sin <b>SUPABASE_SERVICE_ROLE_KEY</b>. Contacte al administrador.',
          { parse_mode: 'HTML' },
        );
      } catch (err) {
        console.error('[telegram webhook] /agua sin supabase admin', err);
      }
      return respuestaWebhook({ ok: true, error: 'supabase_admin' });
    }
    try {
      await manejarComandoAguaTelegram(admin.client, chatId);
    } catch (err) {
      console.error('[telegram webhook] /agua', err);
      return respuestaWebhook({
        ok: true,
        error: err instanceof Error ? err.message : 'agua_command_failed',
      });
    }
    return respuestaWebhook({ ok: true, command: 'agua' });
  }

  if (
    cmd === '/nota' ||
    cmd === '/notaentrega' ||
    cmd === '/entrada' ||
    cmd === '/ingresonotas' ||
    cmd === '/ingresonota'
  ) {
    const admin = telegramSupabaseAdmin();
    if (!admin.ok) {
      try {
        await sendTelegramMessage(
          chatId,
          '⚠️ Servidor sin <b>SUPABASE_SERVICE_ROLE_KEY</b>. Contacte al administrador.',
          { parse_mode: 'HTML' },
        );
      } catch (err) {
        console.error('[telegram webhook] /nota sin supabase admin', err);
      }
      return respuestaWebhook({ ok: true, error: 'supabase_admin' });
    }
    try {
      await manejarComandoNotaEntregaTelegram(admin.client, chatId);
    } catch (err) {
      console.error('[telegram webhook] /nota', err);
      return respuestaWebhook({
        ok: true,
        error: err instanceof Error ? err.message : 'nota_entrega_command_failed',
      });
    }
    return respuestaWebhook({
      ok: true,
      command: cmd === '/ingresonotas' || cmd === '/ingresonota' ? 'ingresonotas' : 'nota_entrega',
    });
  }

  if (
    cmd === '/emergencia' ||
    cmd === '/urgente' ||
    cmd === '/ingresoemergencia' ||
    cmd === '/emergencias'
  ) {
    const admin = telegramSupabaseAdmin();
    if (!admin.ok) {
      try {
        await sendTelegramMessage(
          chatId,
          '⚠️ Servidor sin <b>SUPABASE_SERVICE_ROLE_KEY</b>. Contacte al administrador.',
          { parse_mode: 'HTML' },
        );
      } catch (err) {
        console.error('[telegram webhook] /emergencia sin supabase admin', err);
      }
      return respuestaWebhook({ ok: true, error: 'supabase_admin' });
    }
    try {
      await manejarComandoEmergenciaTelegram(admin.client, chatId);
    } catch (err) {
      console.error('[telegram webhook] /emergencia', err);
      return respuestaWebhook({
        ok: true,
        error: err instanceof Error ? err.message : 'emergencia_command_failed',
      });
    }
    return respuestaWebhook({
      ok: true,
      command:
        cmd === '/ingresoemergencia' || cmd === '/emergencias'
          ? 'ingresoemergencia'
          : 'emergencia',
    });
  }

  if (cmd === '/ingresomanual') {
    const admin = telegramSupabaseAdmin();
    if (!admin.ok) {
      try {
        await sendTelegramMessage(
          chatId,
          '⚠️ Servidor sin <b>SUPABASE_SERVICE_ROLE_KEY</b>. Contacte al administrador.',
          { parse_mode: 'HTML' },
        );
      } catch (err) {
        console.error('[telegram webhook] /ingresomanual sin supabase admin', err);
      }
      return respuestaWebhook({ ok: true, error: 'supabase_admin' });
    }
    try {
      await manejarComandoIngresoManualTelegram(admin.client, chatId);
    } catch (err) {
      console.error('[telegram webhook] /ingresomanual', err);
      return respuestaWebhook({
        ok: true,
        error: err instanceof Error ? err.message : 'ingreso_manual_command_failed',
      });
    }
    return respuestaWebhook({ ok: true, command: 'ingresomanual' });
  }

  if (cmd === '/ingresofactura' || cmd === '/ingresofacturas' || cmd === '/ingreso') {
    const admin = telegramSupabaseAdmin();
    if (!admin.ok) {
      try {
        await sendTelegramMessage(
          chatId,
          '⚠️ Servidor sin <b>SUPABASE_SERVICE_ROLE_KEY</b>. Contacte al administrador.',
          { parse_mode: 'HTML' },
        );
      } catch (err) {
        console.error('[telegram webhook] /ingresofactura sin supabase admin', err);
      }
      return respuestaWebhook({ ok: true, error: 'supabase_admin' });
    }
    try {
      await manejarComandoIngresoFacturaTelegram(admin.client, chatId);
    } catch (err) {
      console.error('[telegram webhook] /ingresofactura', err);
      return respuestaWebhook({
        ok: true,
        error: err instanceof Error ? err.message : 'ingreso_factura_command_failed',
      });
    }
    return respuestaWebhook({ ok: true, command: 'ingresofactura' });
  }

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
      if (!argumento) {
        await manejarComandoStockConsultaTelegram(admin.client, chatId);
      } else {
        await manejarComandoStockTelegram({ supabase: admin.client, chatId, keyword: argumento });
      }
    } catch (err) {
      console.error('[telegram webhook] /stock', err);
      return respuestaWebhook({
        ok: true,
        error: err instanceof Error ? err.message : 'stock_command_failed',
      });
    }
    return respuestaWebhook({ ok: true, command: argumento ? 'stock_busqueda' : 'stock_consulta' });
  }

  return handleTelegramWebhookPost(update);
}
