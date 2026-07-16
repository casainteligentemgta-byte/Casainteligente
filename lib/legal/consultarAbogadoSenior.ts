import type { SupabaseClient } from '@supabase/supabase-js';
import { geminiGenerateText, getGeminiApiKey } from '@/lib/gemini/client';
import { GEMINI_PROCUREMENT_DEFAULT_MODEL } from '@/lib/almacen/geminiProcurementModels';
import {
  ABOGADO_SENIOR_SYSTEM,
  buildAbogadoSeniorUserPrompt,
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
  model?: string;
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
  query: string;
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

export async function consultarAbogadoSenior(
  supabase: SupabaseClient,
  userQuery: string,
  options?: ConsultaAbogadoOptions,
): Promise<ConsultaAbogadoResult> {
  const query = userQuery.trim();
  if (!query) {
    throw new Error('Consulta vacía');
  }
  if (!getGeminiApiKey()) {
    throw new Error('Falta GEMINI_API_KEY');
  }

  const hits = await searchLegalKnowledge(supabase, query, {
    categoryFilter: options?.categoria ?? null,
    matchThreshold: options?.matchThreshold ?? 0.65,
    matchCount: options?.matchCount ?? 6,
    filterMetadata: options?.filterMetadata ?? null,
  });

  const fragments = hitsToFragments(hits);
  const prompt = buildAbogadoSeniorUserPrompt(query, fragments);
  const model =
    options?.model?.trim() ||
    process.env.GEMINI_LEGAL_MODEL?.trim() ||
    GEMINI_PROCUREMENT_DEFAULT_MODEL;

  const respuesta = await geminiGenerateText({
    model,
    systemInstruction: ABOGADO_SENIOR_SYSTEM,
    prompt,
    temperature: 0.25,
    maxOutputTokens: 4096,
  });

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
    query,
  };
}
