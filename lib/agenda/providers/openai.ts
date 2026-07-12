import OpenAI from 'openai';
import { ejecutarToolDeAgenda } from '@/lib/agenda/ejecutarToolDeAgenda';
import { AGENDA_TOOL_SCHEMA, buildAgendaSystemPrompt } from '@/lib/agenda/toolDefinitions';
import { AGENDA_TOOL_NAMES, type AgendaToolName } from '@/lib/gemini/agendaTools';
import type {
  AgendaChatMessage,
  AgendaChatResponse,
  AgendaOwner,
  AgendaToolArgs,
  AgendaToolResult,
} from '@/types/agenda';

const DEFAULT_MODEL = 'gpt-4o-mini';
const MAX_TOOL_ROUNDS = 5;

const openAiTools: OpenAI.Chat.Completions.ChatCompletionTool[] = [
  {
    type: 'function',
    function: {
      name: AGENDA_TOOL_SCHEMA.guardarFechaEspecial.name,
      description: AGENDA_TOOL_SCHEMA.guardarFechaEspecial.description,
      parameters: AGENDA_TOOL_SCHEMA.guardarFechaEspecial.parameters,
    },
  },
  {
    type: 'function',
    function: {
      name: AGENDA_TOOL_SCHEMA.consultarFechasEspeciales.name,
      description: AGENDA_TOOL_SCHEMA.consultarFechasEspeciales.description,
      parameters: AGENDA_TOOL_SCHEMA.consultarFechasEspeciales.parameters,
    },
  },
];

function getClient(): OpenAI {
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) throw new Error('OPENAI_API_KEY no configurada.');
  return new OpenAI({ apiKey });
}

function isAgendaToolName(name: string): name is AgendaToolName {
  return (AGENDA_TOOL_NAMES as readonly string[]).includes(name);
}

function toOpenAiMessages(messages: AgendaChatMessage[]): OpenAI.Chat.Completions.ChatCompletionMessageParam[] {
  return messages.map((message) => ({
    role: message.role,
    content: message.text,
  }));
}

export async function runOpenAiAgendaChat(
  owner: AgendaOwner,
  messages: AgendaChatMessage[],
  model = DEFAULT_MODEL,
): Promise<AgendaChatResponse> {
  const client = getClient();
  const toolCalls: AgendaChatResponse['toolCalls'] = [];

  const conversation: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
    {
      role: 'system',
      content: buildAgendaSystemPrompt(new Date().toISOString().slice(0, 10)),
    },
    ...toOpenAiMessages(messages),
  ];

  let response = await client.chat.completions.create({
    model,
    messages: conversation,
    tools: openAiTools,
    tool_choice: 'auto',
  });

  for (let round = 0; round < MAX_TOOL_ROUNDS; round += 1) {
    const choice = response.choices[0];
    const toolCallList = choice.message.tool_calls ?? [];
    if (!toolCallList.length) break;

    conversation.push(choice.message);

    for (const toolCall of toolCallList) {
      if (toolCall.type !== 'function') continue;

      const name = toolCall.function.name;
      let args: AgendaToolArgs = {};
      try {
        args = JSON.parse(toolCall.function.arguments || '{}') as AgendaToolArgs;
      } catch {
        args = {};
      }

      let toolResult: AgendaToolResult;
      if (!isAgendaToolName(name)) {
        toolResult = { status: 'error', message: `Herramienta no soportada: ${name}` };
      } else {
        try {
          toolResult = await ejecutarToolDeAgenda(name, args, owner);
        } catch (err) {
          const message = err instanceof Error ? err.message : 'Error al ejecutar la herramienta.';
          toolResult = { status: 'error', message };
        }
      }

      toolCalls.push({ name, result: toolResult });
      conversation.push({
        role: 'tool',
        tool_call_id: toolCall.id,
        content: JSON.stringify(toolResult),
      });
    }

    response = await client.chat.completions.create({
      model,
      messages: conversation,
      tools: openAiTools,
      tool_choice: 'auto',
    });
  }

  const reply = response.choices[0]?.message?.content?.trim() ?? 'Listo.';

  return {
    reply,
    toolCalls,
    provider: 'openai',
    model,
  };
}
