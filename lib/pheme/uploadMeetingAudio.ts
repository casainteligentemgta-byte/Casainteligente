import type { SupabaseClient } from '@supabase/supabase-js';
import {
  ALLOWED_AUDIO_MIME_TYPES,
  MAX_AUDIO_BYTES,
  REUNIONES_AUDIO_BUCKET,
} from '@/lib/pheme/constants';
import type { UploadMeetingAudioResult } from '@/types/pheme';

export type UploadMeetingAudioInput = {
  file: File | Blob;
  fileName?: string;
  mimeType?: string;
  titulo?: string;
  reunionId?: string;
};

function safeFileName(name: string): string {
  const base = name.replace(/[^\w.\-áéíóúñÁÉÍÓÚÑ ]+/g, '_').trim() || 'audio';
  return base.slice(0, 120);
}

function extFromNameOrMime(fileName: string, mimeType: string): string {
  const fromName = fileName.split('.').pop()?.toLowerCase();
  if (fromName && fromName.length <= 5 && /^[a-z0-9]+$/.test(fromName)) {
    return fromName;
  }
  if (mimeType.includes('mpeg') || mimeType.includes('mp3')) return 'mp3';
  if (mimeType.includes('wav')) return 'wav';
  if (mimeType.includes('ogg')) return 'ogg';
  if (mimeType.includes('flac')) return 'flac';
  if (mimeType.includes('m4a') || mimeType.includes('mp4')) return 'm4a';
  if (mimeType.includes('webm')) return 'webm';
  return 'mp3';
}

export function validateMeetingAudio(
  file: File | Blob,
  fileName: string,
  mimeType: string,
): string | null {
  if (!file || file.size <= 0) return 'Archivo de audio vacío';
  if (file.size > MAX_AUDIO_BYTES) {
    return `El audio supera el límite de ${Math.round(MAX_AUDIO_BYTES / (1024 * 1024))} MB`;
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

export function buildMeetingAudioPath(
  userId: string,
  reunionId: string,
  fileName: string,
  mimeType: string,
): string {
  const safe = safeFileName(fileName).replace(/\.[^.]+$/, '');
  const ext = extFromNameOrMime(fileName, mimeType);
  return `${userId}/${reunionId}/${Date.now()}-${safe}.${ext}`;
}

/**
 * Sube la grabación al bucket `reuniones-audio` y crea/actualiza el registro en `reuniones`.
 */
export async function uploadMeetingAudio(
  supabase: SupabaseClient,
  userId: string,
  input: UploadMeetingAudioInput,
): Promise<UploadMeetingAudioResult> {
  if (!userId?.trim()) {
    throw new Error('user_id autenticado requerido');
  }

  const fileName =
    input.fileName?.trim() ||
    (input.file instanceof File && input.file.name ? input.file.name : 'reunion-audio.webm');
  const mimeType =
    input.mimeType?.trim() ||
    (input.file instanceof File && input.file.type ? input.file.type : 'audio/webm');

  const validation = validateMeetingAudio(input.file, fileName, mimeType);
  if (validation) throw new Error(validation);

  let reunionId = input.reunionId?.trim() || '';

  if (!reunionId) {
    const { data: created, error: createError } = await supabase
      .from('reuniones')
      .insert({
        user_id: userId,
        titulo: input.titulo?.trim() || fileName.replace(/\.[^.]+$/, '') || 'Reunión sin título',
        estado: 'pendiente',
      })
      .select('id')
      .single();

    if (createError || !created?.id) {
      throw new Error(
        createError?.message ||
          'No se pudo crear el registro en reuniones (¿migración 293 aplicada?)',
      );
    }
    reunionId = created.id as string;
  } else {
    const { data: existing, error: existingError } = await supabase
      .from('reuniones')
      .select('id, user_id')
      .eq('id', reunionId)
      .maybeSingle();
    if (existingError) throw new Error(existingError.message);
    if (!existing || existing.user_id !== userId) {
      throw new Error('Reunión no encontrada o sin permiso');
    }
  }

  const audioPath = buildMeetingAudioPath(userId, reunionId, fileName, mimeType);

  const { error: uploadError } = await supabase.storage
    .from(REUNIONES_AUDIO_BUCKET)
    .upload(audioPath, input.file, {
      cacheControl: '3600',
      upsert: false,
      contentType: mimeType || undefined,
    });

  if (uploadError) {
    if (!input.reunionId) {
      await supabase.from('reuniones').delete().eq('id', reunionId);
    }
    throw new Error(`Error al subir audio: ${uploadError.message}`);
  }

  const { error: updateError } = await supabase
    .from('reuniones')
    .update({
      audio_path: audioPath,
      audio_bucket: REUNIONES_AUDIO_BUCKET,
      mime_type: mimeType,
      file_name: fileName,
      file_size_bytes: input.file.size,
      estado: 'subida',
      error_message: null,
      ...(input.titulo?.trim() ? { titulo: input.titulo.trim() } : {}),
    })
    .eq('id', reunionId)
    .eq('user_id', userId);

  if (updateError) {
    throw new Error(`Audio subido pero falló actualizar reuniones: ${updateError.message}`);
  }

  return {
    reunionId,
    audioPath,
    bucket: REUNIONES_AUDIO_BUCKET,
    fileName,
    mimeType,
    fileSizeBytes: input.file.size,
  };
}
