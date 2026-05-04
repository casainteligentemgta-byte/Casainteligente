import type { SupabaseClient } from '@supabase/supabase-js';

export const TALENTO_PUBLIC_BUCKET = 'talento-public';

function extFromName(name: string): string {
  const m = /\.([a-z0-9]+)$/i.exec(name);
  return (m?.[1] ?? 'jpg').toLowerCase();
}

export async function uploadTalentoPublicFile(
  supabase: SupabaseClient,
  params: { needId: string; stagingId: string; kind: 'perfil' | 'cedula'; file: File },
): Promise<{ publicUrl: string | null; error: string | null }> {
  const ext = extFromName(params.file.name);
  const path = `postulaciones/${params.needId}/${params.stagingId}/${params.kind}.${ext}`;
  const { error: upErr } = await supabase.storage.from(TALENTO_PUBLIC_BUCKET).upload(path, params.file, {
    cacheControl: '3600',
    upsert: true,
    contentType: params.file.type || undefined,
  });
  if (upErr) {
    return { publicUrl: null, error: upErr.message };
  }
  const { data } = supabase.storage.from(TALENTO_PUBLIC_BUCKET).getPublicUrl(path);
  const publicUrl = data?.publicUrl ?? null;
  return { publicUrl, error: publicUrl ? null : 'No se obtuvo URL pública.' };
}
