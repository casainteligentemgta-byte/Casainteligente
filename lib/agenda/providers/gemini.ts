import {
  GoogleGenerativeAI,
  type Content,
  type FunctionCall,
  type Part,
} from '@google/generative-ai';
import { ejecutarToolDeAgenda } from '@/lib/agenda/ejecutarToolDeAgenda';
import { buildAgendaSystemPrompt } from '@/lib/agenda/toolDefinitions';
import { agendaTools, AGENDA_TOOL_NAMES, type AgendaToolName } from '@/lib/gemini/agendaTools';
import type {
  AgendaChatMessage,
  AgendaChatResponse,
  AgendaOwner,
  AgendaToolArgs,
  AgendaToolResult,
} from '@/types/agenda';

const DEFAULT_MODEL = 'gemini-2.0-flash';
const MAX_TOOL_ROUNDS = 5;

function getApiKey(): string {
  const key = process.env.GEMINI_API_KEY?.trim();
  if (!key || key === 'TU_GEMINI_API_KEY_AQUI') {
    throw new Error('GEMINI_API_KEY no configurada.');
  }
  return key;
}

function isAgendaToolName(name: string): name is AgendaToolName {
  return (AGENDA_TOOL_NAMES as readonly string[]).includes(name);
}

function toGeminiHistory(messages: AgendaChatMessage[]): Content[] {
  return messages.slice(0, -1).map((message) => ({
    role: message.role === 'assistant' ? 'model' : 'user',
    parts: [{ text: message.text }],
  }));
}

function extractFunctionCalls(parts: Part[] | undefined): FunctionCall[] {
  if (!parts?.length) return [];
  return parts
    .map((part) => part.functionCall)
    .filter((call): call is FunctionCall => Boolean(call?.name));
}

export async function runGeminiAgendaChat(
  owner: AgendaOwner,
  messages: AgendaChatMessage[],
  model = DEFAULT_MODEL,
): Promise<AgendaChatResponse> {
  const genAI = new GoogleGenerativeAI(getApiKey());
  const generativeModel = genAI.getGenerativeModel({
    model,
    tools: agendaTools,
    systemInstruction: buildAgendaSystemPrompt(new Date().toISOString().slice(0, 10)),
  });

  const lastMessage = messages[messages.length - 1];
  const chat = generativeModel.startChat({ history: toGeminiHistory(messages) });
  let result = await chat.sendMessage(lastMessage.text);

  const toolCalls: AgendaChatResponse['toolCalls'] = [];

  for (let round = 0; round < MAX_TOOL_ROUNDS; round += 1) {
    const calls = extractFunctionCalls(result.response.candidates?.[0]?.content?.parts);
    if (!calls.length) break;

    const functionResponses: Part[] = [];

    for (const call of calls) {
      const name = call.name ?? '';
      const args = (call.args ?? {}) as AgendaToolArgs;

      if (!isAgendaToolName(name)) {
        functionResponses.push({
          functionResponse: {
            name,
            response: { status: 'error', message: `Herramienta no soportada: ${name}` },
          },
        });
        continue;
      }

      let toolResult: AgendaToolResult;
      try {
        toolResult = await ejecutarToolDeAgenda(name, args, owner);
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Error al ejecutar la herramienta.';
        toolResult = { status: 'error', message };
      }

      toolCalls.push({ name, result: toolResult });
      functionResponses.push({ functionResponse: { name, response: toolResult } });
    }

    result = await chat.sendMessage(functionResponses);
  }

  return {
    reply: result.response.text()?.trim() ?? 'Listo.',
    toolCalls,
    provider: 'gemini',
    model,
  };
}
