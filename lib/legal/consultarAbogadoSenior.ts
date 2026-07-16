import type { SupabaseClient } from '@supabase/supabase-js';
import { geminiGenerateText, getGeminiApiKey } from '@/lib/gemini/client';
import { GEMINI_PROCUREMENT_DEFAULT_MODEL } from '@/lib/almacen/geminiProcurementModels';
import {
  SYSTEM_PROMPT_TEMPLATE,
  buildFinalAbogadoPrompt,
  formatContextoLegal,
  type ContextoLegalFragmento,
} from '@/lib/legal/abogadoSeniorPrompt';
import {
  searchLegalKnowledge,
  type LegalKnowledgeHit,
} from '@/lib/legal/searchLegalKnowledge';

export type ConsultaAbogadoOptions = {
  categoria?: string | null;
  matchThreshold?: number;
  matchCount?: number;
  filterMetadata?: Record<string, unknown> | null;
  /** Por defecto gpt-4o (OpenAI). Usar gemini-* para fallback Gemini. */
  model?: string;
  /** Si true, el contexto incluye etiquetas [Fuente N] además del content. */
  labeledContext?: boolean;
};

export type ConsultaAbogadoResult = {
  respuesta: string;
  fuentes: Array<{
    index: number;
    id: string;
    referencia: string | null;
    source: string | null;
    categoria: string | null;
    tipo: string | null;
    similarity: number;
    excerpt: string;
  }>;
  model: string;
  provider: 'openai' | 'gemini';
  query: string;
  final_prompt_chars: number;
};

function hitsToFragments(hits: LegalKnowledgeHit[]): ContextoLegalFragmento[] {
  return hits.map((h, i) => ({
    index: i + 1,
    content: h.content,
    referencia: h.referencia,
    source: h.source,
    categoria: h.categoria,
    tipo: h.tipo,
    jurisdiccion: h.jurisdiccion,
    similarity: h.similarity,
  }));
}

async function chatOpenAiSystem(
  finalPrompt: string,
  model: string,
  apiKey: string,
): Promise<string> {
  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model,
      temperature: 0.25,
      max_tokens: 4096,
      messages: [{ role: 'system', content: finalPrompt }],
    }),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`OpenAI chat ${res.status}: ${body.slice(0, 280)}`);
  }

  const json = (await res.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };
  const text = json.choices?.[0]?.message?.content?.trim();
  if (!text) throw new Error('OpenAI no devolvió contenido');
  return text;
}

function preferOpenAi(model?: string): boolean {
  const m = (model || process.env.LEGAL_CHAT_MODEL || 'gpt-4o').toLowerCase();
  if (m.startsWith('gemini')) return false;
  return Boolean(process.env.OPENAI_API_KEY?.trim());
}

export async function consultarAbogadoSenior(
  supabase: SupabaseClient,
  userQuery: string,
  options?: ConsultaAbogadoOptions,
): Promise<ConsultaAbogadoResult> {
  const query = userQuery.trim();
  if (!query) {
    throw new Error('Consulta vacía');
  }

  // 1) Recuperar fragmentos (RAG)
  const hits = await searchLegalKnowledge(supabase, query, {
    categoryFilter: options?.categoria ?? null,
    matchThreshold: options?.matchThreshold ?? 0.65,
    matchCount: options?.matchCount ?? 6,
    filterMetadata: options?.filterMetadata ?? null,
  });

  const fragments = hitsToFragments(hits);

  // 2) Ensamblar prompt final (como el ejemplo conceptual)
  //    context = "\n\n".join([item['content'] for item in search_results])
  //    final_prompt = system_prompt_template.format(context=..., user_query=...)
  const labeled = options?.labeledContext !== false;
  const contextParts = labeled
    ? [{ content: formatContextoLegal(fragments) }]
    : hits;
  const finalPrompt = buildFinalAbogadoPrompt(
    query,
    contextParts,
    SYSTEM_PROMPT_TEMPLATE,
  );

  const openaiKey = process.env.OPENAI_API_KEY?.trim() || '';
  const useOpenAi = preferOpenAi(options?.model);

  let respuesta: string;
  let model: string;
  let provider: 'openai' | 'gemini';

  if (useOpenAi && openaiKey) {
    // 3) Llamada a la IA (OpenAI gpt-4o por defecto)
    model = options?.model?.trim() || process.env.LEGAL_CHAT_MODEL?.trim() || 'gpt-4o';
    provider = 'openai';
    respuesta = await chatOpenAiSystem(finalPrompt, model, openaiKey);
  } else if (getGeminiApiKey()) {
    model =
      options?.model?.trim() ||
      process.env.GEMINI_LEGAL_MODEL?.trim() ||
      GEMINI_PROCUREMENT_DEFAULT_MODEL;
    if (!model.startsWith('gemini')) {
      model = GEMINI_PROCUREMENT_DEFAULT_MODEL;
    }
    provider = 'gemini';
    // Gemini: el final_prompt completo va como mensaje de usuario (equivalente al system único)
    respuesta = await geminiGenerateText({
      model,
      prompt: finalPrompt,
      temperature: 0.25,
      maxOutputTokens: 4096,
    });
  } else {
    throw new Error(
      'Falta OPENAI_API_KEY (gpt-4o) o GEMINI_API_KEY para redactar el dictamen',
    );
  }

  return {
    respuesta: respuesta.trim(),
    fuentes: hits.map((h, i) => ({
      index: i + 1,
      id: h.id,
      referencia: h.referencia,
      source: h.source,
      categoria: h.categoria,
      tipo: h.tipo,
      similarity: h.similarity,
      excerpt: h.content.slice(0, 280),
    })),
    model,
    provider,
    query,
    final_prompt_chars: finalPrompt.length,
  };
}
