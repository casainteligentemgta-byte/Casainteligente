import type { SupabaseClient } from '@supabase/supabase-js';
import { chunkTranscriptByWords } from '@/lib/pheme/chunkTranscript';
import { PHEME_EMBEDDING_MODEL } from '@/lib/pheme/constants';

async function embedBatch(texts: string[], apiKey: string): Promise<number[][]> {
  const res = await fetch('https://api.openai.com/v1/embeddings', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: PHEME_EMBEDDING_MODEL,
      input: texts,
    }),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`OpenAI embeddings ${res.status}: ${body.slice(0, 240)}`);
  }

  const json = (await res.json()) as {
    data?: Array<{ embedding?: number[]; index?: number }>;
  };
  const data = json.data ?? [];
  const sorted = [...data].sort((a, b) => (a.index ?? 0) - (b.index ?? 0));
  return sorted.map((d) => {
    if (!d.embedding?.length) throw new Error('Embedding vacío en lote');
    return d.embedding;
  });
}

export type IndexTranscriptResult = {
  chunksIndexed: number;
  chunkSizes: number[];
};

/**
 * Fragmenta la transcripción, genera embeddings y los guarda en `pheme_embeddings`.
 */
export async function indexTranscriptEmbeddings(
  supabase: SupabaseClient,
  reunionId: string,
  transcripcion: string,
  options?: { openaiApiKey?: string; replace?: boolean },
): Promise<IndexTranscriptResult> {
  const apiKey = (options?.openaiApiKey || process.env.OPENAI_API_KEY || '').trim();
  if (!apiKey) throw new Error('Falta OPENAI_API_KEY para embeddings Pheme');

  const chunks = chunkTranscriptByWords(transcripcion);
  if (!chunks.length) {
    return { chunksIndexed: 0, chunkSizes: [] };
  }

  if (options?.replace !== false) {
    const { error: delError } = await supabase
      .from('pheme_embeddings')
      .delete()
      .eq('reunion_id', reunionId);
    if (delError) throw new Error(`No se pudieron limpiar embeddings previos: ${delError.message}`);
  }

  const batchSize = 16;
  const rows: Array<{
    reunion_id: string;
    chunk_index: number;
    content: string;
    embedding: number[];
    metadata: Record<string, unknown>;
  }> = [];

  for (let i = 0; i < chunks.length; i += batchSize) {
    const batch = chunks.slice(i, i + batchSize);
    const embeddings = await embedBatch(batch, apiKey);
    for (let j = 0; j < batch.length; j++) {
      const chunkIndex = i + j;
      rows.push({
        reunion_id: reunionId,
        chunk_index: chunkIndex,
        content: batch[j],
        embedding: embeddings[j],
        metadata: {
          model: PHEME_EMBEDDING_MODEL,
          word_count: batch[j].split(/\s+/).filter(Boolean).length,
        },
      });
    }
  }

  const { error: insertError } = await supabase.from('pheme_embeddings').insert(rows);
  if (insertError) {
    throw new Error(`Error al guardar pheme_embeddings: ${insertError.message}`);
  }

  return {
    chunksIndexed: rows.length,
    chunkSizes: chunks.map((c) => c.split(/\s+/).filter(Boolean).length),
  };
}
