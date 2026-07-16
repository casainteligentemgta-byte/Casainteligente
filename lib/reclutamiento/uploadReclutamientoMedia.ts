import type { SupabaseClient } from '@supabase/supabase-js';

const BUCKETS = ['ci-proyectos-media', 'product-media', 'productos'] as const;

/**
 * Sube un archivo al primer bucket de reclutamiento disponible y devuelve URL pública.
 */
export async function uploadToSupabaseReclutamientoBucket(
  supabase: SupabaseClient,
  path: string,
  file: File,
): Promise<{ url: string | null; error: string | null }> {
  for (const bucket of BUCKETS) {
    const { error } = await supabase.storage.from(bucket).upload(path, file, {
      cacheControl: '3600',
      upsert: false,
      contentType: file.type || undefined,
    });
    if (!error) {
      const { data } = supabase.storage.from(bucket).getPublicUrl(path);
      return { url: data.publicUrl ?? null, error: data.publicUrl ? null : 'No se obtuvo URL pública.' };
    }
    const msg = (error.message || '').toLowerCase();
    if (!(msg.includes('bucket') && msg.includes('not found'))) {
      return { url: null, error: error.message };
    }
  }
  return { url: null, error: 'No se encontró bucket para subir el archivo.' };
}

/** Foto de cédula en onboarding por token de registro. */
export async function uploadOnboardingCedulaPhoto(
  file: File,
  token: string,
  supabase: SupabaseClient,
): Promise<{ url: string | null; error: string | null }> {
  const ext = file.type === 'image/png' ? 'png' : 'jpg';
  const path = `reclutamiento/onboarding/${token}/${crypto.randomUUID()}.${ext}`;
  return uploadToSupabaseReclutamientoBucket(supabase, path, file);
}
