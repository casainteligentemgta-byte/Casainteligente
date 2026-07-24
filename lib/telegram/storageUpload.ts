import type { SupabaseClient } from '@supabase/supabase-js';
import { enviarMensajeTelegram } from '@/lib/telegram/botApi';

/** Sube un archivo a Supabase Storage y avisa por Telegram éxito o error. */
export async function subirArchivoStorageTelegram(params: {
  supabase: SupabaseClient;
  chatId: string;
  bucketName: string;
  fileName: string;
  buffer: Buffer;
  contentType: string;
  upsert?: boolean;
}): Promise<void> {
  const { error: storageError } = await params.supabase.storage
    .from(params.bucketName)
    .upload(params.fileName, params.buffer, {
      contentType: params.contentType,
      upsert: params.upsert ?? true,
    });

  if (storageError) {
    await enviarMensajeTelegram(
      params.chatId,
      '❌ Hubo un error al guardar la foto en el servidor. Por favor, intenta enviarla de nuevo.',
    );
    throw storageError;
  }

  await enviarMensajeTelegram(
    params.chatId,
    '📸 ¡Foto cargada exitosamente en el servidor de Casa Inteligente! Procesando datos...',
  );
}
