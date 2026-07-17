import { createClient } from '@supabase/supabase-js';
import type { StorageAdapter, UploadInput, UploadResult } from './types';

const BUCKET =
  process.env.MI_ASISTENTE_AI_SUPABASE_BUCKET?.trim() || 'ci-asistente-ai';

/**
 * Fallback nativo de Casa Inteligente (Supabase Storage).
 * Requiere NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY y el bucket creado.
 */
export const supabaseAdapter: StorageAdapter = {
  id: 'supabase',
  label: 'Supabase (Casa Inteligente)',
  isConfigured() {
    return Boolean(
      process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() &&
        process.env.SUPABASE_SERVICE_ROLE_KEY?.trim(),
    );
  },
  async upload(input: UploadInput): Promise<UploadResult> {
    if (!this.isConfigured()) {
      throw new Error('Supabase no configurado para el asistente.');
    }

    const url = process.env.NEXT_PUBLIC_SUPABASE_URL!.trim();
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY!.trim();
    const supabase = createClient(url, key, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const safeName = input.fileName.replace(/[\\/]/g, '_');
    const path = `${input.chatId}/${Date.now()}_${safeName}`;

    const { error } = await supabase.storage.from(BUCKET).upload(path, input.buffer, {
      contentType: input.contentType,
      upsert: true,
    });
    if (error) throw error;

    const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);

    return {
      provider: 'supabase',
      path,
      url: data.publicUrl ?? null,
      message: `Archivo guardado en Casa Inteligente (Supabase): <b>${escapeHtml(safeName)}</b>`,
    };
  },
};

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
