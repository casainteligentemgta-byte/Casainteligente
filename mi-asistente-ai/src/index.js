import 'dotenv/config';
import { Markup, Telegraf } from 'telegraf';
import { env } from './config/env.js';
import { explicarOEjecutar, noteAboutFile } from './services/ai.js';
import {
  buscarArchivos,
  getProvider,
  providerStatus,
  setProvider,
  uploadFile,
} from './services/storage/index.js';

const bot = new Telegraf(env.telegramToken());

/** @type {Map<number, Array<{ role: string, parts: Array<{ text: string }> }>>} */
const memoriaContexto = new Map();

function isAllowed(chatId) {
  const allowed = env.allowedChatIds();
  if (!allowed) return true;
  return allowed.has(String(chatId));
}

function getHistory(chatId) {
  if (!memoriaContexto.has(chatId)) memoriaContexto.set(chatId, []);
  return memoriaContexto.get(chatId);
}

function trimHistory(chatHistory) {
  while (chatHistory.length > 20) chatHistory.shift();
}

async function replySafe(ctx, text) {
  try {
    await ctx.replyWithMarkdown(text, { disable_web_page_preview: false });
  } catch {
    await ctx.reply(String(text).replace(/[*_`\[\]]/g, ''), {
      disable_web_page_preview: false,
    });
  }
}

bot.use(async (ctx, next) => {
  const chatId = ctx.chat?.id;
  if (chatId != null && !isAllowed(chatId)) {
    await ctx.reply('Chat no autorizado para este asistente.');
    return;
  }
  return next();
});

bot.start((ctx) =>
  ctx.reply(
    '¡Hola! Soy tu asistente personal. Puedo redactar textos por ti o buscar archivos en tus carpetas configuradas. ¿En qué te ayudo hoy?',
  ),
);

bot.command('ayuda', (ctx) =>
  ctx.reply(
    [
      'Comandos:',
      '/start — bienvenida',
      '/ayuda — esta ayuda',
      '/reset — borra historial',
      '/storage — Drive / OneDrive / iCloud',
      '/buscar <nombre> — buscar archivos',
      '',
      'También puedes escribir en texto libre (redactar o buscar).',
    ].join('\n'),
  ),
);

bot.command('reset', (ctx) => {
  memoriaContexto.delete(ctx.chat.id);
  return ctx.reply('Historial borrado.');
});

bot.command('buscar', async (ctx) => {
  const query = (ctx.message.text || '').replace(/^\/buscar(@\w+)?\s*/i, '').trim();
  if (!query) {
    await ctx.reply('Uso: /buscar nombre_del_archivo');
    return;
  }
  await ctx.sendChatAction('typing');
  const files = await buscarArchivos(query);
  if (!files.length) {
    await ctx.reply(`Sin resultados para: ${query}`);
    return;
  }
  const lines = files.map((f, i) => {
    const tag = f.provider ? `[${f.provider}] ` : '';
    if (f.webViewLink) return `${i + 1}. ${tag}[${f.name}](${f.webViewLink})`;
    return `${i + 1}. ${tag}${f.name}`;
  });
  await replySafe(ctx, `*Búsqueda* — ${query}\n\n${lines.join('\n')}`);
});

bot.command('storage', async (ctx) => {
  const current = getProvider(ctx.chat.id);
  const rows = providerStatus().map((p) => [
    Markup.button.callback(`${p.ok ? '✅' : '⚪'} ${p.label}`, `storage:${p.id}`),
  ]);
  await ctx.reply(`Proveedor actual: ${current}\nElige uno:`, Markup.inlineKeyboard(rows));
});

bot.action(/^storage:(drive|onedrive|icloud)$/, async (ctx) => {
  const id = ctx.match[1];
  setProvider(ctx.chat.id, id);
  const status = providerStatus().find((p) => p.id === id);
  await ctx.answerCbQuery(`Proveedor: ${status?.label || id}`);
  await ctx.reply(
    `Almacenamiento: ${status?.label || id}${status?.ok ? ' — listo.' : ' — faltan variables en .env.'}`,
  );
});

bot.on('text', async (ctx) => {
  const userMessage = ctx.message.text?.trim();
  if (!userMessage || userMessage.startsWith('/')) return;

  const chatId = ctx.chat.id;
  await ctx.sendChatAction('typing');

  const chatHistory = getHistory(chatId);

  try {
    const resultado = await explicarOEjecutar(chatHistory, userMessage);

    chatHistory.push({ role: 'user', parts: [{ text: userMessage }] });
    chatHistory.push({ role: 'model', parts: [{ text: resultado.text }] });
    trimHistory(chatHistory);

    await replySafe(ctx, resultado.text);
  } catch (error) {
    console.error('Error al procesar el mensaje:', error);
    await ctx.reply('Lo siento, ocurrió un error al procesar tu solicitud.');
  }
});

bot.on(['photo', 'document'], async (ctx) => {
  try {
    await ctx.sendChatAction('upload_document');
    const fileId =
      ctx.message.document?.file_id ||
      ctx.message.photo?.[ctx.message.photo.length - 1]?.file_id;
    if (!fileId) {
      await ctx.reply('No encontré el archivo.');
      return;
    }

    const link = await ctx.telegram.getFileLink(fileId);
    const res = await fetch(link.href);
    if (!res.ok) throw new Error(`Descarga Telegram falló (${res.status})`);
    const buffer = Buffer.from(await res.arrayBuffer());

    const fileName =
      ctx.message.document?.file_name || `foto_${ctx.message.message_id}.jpg`;
    const mimeType =
      ctx.message.document?.mime_type ||
      (ctx.message.photo ? 'image/jpeg' : 'application/octet-stream');
    const caption = ctx.message.caption?.trim() || '';

    const uploaded = await uploadFile({
      chatId: ctx.chat.id,
      fileName,
      buffer,
      mimeType,
    });

    let msg = `Archivo en *${uploaded.provider}*: *${uploaded.name}*`;
    if (uploaded.url) msg += `\n${uploaded.url}`;

    try {
      const note = await noteAboutFile({ fileName, mimeType, hint: caption || undefined });
      if (note) msg += `\n\n${note}`;
    } catch (e) {
      console.warn('[ai note]', e);
    }

    await replySafe(ctx, msg);
  } catch (err) {
    console.error('[upload]', err);
    await ctx.reply(`Error al guardar: ${err instanceof Error ? err.message : String(err)}`);
  }
});

async function main() {
  const domain = env.webhookDomain();
  if (domain) {
    const path = env.webhookPath();
    const port = env.port();
    await bot.launch({
      webhook: {
        domain,
        port,
        hookPath: path,
      },
    });
    console.log(`Asistente AI webhook en https://${domain}${path} (puerto ${port})`);
  } else {
    await bot.launch();
    console.log('🚀 Asistente AI en Telegram en marcha...');
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));
