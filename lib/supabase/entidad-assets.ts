import type { SupabaseClient } from '@supabase/supabase-js';

function bucketsChain(): string[] {
  const fromEnv =
    typeof process !== 'undefined' ? process.env.NEXT_PUBLIC_SUPABASE_PROJECT_MEDIA_BUCKET?.trim() : undefined;
  const chain = [fromEnv, 'ci-proyectos-media', 'product-media', 'productos'].filter((b): b is string => Boolean(b));
  const seen = new Set<string>();
  return chain.filter((b) => (seen.has(b) ? false : (seen.add(b), true)));
}

function bucketNotFound(msg: string): boolean {
  const m = msg.toLowerCase();
  return m.includes('bucket not found') || (m.includes('not found') && m.includes('bucket'));
}

function extOf(file: File): string {
  const n = file.name.split('.').pop()?.toLowerCase();
  if (n && /^[a-z0-9]+$/.test(n)) return n;
  return 'png';
}

/**
 * Sube logo o sello del patrono bajo `ci-entidades/{entidadId}/…`.
 * Requiere bucket público (misma cadena que otros módulos).
 */
export async function uploadEntidadAsset(
  supabase: SupabaseClient,
  entidadId: string,
  kind: 'logo' | 'sello',
  file: File,
): Promise<{ publicUrl: string | null; error: string | null }> {
  const ext = extOf(file);
  const path = `ci-entidades/${entidadId}/${kind}-${crypto.randomUUID()}.${ext}`;
  let last = '';
  for (const bucket of bucketsChain()) {
    const { error } = await supabase.storage.from(bucket).upload(path, file, {
      cacheControl: '3600',
      upsert: false,
    });
    if (!error) {
      const { data } = supabase.storage.from(bucket).getPublicUrl(path);
      return { publicUrl: data.publicUrl, error: null };
    }
    last = error.message;
    if (!bucketNotFound(error.message)) return { publicUrl: null, error: error.message };
  }
  return {
    publicUrl: null,
    error: last || 'No hay bucket de almacenamiento disponible.',
  };
}
