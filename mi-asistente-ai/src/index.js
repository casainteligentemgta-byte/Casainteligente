import 'dotenv/config';
import { Markup, Telegraf } from 'telegraf';
import { env } from './config/env.js';
import { analizarImagen, explicarOEjecutar, noteAboutFile, transcribirAudio } from './services/ai.js';
import {
  buscarArchivos,
  getProvider,
  providerStatus,
  setProvider,
  uploadFile,
} from './services/storage/index.js';
import { getObraChat, setObraChat } from './services/obraMemoria.js';
import {
  isCasaDatosConfigured,
  listarObras,
  buscarObraPorNombre,
  resumenObra,
} from './services/casaDatos.js';

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

/** @param {{ text: string, ics?: { fileName: string, buffer: Buffer, mimeType: string } }} resultado */
async function replyResultado(ctx, resultado) {
  await replySafe(ctx, resultado.text);
  if (resultado.ics?.buffer) {
    try {
      await ctx.replyWithDocument({
        source: resultado.ics.buffer,
        filename: resultado.ics.fileName,
      });
    } catch (e) {
      console.warn('[ics send]', e);
      await ctx.reply('La cita se creó, pero no pude adjuntar el .ics. Revisa la carpeta Agenda en iCloud.');
    }
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
  ctx.reply('¡Hola! Soy tu asistente personal. ¿En qué te ayudo hoy?'),
);

bot.command('ayuda', (ctx) =>
  ctx.reply(
    [
      'Comandos:',
      '/start — bienvenida',
      '/ayuda — esta ayuda',
      '/reset — borra historial',
      '/obras — lista obras de Casa Inteligente',
      '/obra <nombre> — fija obra activa',
      '/resumen — resumen de compras de la obra activa',
      '',
      'Agenda: escribe “agenda mañana 10am reunión con proveedor” (te manda .ics para iPhone)',
      '/storage — Drive / OneDrive / iCloud',
      '/buscar <nombre> — buscar archivos',
      '',
      'También: texto libre, nota de voz, foto (la analiza) o archivo para guardar en la nube.',
    ].join('\n'),
  ),
);

bot.command('reset', (ctx) => {
  memoriaContexto.delete(ctx.chat.id);
  return ctx.reply('Historial borrado.');
});

bot.command('obras', async (ctx) => {
  if (!isCasaDatosConfigured()) {
    await ctx.reply('Supabase no configurado en el asistente.');
    return;
  }
  await ctx.sendChatAction('typing');
  const filtro = (ctx.message.text || '').replace(/^\/obras(@\w+)?\s*/i, '').trim();
  const r = await listarObras(filtro);
  if (!r.ok) {
    await ctx.reply(`Error: ${r.error}`);
    return;
  }
  if (!r.obras.length) {
    await ctx.reply('No hay obras.');
    return;
  }
  const lines = r.obras
    .slice(0, 25)
    .map((o, i) => `${i + 1}. ${o.nombre}${o.codigo ? ` (${o.codigo})` : ''}`);
  const activa = getObraChat(ctx.chat.id);
  const head = activa ? `Obra activa: *${activa.nombre}*\n\n` : '';
  await replySafe(ctx, `${head}*Obras*\n${lines.join('\n')}\n\nUsa /obra nombre para fijar una.`);
});

bot.command('obra', async (ctx) => {
  const nombre = (ctx.message.text || '').replace(/^\/obra(@\w+)?\s*/i, '').trim();
  if (!nombre) {
    const activa = getObraChat(ctx.chat.id);
    await ctx.reply(
      activa
        ? `Obra activa: ${activa.nombre}\nUso: /obra nombre_de_obra`
        : 'Uso: /obra nombre_de_obra',
    );
    return;
  }
  if (!isCasaDatosConfigured()) {
    await ctx.reply('Supabase no configurado.');
    return;
  }
  await ctx.sendChatAction('typing');
  const r = await buscarObraPorNombre(nombre);
  if (!r.ok) {
    await ctx.reply(r.error);
    return;
  }
  setObraChat(ctx.chat.id, r.obra);
  await replySafe(ctx, `Obra activa: *${r.obra.nombre}*`);
});

bot.command('resumen', async (ctx) => {
  const activa = getObraChat(ctx.chat.id);
  if (!activa) {
    await ctx.reply('Primero fija una obra con /obra nombre o /obras');
    return;
  }
  if (!isCasaDatosConfigured()) {
    await ctx.reply('Supabase no configurado.');
    return;
  }
  await ctx.sendChatAction('typing');
  const r = await resumenObra(activa.id);
  if (!r.ok) {
    await ctx.reply(`Error: ${r.error}`);
    return;
  }
  const lineas = (r.ultimas || [])
    .slice(0, 8)
    .map((u) => `- ${u.fecha || '—'} · ${u.proveedor || '—'} · $${Number(u.usd).toFixed(2)}`)
    .join('\n');
  await replySafe(
    ctx,
    [
      `*${r.obra.nombre}*`,
      `Compras: ${r.compras_registradas}`,
      `Muestra (últimas ${r.muestra_ultimas}): USD ${r.suma_muestra_usd}`,
      lineas || 'Sin compras.',
    ].join('\n'),
  );
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
  const chatId = ctx.chat.id;
  const userMessage = ctx.message.text?.trim();
  if (!userMessage || userMessage.startsWith('/')) return;

  await ctx.sendChatAction('typing');

  const chatHistory = getHistory(chatId);

  try {
    const resultado = await explicarOEjecutar(chatHistory, userMessage, {
      chatId: ctx.chat.id,
    });

    chatHistory.push({ role: 'user', parts: [{ text: userMessage }] });
    chatHistory.push({ role: 'model', parts: [{ text: resultado.text }] });
    trimHistory(chatHistory);

    await replyResultado(ctx, resultado);
  } catch (error) {
    console.error('Error al procesar el mensaje:', error);
    await ctx.reply('Ocurrió un error al procesar tu solicitud.');
  }
});

bot.on(['voice', 'audio'], async (ctx) => {
  try {
    await ctx.sendChatAction('typing');
    const voice = ctx.message.voice || ctx.message.audio;
    const fileId = voice?.file_id;
    if (!fileId) {
      await ctx.reply('No encontré el audio.');
      return;
    }

    const link = await ctx.telegram.getFileLink(fileId);
    const res = await fetch(link.href);
    if (!res.ok) throw new Error(`Descarga Telegram falló (${res.status})`);
    const buffer = Buffer.from(await res.arrayBuffer());
    const mimeType = voice?.mime_type || 'audio/ogg';

    const transcript = await transcribirAudio(buffer, mimeType);
    if (!transcript || transcript === '(no se entendió)') {
      await ctx.reply('No pude entender la nota de voz. Prueba de nuevo o escribe el mensaje.');
      return;
    }

    const chatId = ctx.chat.id;
    const chatHistory = getHistory(chatId);
    const resultado = await explicarOEjecutar(chatHistory, transcript, {
      chatId: ctx.chat.id,
    });

    chatHistory.push({ role: 'user', parts: [{ text: `[voz] ${transcript}` }] });
    chatHistory.push({ role: 'model', parts: [{ text: resultado.text }] });
    trimHistory(chatHistory);

    await replyResultado(ctx, {
      text: `🎤 _${transcript}_\n\n${resultado.text}`,
      ics: resultado.ics,
    });
  } catch (error) {
    console.error('Error en nota de voz:', error);
    await ctx.reply('Ocurrió un error al procesar la nota de voz.');
  }
});

bot.on(['photo', 'document'], async (ctx) => {
  try {
    await ctx.sendChatAction('typing');
    const isPhoto = Boolean(ctx.message.photo?.length);
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
      (isPhoto ? 'image/jpeg' : 'application/octet-stream');
    const caption = ctx.message.caption?.trim() || '';

    const esVisual =
      isPhoto ||
      /^image\//i.test(mimeType) ||
      /pdf$/i.test(mimeType) ||
      /\.(jpe?g|png|webp|gif|pdf)$/i.test(fileName);

    /** @type {string | null} */
    let analisis = null;
    if (esVisual) {
      try {
        await ctx.sendChatAction('typing');
        analisis = await analizarImagen(buffer, mimeType, caption || undefined);
      } catch (e) {
        console.warn('[vision]', e);
      }
    }

    await ctx.sendChatAction('upload_document');
    const uploaded = await uploadFile({
      chatId: ctx.chat.id,
      fileName,
      buffer,
      mimeType,
    });

    let msg = `Archivo en *${uploaded.provider}*: *${uploaded.name}*`;
    if (uploaded.url) msg += `\n${uploaded.url}`;

    if (analisis) {
      msg += `\n\n${analisis}`;
    } else {
      try {
        const note = await noteAboutFile({ fileName, mimeType, hint: caption || undefined });
        if (note) msg += `\n\n${note}`;
      } catch (e) {
        console.warn('[ai note]', e);
      }
    }

    const chatHistory = getHistory(ctx.chat.id);
    if (analisis) {
      chatHistory.push({
        role: 'user',
        parts: [{ text: `[archivo ${fileName}] ${caption || '(sin leyenda)'}` }],
      });
      chatHistory.push({ role: 'model', parts: [{ text: analisis }] });
      trimHistory(chatHistory);
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
    // launch() en polling no resuelve hasta stop; no await antes del log
    bot.launch().then(() => {
      console.log('Asistente AI detenido.');
    });
    console.log('🚀 Asistente AI en Telegram activo...');
    console.log('Bot: @AsistentecasaInteligenteBOT — escribe /start en Telegram');
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));
