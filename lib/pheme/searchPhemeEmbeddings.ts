import type { SupabaseClient } from '@supabase/supabase-js';
import { PHEME_EMBEDDING_MODEL } from '@/lib/pheme/constants';
import type { PhemeEmbeddingHit } from '@/types/pheme';

async function embedQuery(queryText: string, apiKey: string): Promise<number[]> {
  const res = await fetch('https://api.openai.com/v1/embeddings', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: PHEME_EMBEDDING_MODEL,
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
  if (!embedding?.length) throw new Error('OpenAI no devolvió embedding');
  return embedding;
}

/**
 * Consulta semántica sobre `pheme_embeddings` vía RPC `match_pheme_embeddings`.
 */
export async function searchPhemeEmbeddings(
  supabase: SupabaseClient,
  queryText: string,
  options?: {
    reunionId?: string | null;
    matchThreshold?: number;
    matchCount?: number;
    openaiApiKey?: string;
  },
): Promise<PhemeEmbeddingHit[]> {
  const q = queryText.trim();
  if (!q) return [];

  const apiKey = (options?.openaiApiKey || process.env.OPENAI_API_KEY || '').trim();
  if (!apiKey) throw new Error('Falta OPENAI_API_KEY');

  const queryEmbedding = await embedQuery(q, apiKey);

  const { data, error } = await supabase.rpc('match_pheme_embeddings', {
    query_embedding: queryEmbedding,
    match_threshold: options?.matchThreshold ?? 0.65,
    match_count: options?.matchCount ?? 8,
    filter_reunion_id: options?.reunionId ?? null,
  });

  if (error) {
    throw new Error(error.message);
  }

  return (data ?? []) as PhemeEmbeddingHit[];
}
