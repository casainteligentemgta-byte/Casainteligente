import { runGeminiAgendaChat } from '@/lib/agenda/providers/gemini';
import { runOpenAiAgendaChat } from '@/lib/agenda/providers/openai';
import type { AgendaChatMessage, AgendaChatResponse, AgendaOwner, LlmProvider } from '@/types/agenda';

export type RunAgendaChatOptions = {
  provider?: LlmProvider;
  model?: string;
};

function resolveProvider(requested?: LlmProvider): LlmProvider {
  const envDefault = process.env.AGENDA_LLM_PROVIDER?.trim().toLowerCase();
  const preferred =
    requested ??
    (envDefault === 'openai' || envDefault === 'gemini' ? envDefault : undefined) ??
    'gemini';

  if (preferred === 'openai') {
    if (process.env.OPENAI_API_KEY?.trim()) return 'openai';
    if (process.env.GEMINI_API_KEY?.trim()) return 'gemini';
    throw new Error('No hay proveedor LLM configurado (OPENAI_API_KEY o GEMINI_API_KEY).');
  }

  if (process.env.GEMINI_API_KEY?.trim()) return 'gemini';
  if (process.env.OPENAI_API_KEY?.trim()) return 'openai';
  throw new Error('No hay proveedor LLM configurado (GEMINI_API_KEY o OPENAI_API_KEY).');
}

export async function runAgendaChat(
  owner: AgendaOwner,
  messages: AgendaChatMessage[],
  options: RunAgendaChatOptions = {},
): Promise<AgendaChatResponse> {
  if (!messages.length) {
    throw new Error('Se requiere al menos un mensaje del usuario.');
  }

  const provider = resolveProvider(options.provider);

  if (provider === 'openai') {
    return runOpenAiAgendaChat(owner, messages, options.model);
  }

  return runGeminiAgendaChat(owner, messages, options.model);
}

export type { AgendaChatMessage, AgendaChatResponse };
