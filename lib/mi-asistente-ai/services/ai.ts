import { geminiGenerateText } from '@/lib/gemini/client';
import { getAsistenteGeminiModel } from '@/lib/mi-asistente-ai/config/env';

const SYSTEM_PROMPT = `Eres el asistente AI de Casa Inteligente, plataforma de obras de construcción en Venezuela.
Responde en español (Venezuela), de forma clara y breve.
Ayudas con: organización de documentos, resúmenes, ideas de obra, recordatorios y dudas generales del negocio.
No inventes datos de stock, facturas o nómina: si el usuario necesita operaciones reales (compras, almacén, procura), indícale que use el bot operativo @Casainteligenteoficialbot.
Si te envían un archivo, puedes ayudar a clasificarlo o resumirlo tras guardarlo.
Evita emojis excesivos. Usa HTML simple de Telegram si hace falta (<b>, <i>, <code>).`;

export type ChatTurn = { role: 'user' | 'model'; text: string };

const MAX_HISTORY = 20;

/** Historial en memoria del proceso (suficiente para conversación corta en webhook). */
const historyByChat = new Map<string, ChatTurn[]>();

export function getChatHistory(chatId: string): ChatTurn[] {
  return historyByChat.get(chatId) ?? [];
}

export function resetChatHistory(chatId: string): void {
  historyByChat.delete(chatId);
}

export function appendChatTurn(chatId: string, turn: ChatTurn): void {
  const prev = getChatHistory(chatId);
  const next = [...prev, turn].slice(-MAX_HISTORY);
  historyByChat.set(chatId, next);
}

export async function chatWithAsistente(params: {
  chatId: string;
  userText: string;
}): Promise<string> {
  const history = getChatHistory(params.chatId);
  const reply = await geminiGenerateText({
    model: getAsistenteGeminiModel(),
    systemInstruction: SYSTEM_PROMPT,
    history,
    prompt: params.userText,
    temperature: 0.45,
    maxOutputTokens: 2048,
  });

  appendChatTurn(params.chatId, { role: 'user', text: params.userText });
  appendChatTurn(params.chatId, { role: 'model', text: reply });
  return reply;
}

export async function summarizeDocument(params: {
  fileName: string;
  mimeType: string;
  hint?: string;
}): Promise<string> {
  const prompt = [
    `El usuario subió el archivo "${params.fileName}" (${params.mimeType}) al asistente de Casa Inteligente.`,
    params.hint?.trim() ? `Contexto del usuario: ${params.hint.trim()}` : '',
    'Confirma que el archivo quedó registrado y sugiere en 2-4 viñetas cómo catalogarlo (tipo, obra, fecha).',
    'No inventes el contenido del documento si no lo viste.',
  ]
    .filter(Boolean)
    .join('\n');

  return geminiGenerateText({
    model: getAsistenteGeminiModel(),
    systemInstruction: SYSTEM_PROMPT,
    prompt,
    temperature: 0.3,
    maxOutputTokens: 1024,
  });
}
