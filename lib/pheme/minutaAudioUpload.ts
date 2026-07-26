import {
  ALLOWED_AUDIO_MIME_TYPES,
  MAX_MINUTA_AUDIO_BYTES,
  MINUTA_RAPIDA_AUDIO_PREFIX,
  REUNIONES_AUDIO_BUCKET,
} from '@/lib/pheme/constants';

export function guessAudioMime(name: string): string | null {
  const n = name.toLowerCase();
  if (n.endsWith('.mp3')) return 'audio/mpeg';
  if (n.endsWith('.wav')) return 'audio/wav';
  if (n.endsWith('.m4a') || n.endsWith('.mp4')) return 'audio/mp4';
  if (n.endsWith('.ogg') || n.endsWith('.oga')) return 'audio/ogg';
  if (n.endsWith('.webm')) return 'audio/webm';
  if (n.endsWith('.flac')) return 'audio/flac';
  return null;
}

export function extFromAudioMime(mime: string): string {
  if (mime.includes('wav')) return '.wav';
  if (mime.includes('ogg')) return '.ogg';
  if (mime.includes('webm')) return '.webm';
  if (mime.includes('flac')) return '.flac';
  if (mime.includes('mp4') || mime.includes('m4a')) return '.m4a';
  return '.mp3';
}

function safeFileName(name: string): string {
  const base = name.replace(/[^\w.\-áéíóúñÁÉÍÓÚÑ ]+/g, '_').trim() || 'audio';
  return base.slice(0, 120);
}

/** Valida tamaño/MIME para Minuta rápida. Devuelve mensaje de error o null. */
export function validateMinutaAudio(
  fileSize: number,
  fileName: string,
  mimeType: string,
): string | null {
  if (!Number.isFinite(fileSize) || fileSize <= 0) return 'Archivo de audio vacío';
  if (fileSize > MAX_MINUTA_AUDIO_BYTES) {
    return `El audio supera el límite de ${Math.round(MAX_MINUTA_AUDIO_BYTES / (1024 * 1024))} MB`;
  }
  const mime = mimeType.trim().toLowerCase();
  const allowed = (ALLOWED_AUDIO_MIME_TYPES as readonly string[]).includes(mime);
  const looksAudio =
    mime.startsWith('audio/') ||
    mime === 'video/webm' ||
    /\.(mp3|m4a|wav|webm|ogg|flac|mp4)$/i.test(fileName);
  if (!allowed && !looksAudio) {
    return `Tipo de archivo no soportado: ${mime || 'desconocido'}`;
  }
  return null;
}

export function buildMinutaRapidaAudioPath(fileName: string, mimeType: string): string {
  const safe = safeFileName(fileName).replace(/\.[^.]+$/, '') || 'reunion';
  const ext = extFromAudioMime(mimeType);
  const id =
    typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
  return `${MINUTA_RAPIDA_AUDIO_PREFIX}/${id}/${Date.now()}-${safe}${ext}`;
}

export function isMinutaRapidaAudioPath(path: string): boolean {
  const p = path.trim().replace(/^\/+/, '');
  return (
    p.startsWith(`${MINUTA_RAPIDA_AUDIO_PREFIX}/`) &&
    !p.includes('..') &&
    p.split('/').length >= 3
  );
}

export const MINUTA_AUDIO_BUCKET = REUNIONES_AUDIO_BUCKET;
