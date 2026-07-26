export const REUNIONES_AUDIO_BUCKET = 'reuniones-audio' as const;

export const PHEME_EMBEDDING_MODEL = 'text-embedding-3-small' as const;
export const PHEME_EMBEDDING_DIMS = 1536 as const;

/** ~500 palabras por chunk (aprox. 4 chars/palabra → ~2000 chars). */
export const PHEME_CHUNK_TARGET_WORDS = 500;
export const PHEME_CHUNK_OVERLAP_WORDS = 40;

export const PHEME_CHAT_MODEL_DEFAULT = 'gpt-4o-mini';

export const ALLOWED_AUDIO_MIME_TYPES = [
  'audio/mpeg',
  'audio/mp3',
  'audio/mp4',
  'audio/m4a',
  'audio/x-m4a',
  'audio/wav',
  'audio/wave',
  'audio/x-wav',
  'audio/webm',
  'audio/ogg',
  'audio/flac',
  'video/webm',
] as const;

export const MAX_AUDIO_BYTES = 25 * 1024 * 1024; // límite Whisper API

/** Tope práctico para Minuta rápida (Gemini Files); mismo UX que Whisper. */
export const MAX_MINUTA_AUDIO_BYTES = MAX_AUDIO_BYTES;

/**
 * Umbral bajo el que un multipart a Vercel suele fallar (límite ~4.5 MB).
 * La UI sube a Storage y procesa por path para archivos ≥ este tamaño.
 */
export const VERCEL_SAFE_BODY_BYTES = Math.floor(3.5 * 1024 * 1024);

/** Prefijo de objetos temporales de Minuta rápida en el bucket de audio. */
export const MINUTA_RAPIDA_AUDIO_PREFIX = 'minuta-rapida' as const;
