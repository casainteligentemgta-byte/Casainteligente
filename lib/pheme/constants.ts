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
