import type { StorageProviderId } from '@/lib/mi-asistente-ai/config/env';
import {
  isAsistenteChatAllowed,
  isAsistenteConfigured,
} from '@/lib/mi-asistente-ai/config/env';
import { chatWithAsistente, resetChatHistory, summarizeDocument } from '@/lib/mi-asistente-ai/services/ai';
import {
  getProviderForChat,
  listStorageAdapters,
  setProviderForChat,
  uploadWithChatProvider,
} from '@/lib/mi-asistente-ai/services/storage';
import {
  answerAsistenteCallback,
  downloadAsistenteFile,
  sendAsistenteMessage,
} from '@/lib/mi-asistente-ai/services/telegram';

type TgUser = { id: number; first_name?: string; username?: string };
type TgChat = { id: number; type: string };
type TgPhotoSize = { file_id: string; file_unique_id: string; width: number; height: number };
type TgDocument = {
  file_id: string;
  file_name?: string;
  mime_type?: string;
};
type TgMessage = {
  message_id: number;
  chat: TgChat;
  from?: TgUser;
  text?: string;
  caption?: string;
  photo?: TgPhotoSize[];
  document?: TgDocument;
};
type TgCallback = {
  id: string;
  from: TgUser;
  message?: TgMessage;
  data?: string;
};
type TgUpdate = {
  update_id: number;
  message?: TgMessage;
  callback_query?: TgCallback;
};

function ayudaText(): string {
  return [
    '<b>Asistente AI — Casa Inteligente</b>',
    '',
    'Habla conmigo en texto libre. También puedes enviarme fotos o documentos para guardarlos.',
    '',
    '<b>Comandos</b>',
    '/start — bienvenida',
    '/ayuda — esta ayuda',
    '/reset — borra el historial de la conversación',
    '/storage — elige Google Drive, OneDrive, iCloud o Supabase',
    '',
    'Para compras, almacén, procura o facturas usa el bot operativo @Casainteligenteoficialbot.',
  ].join('\n');
}

function startText(name?: string): string {
  const saludo = name?.trim() ? `Hola ${escapeHtml(name.trim())}` : 'Hola';
  return [
    `${saludo}. Soy el <b>asistente AI</b> de Casa Inteligente.`,
    '',
    'Puedo ayudarte a organizar ideas, resumir temas y guardar archivos en la nube.',
    'Escribe /ayuda para ver comandos o /storage para elegir dónde guardar.',
  ].join('\n');
}

function storageKeyboard() {
  const rows = listStorageAdapters().map((a) => [
    {
      text: `${a.isConfigured() ? '✅' : '⚪'} ${a.label}`,
      callback_data: `storage:${a.id}`,
    },
  ]);
  return { inline_keyboard: rows };
}

export async function handleAsistenteWebhookGet(): Promise<Response> {
  return Response.json({
    ok: true,
    service: 'mi-asistente-ai',
    configured: isAsistenteConfigured(),
  });
}

export async function handleAsistenteWebhookPost(req: Request): Promise<Response> {
  if (!isAsistenteConfigured()) {
    console.error('[mi-asistente-ai] MI_ASISTENTE_AI_BOT_TOKEN no configurado');
    return Response.json({ ok: false, error: 'bot_not_configured' }, { status: 200 });
  }

  let update: TgUpdate;
  try {
    update = (await req.json()) as TgUpdate;
  } catch {
    return Response.json({ ok: false, error: 'invalid_json' }, { status: 200 });
  }

  try {
    if (update.callback_query) {
      await handleCallback(update.callback_query);
    } else if (update.message) {
      await handleMessage(update.message);
    }
  } catch (err) {
    console.error('[mi-asistente-ai] update error', err);
    const chatId =
      update.callback_query?.message?.chat.id ?? update.message?.chat.id ?? null;
    if (chatId != null) {
      try {
        const msg = err instanceof Error ? err.message : 'Error interno';
        await sendAsistenteMessage(chatId, `❌ ${escapeHtml(msg.slice(0, 500))}`);
      } catch {
        /* ignore */
      }
    }
  }

  return Response.json({ ok: true });
}

async function handleCallback(cb: TgCallback): Promise<void> {
  const chatId = cb.message?.chat.id;
  if (chatId == null) {
    await answerAsistenteCallback(cb.id);
    return;
  }
  if (!isAsistenteChatAllowed(chatId)) {
    await answerAsistenteCallback(cb.id, 'Chat no autorizado', true);
    return;
  }

  const data = cb.data?.trim() || '';
  if (data.startsWith('storage:')) {
    const id = data.slice('storage:'.length) as StorageProviderId;
    const valid = ['drive', 'onedrive', 'icloud', 'supabase'].includes(id);
    if (!valid) {
      await answerAsistenteCallback(cb.id, 'Proveedor inválido', true);
      return;
    }
    setProviderForChat(String(chatId), id);
    const adapter = listStorageAdapters().find((a) => a.id === id);
    await answerAsistenteCallback(cb.id, `Proveedor: ${adapter?.label ?? id}`);
    const status = adapter?.isConfigured()
      ? 'listo para recibir archivos.'
      : 'seleccionado, pero faltan variables de entorno en el servidor.';
    await sendAsistenteMessage(
      chatId,
      `Almacenamiento: <b>${escapeHtml(adapter?.label ?? id)}</b> — ${status}`,
    );
    return;
  }

  await answerAsistenteCallback(cb.id);
}

async function handleMessage(msg: TgMessage): Promise<void> {
  const chatId = msg.chat.id;
  if (!isAsistenteChatAllowed(chatId)) {
    await sendAsistenteMessage(
      chatId,
      'Este chat no está autorizado para el asistente AI. Contacte al administrador.',
    );
    return;
  }

  const chatKey = String(chatId);
  const text = (msg.text || '').trim();

  if (text.startsWith('/')) {
    const cmd = text.split(/\s+/)[0].split('@')[0].toLowerCase();
    if (cmd === '/start') {
      await sendAsistenteMessage(chatId, startText(msg.from?.first_name));
      return;
    }
    if (cmd === '/ayuda' || cmd === '/help') {
      await sendAsistenteMessage(chatId, ayudaText());
      return;
    }
    if (cmd === '/reset') {
      resetChatHistory(chatKey);
      await sendAsistenteMessage(chatId, 'Historial borrado. Empezamos de cero.');
      return;
    }
    if (cmd === '/storage') {
      const current = getProviderForChat(chatKey);
      await sendAsistenteMessage(
        chatId,
        `Proveedor actual: <b>${escapeHtml(current)}</b>\nElige uno:`,
        { reply_markup: storageKeyboard() },
      );
      return;
    }
    await sendAsistenteMessage(chatId, 'Comando no reconocido. Usa /ayuda.');
    return;
  }

  if (msg.photo?.length || msg.document) {
    await handleMedia(msg);
    return;
  }

  if (!text) {
    await sendAsistenteMessage(chatId, 'Envíame un texto, foto o documento.');
    return;
  }

  const reply = await chatWithAsistente({ chatId: chatKey, userText: text });
  await sendAsistenteMessage(chatId, reply);
}

async function handleMedia(msg: TgMessage): Promise<void> {
  const chatId = msg.chat.id;
  const chatKey = String(chatId);
  const caption = (msg.caption || '').trim();

  let fileId: string;
  let fileName: string;
  let contentType: string;

  if (msg.document) {
    fileId = msg.document.file_id;
    fileName = msg.document.file_name || `documento_${msg.message_id}`;
    contentType = msg.document.mime_type || 'application/octet-stream';
  } else if (msg.photo?.length) {
    const best = msg.photo[msg.photo.length - 1];
    fileId = best.file_id;
    fileName = `foto_${msg.message_id}.jpg`;
    contentType = 'image/jpeg';
  } else {
    return;
  }

  await sendAsistenteMessage(chatId, 'Guardando archivo…');
  const { buffer } = await downloadAsistenteFile(fileId);
  const uploaded = await uploadWithChatProvider(chatKey, {
    fileName,
    buffer,
    contentType,
  });

  let reply = uploaded.message;
  if (uploaded.url) {
    reply += `\n<a href="${escapeAttr(uploaded.url)}">Abrir</a>`;
  }

  try {
    const summary = await summarizeDocument({
      fileName,
      mimeType: contentType,
      hint: caption || undefined,
    });
    reply += `\n\n${summary}`;
  } catch (e) {
    console.warn('[mi-asistente-ai] summarizeDocument', e);
  }

  await sendAsistenteMessage(chatId, reply);
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function escapeAttr(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
}
