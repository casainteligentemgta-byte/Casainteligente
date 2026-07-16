import type { SupabaseClient } from '@supabase/supabase-js';

export const DESPACHO_MEDIA_BUCKET = 'ci-proyectos-media';

export type DespachoFotoRef = {
  storage_path: string;
  url: string;
};

function extFromFile(file: { name: string; type: string }): string {
  const fromName = file.name.split('.').pop()?.toLowerCase();
  if (fromName && fromName.length <= 5) return fromName;
  if (file.type === 'image/png') return 'png';
  if (file.type === 'image/webp') return 'webp';
  if (file.type === 'image/heic') return 'heic';
  return 'jpg';
}

export function buildDespachoFotoPath(proyectoId: string, file: File, index: number): string {
  const ext = extFromFile(file);
  return `despacho-web/${proyectoId}/${Date.now()}-${index}.${ext}`;
}

export async function uploadDespachoFoto(
  supabase: SupabaseClient,
  proyectoId: string,
  file: File,
  index: number,
): Promise<DespachoFotoRef> {
  if (!file.type.startsWith('image/')) {
    throw new Error('Solo se permiten imágenes.');
  }
  if (file.size > 12 * 1024 * 1024) {
    throw new Error('Cada foto debe pesar menos de 12 MB.');
  }

  const path = buildDespachoFotoPath(proyectoId, file, index);
  const { error } = await supabase.storage.from(DESPACHO_MEDIA_BUCKET).upload(path, file, {
    cacheControl: '3600',
    upsert: false,
    contentType: file.type || 'image/jpeg',
  });
  if (error) throw new Error(error.message);

  const { data } = supabase.storage.from(DESPACHO_MEDIA_BUCKET).getPublicUrl(path);
  return { storage_path: path, url: data.publicUrl };
}
