import {
  GoogleGenerativeAI,
  type Content,
  type FunctionCall,
  type Part,
} from '@google/generative-ai';
import type { SupabaseClient } from '@supabase/supabase-js';
import { executeAgendaTool } from '@/lib/agenda/executeAgendaTool';
import { AGENDA_TOOL_NAMES, agendaTools, type AgendaToolName } from '@/lib/gemini/agendaTools';

const DEFAULT_MODEL = 'gemini-2.0-flash';
const MAX_TOOL_ROUNDS = 5;

export type AgendaChatMessage = {
  role: 'user' | 'model';
  text: string;
};

export type AgendaChatResponse = {
  reply: string;
  toolCalls: Array<{ name: string; result: unknown }>;
  model: string;
};

function getApiKey(): string {
  const key = process.env.GEMINI_API_KEY?.trim();
  if (!key || key === 'TU_GEMINI_API_KEY_AQUI') {
    throw new Error('GEMINI_API_KEY no configurada. Agrégala en .env.local.');
  }
  return key;
}

function isAgendaToolName(name: string): name is AgendaToolName {
  return (AGENDA_TOOL_NAMES as readonly string[]).includes(name);
}

function buildSystemInstruction(today: string): string {
  return [
    'Eres el asistente de agenda personal de Casa Inteligente.',
    'Ayudas a guardar y consultar cumpleaños, citas, recordatorios y fechas especiales.',
    `La fecha de hoy es ${today}.`,
    'Usa las herramientas disponibles cuando el usuario quiera registrar o consultar eventos.',
    'Responde siempre en español, de forma clara y breve.',
    'Si guardas un evento, confirma título, categoría y fecha.',
    'Si consultas eventos, resume los resultados de forma legible.',
  ].join('\n');
}

function toHistoryContents(messages: AgendaChatMessage[]): Content[] {
  return messages.map((message) => ({
    role: message.role,
    parts: [{ text: message.text }],
  }));
}

function extractFunctionCalls(parts: Part[] | undefined): FunctionCall[] {
  if (!parts?.length) return [];
  return parts
    .map((part) => part.functionCall)
    .filter((call): call is FunctionCall => Boolean(call?.name));
}

export async function runAgendaChat(
  supabase: SupabaseClient,
  userId: string | null,
  messages: AgendaChatMessage[],
  model = DEFAULT_MODEL,
): Promise<AgendaChatResponse> {
  if (!messages.length) {
    throw new Error('Se requiere al menos un mensaje del usuario.');
  }

  const genAI = new GoogleGenerativeAI(getApiKey());
  const generativeModel = genAI.getGenerativeModel({
    model,
    tools: agendaTools,
    systemInstruction: buildSystemInstruction(new Date().toISOString().slice(0, 10)),
  });

  const history = toHistoryContents(messages.slice(0, -1));
  const lastMessage = messages[messages.length - 1];

  const chat = generativeModel.startChat({ history });
  let result = await chat.sendMessage(lastMessage.text);

  const toolCalls: AgendaChatResponse['toolCalls'] = [];

  for (let round = 0; round < MAX_TOOL_ROUNDS; round += 1) {
    const calls = extractFunctionCalls(result.response.candidates?.[0]?.content?.parts);
    if (!calls.length) break;

    const functionResponses: Part[] = [];

    for (const call of calls) {
      const name = call.name ?? '';
      const args = (call.args ?? {}) as Record<string, unknown>;

      if (!isAgendaToolName(name)) {
        functionResponses.push({
          functionResponse: {
            name,
            response: { success: false, message: `Herramienta no soportada: ${name}` },
          },
        });
        continue;
      }

      const toolResult = await executeAgendaTool(supabase, userId, name, args);
      toolCalls.push({ name, result: toolResult });
      functionResponses.push({
        functionResponse: {
          name,
          response: toolResult,
        },
      });
    }

    result = await chat.sendMessage(functionResponses);
  }

  const reply = result.response.text()?.trim() ?? 'Listo.';

  return {
    reply,
    toolCalls,
    model,
  };
}
