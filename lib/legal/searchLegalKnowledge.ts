/**
 * Búsqueda semántica sobre ci_legal_knowledge (RPC match_legal_knowledge).
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import type { LegalCategoria, LegalKnowledgeMetadata } from '@/lib/legal/legalKnowledgeMetadata';

export type LegalKnowledgeHit = {
  id: string;
  content: string;
  metadata: LegalKnowledgeMetadata | Record<string, unknown> | null;
  source: string | null;
  capitulo: string | null;
  categoria: string | null;
  tipo: string | null;
  jurisdiccion: string | null;
  fecha_vigencia: string | null;
  referencia: string | null;
  similarity: number;
};

async function embedQuery(queryText: string, apiKey: string): Promise<number[]> {
  const res = await fetch('https://api.openai.com/v1/embeddings', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'text-embedding-3-small',
      input: queryText,
    }),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`OpenAI embeddings ${res.status}: ${body.slice(0, 240)}`);
  }

  const json = (await res.json()) as {
    data?: Array<{ embedding?: number[] }>;
  };
  const embedding = json.data?.[0]?.embedding;
  if (!embedding?.length) {
    throw new Error('OpenAI no devolvió embedding');
  }
  return embedding;
}

export async function searchLegalKnowledge(
  supabase: SupabaseClient,
  queryText: string,
  options?: {
    categoryFilter?: LegalCategoria | string | null;
    matchThreshold?: number;
    matchCount?: number;
    filterMetadata?: Record<string, unknown> | null;
    openaiApiKey?: string;
  },
): Promise<LegalKnowledgeHit[]> {
  const q = queryText.trim();
  if (!q) return [];

  const apiKey = (options?.openaiApiKey || process.env.OPENAI_API_KEY || '').trim();
  if (!apiKey) {
    throw new Error('Falta OPENAI_API_KEY');
  }

  const queryEmbedding = await embedQuery(q, apiKey);

  const filterMetadata: Record<string, unknown> | null = (() => {
    const base = options?.filterMetadata ? { ...options.filterMetadata } : {};
    if (options?.categoryFilter) {
      base.categoria = options.categoryFilter;
    }
    return Object.keys(base).length ? base : null;
  })();

  const { data, error } = await supabase.rpc('match_legal_knowledge', {
    query_embedding: queryEmbedding,
    match_threshold: options?.matchThreshold ?? 0.7,
    match_count: options?.matchCount ?? 5,
    filter_metadata: filterMetadata,
  });

  if (error) {
    throw new Error(error.message);
  }

  return (data ?? []) as LegalKnowledgeHit[];
}
