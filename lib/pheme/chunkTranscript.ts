import {
  PHEME_CHUNK_OVERLAP_WORDS,
  PHEME_CHUNK_TARGET_WORDS,
} from '@/lib/pheme/constants';

/**
 * Fragmenta la transcripción en chunks de ~500 palabras con solapamiento ligero.
 */
export function chunkTranscriptByWords(
  text: string,
  targetWords = PHEME_CHUNK_TARGET_WORDS,
  overlapWords = PHEME_CHUNK_OVERLAP_WORDS,
): string[] {
  const cleaned = (text || '').replace(/\s+/g, ' ').trim();
  if (!cleaned) return [];

  const words = cleaned.split(' ').filter(Boolean);
  if (words.length <= targetWords) return [cleaned];

  const step = Math.max(1, targetWords - Math.max(0, overlapWords));
  const chunks: string[] = [];

  for (let i = 0; i < words.length; i += step) {
    const slice = words.slice(i, i + targetWords);
    if (!slice.length) break;
    chunks.push(slice.join(' '));
    if (i + targetWords >= words.length) break;
  }

  return chunks;
}
