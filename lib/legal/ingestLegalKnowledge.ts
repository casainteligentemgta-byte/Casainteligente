/**
 * Ingesta de documentos legales → ci_legal_knowledge (RAG).
 * Equivalente a scripts/legal/ingest_legal_knowledge.py.
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import {
  normalizarLegalKnowledgeMetadata,
  type LegalKnowledgeMetadata,
} from '@/lib/legal/legalKnowledgeMetadata';

const EMBEDDING_MODEL = 'text-embedding-3-small';
const TABLE = 'ci_legal_knowledge';

export const LEGAL_FUENTE_CCT = 'convencion_colectiva';
export const LEGAL_FUENTE_CONTRATACION_COLECTIVA =
  'contratacion_colectiva_obrera';

export type LegalDocumentoClase =
  | 'convencion_colectiva'
  | 'contratacion_colectiva_obrera'
  | 'otro';

export function recursiveSplitLegalText(
  text: string,
  chunkSize = 1000,
  chunkOverlap = 100,
): string[] {
  const separators = ['\n\n', '\n', '. ', ' ', ''];
  const cleaned = (text || '').trim();
  if (!cleaned) return [];

  function splitWith(sep: string, parts: string[]): string[] {
    const out: string[] = [];
    for (const p of parts) {
      if (p.length <= chunkSize) {
        out.push(p);
        continue;
      }
      if (!sep) {
        const step = Math.max(1, chunkSize - chunkOverlap);
        for (let i = 0; i < p.length; i += step) {
          out.push(p.slice(i, i + chunkSize));
        }
        continue;
      }
      const pieces = p.split(sep);
      let buf = '';
      for (const piece of pieces) {
        const candidate = buf ? `${buf}${sep}${piece}` : piece;
        if (candidate.length <= chunkSize) {
          buf = candidate;
        } else {
          if (buf) out.push(buf);
          const sepIdx = separators.indexOf(sep);
          const nextSep =
            sepIdx >= 0 && sepIdx < separators.length - 1
              ? separators[sepIdx + 1]
              : '';
          if (piece.length > chunkSize && nextSep !== sep) {
            out.push(...splitWith(nextSep, [piece]));
            buf = '';
          } else {
            buf = piece;
          }
        }
      }
      if (buf) out.push(buf);
    }
    return out;
  }

  const chunks = splitWith(separators[0], [cleaned]);
  if (chunkOverlap <= 0 || chunks.length <= 1) {
    return chunks.map((c) => c.trim()).filter(Boolean);
  }

  const merged: string[] = [];
  for (let i = 0; i < chunks.length; i++) {
    const c = chunks[i].trim();
    if (!c) continue;
    if (i === 0) {
      merged.push(c);
      continue;
    }
    const prevTail = merged[merged.length - 1].slice(-chunkOverlap);
    merged.push(prevTail ? `${prevTail}\n${c}`.trim() : c);
  }
  return merged;
}

async function embedBatch(texts: string[], apiKey: string): Promise<number[][]> {
  const res = await fetch('https://api.openai.com/v1/embeddings', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: EMBEDDING_MODEL,
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

export function metadataParaDocumentoClase(
  clase: LegalDocumentoClase,
  referencia: string,
  extras?: Partial<LegalKnowledgeMetadata>,
): LegalKnowledgeMetadata {
  const base =
    clase === 'convencion_colectiva'
      ? {
          categoria: 'laboral' as const,
          tipo: 'ley' as const,
          jurisdiccion: 'venezuela' as const,
          source: LEGAL_FUENTE_CCT,
          referencia: referencia || 'Convención colectiva del trabajo',
        }
      : clase === 'contratacion_colectiva_obrera'
        ? {
            categoria: 'laboral' as const,
            tipo: 'contrato_modelo' as const,
            jurisdiccion: 'venezuela' as const,
            source: LEGAL_FUENTE_CONTRATACION_COLECTIVA,
            referencia: referencia || 'Contratación colectiva obrera',
          }
        : {
            categoria: 'laboral' as const,
            tipo: 'ley' as const,
            jurisdiccion: 'venezuela' as const,
            source: extras?.source ?? 'documento_legal',
            referencia: referencia || 'Documento legal',
          };

  return normalizarLegalKnowledgeMetadata({
    ...base,
    ...extras,
    fecha_vigencia:
      extras?.fecha_vigencia ?? new Date().toISOString().slice(0, 10),
  });
}

export async function ingestLegalDocumentText(
  supabase: SupabaseClient,
  text: string,
  metadata: Partial<LegalKnowledgeMetadata> | LegalKnowledgeMetadata,
  options?: {
    chunkSize?: number;
    chunkOverlap?: number;
    openaiApiKey?: string;
    replaceSource?: boolean;
  },
): Promise<{ chunks: number; source: string | null }> {
  const meta = normalizarLegalKnowledgeMetadata(metadata);
  const apiKey = (options?.openaiApiKey || process.env.OPENAI_API_KEY || '').trim();
  if (!apiKey) {
    throw new Error('Falta OPENAI_API_KEY para indexar el documento en el asesor legal.');
  }

  const chunks = recursiveSplitLegalText(
    text,
    options?.chunkSize ?? 1000,
    options?.chunkOverlap ?? 100,
  );
  if (chunks.length === 0) {
    throw new Error('El documento no tiene texto usable para indexar.');
  }

  if (options?.replaceSource && meta.source) {
    // Reemplaza toda la fuente (CCT / contratación colectiva) para evitar duplicados.
    await supabase.from(TABLE).delete().eq('source', meta.source);
  }

  let inserted = 0;
  const batchSize = 20;
  for (let i = 0; i < chunks.length; i += batchSize) {
    const batch = chunks.slice(i, i + batchSize);
    const embeddings = await embedBatch(batch, apiKey);
    const rows = batch.map((content, idx) => ({
      content,
      categoria: meta.categoria,
      tipo: meta.tipo,
      jurisdiccion: meta.jurisdiccion,
      fecha_vigencia: meta.fecha_vigencia,
      referencia: meta.referencia,
      source: meta.source,
      capitulo: meta.capitulo ?? null,
      metadata: meta,
      embedding: embeddings[idx],
    }));
    const { error } = await supabase.from(TABLE).insert(rows);
    if (error) {
      throw new Error(
        error.message.includes('schema cache') || error.message.includes('does not exist')
          ? `${error.message}. Ejecute migración 268 (ci_legal_knowledge).`
          : error.message,
      );
    }
    inserted += rows.length;
  }

  return { chunks: inserted, source: meta.source ?? null };
}
