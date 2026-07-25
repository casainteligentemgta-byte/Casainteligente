import OpenAI from 'openai';
import { PHEME_CHAT_MODEL_DEFAULT } from '@/lib/pheme/constants';
import { parsePhemeInforme } from '@/lib/pheme/parsePhemeInforme';
import { buildPhemeUserPrompt, PHEME_SYSTEM_PROMPT } from '@/lib/pheme/phemePrompt';
import type { PhemeInforme } from '@/types/pheme';

export type RunPhemeAgentResult = {
  informe: PhemeInforme;
  modelo: string;
  rawText: string;
};

function getClient(): OpenAI {
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) throw new Error('OPENAI_API_KEY no configurada para el agente Pheme');
  return new OpenAI({ apiKey });
}

/**
 * Invoca el LLM con el system prompt de Pheme y parsea el JSON estructurado.
 */
export async function runPhemeAgent(
  transcripcion: string,
  options?: { titulo?: string | null; model?: string },
): Promise<RunPhemeAgentResult> {
  const text = (transcripcion || '').trim();
  if (!text) throw new Error('Transcripción vacía: no se puede ejecutar Pheme');

  const model =
    options?.model?.trim() ||
    process.env.PHEME_CHAT_MODEL?.trim() ||
    PHEME_CHAT_MODEL_DEFAULT;

  const client = getClient();
  const completion = await client.chat.completions.create({
    model,
    temperature: 0.2,
    response_format: { type: 'json_object' },
    messages: [
      { role: 'system', content: PHEME_SYSTEM_PROMPT },
      { role: 'user', content: buildPhemeUserPrompt(text, options?.titulo) },
    ],
  });

  const rawText = completion.choices[0]?.message?.content?.trim() || '';
  if (!rawText) throw new Error('El LLM no devolvió contenido para Pheme');

  const informe = parsePhemeInforme(rawText);
  return { informe, modelo: model, rawText };
}
