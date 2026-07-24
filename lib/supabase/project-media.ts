import type { SupabaseClient } from '@supabase/supabase-js';

function storageBucketCandidates(): string[] {
  const fromEnv =
    typeof process !== 'undefined'
      ? process.env.NEXT_PUBLIC_SUPABASE_PROJECT_MEDIA_BUCKET?.trim()
      : undefined;
  const chain = [fromEnv, 'ci-proyectos-media'].filter(
    (b): b is string => Boolean(b),
  );
  const seen = new Set<string>();
  const unique: string[] = [];
  for (const b of chain) {
    if (!seen.has(b)) {
      seen.add(b);
      unique.push(b);
    }
  }
  return unique;
}

function isBucketNotFoundError(err: { message?: string; statusCode?: string }): boolean {
  const m = (err.message ?? '').toLowerCase();
  const code = (err.statusCode ?? '').trim();
  if (code === '404') return true;
  return (
    m.includes('bucket not found') ||
    (m.includes('not found') && (m.includes('bucket') || m.includes('storage'))) ||
    (m.includes('no existe') && m.includes('bucket')) ||
    (m.includes('does not exist') && m.includes('bucket'))
  );
}

async function uploadToFirstAvailableBucket(
  supabase: SupabaseClient,
  path: string,
  file: File,
): Promise<{ bucket: string | null; url: string | null; error: string | null }> {
  const buckets = storageBucketCandidates();
  let lastMessage = '';
  for (const bucket of buckets) {
    const { error } = await supabase.storage.from(bucket).upload(path, file, {
      cacheControl: '3600',
      upsert: false,
    });
    if (!error) {
      const { data } = supabase.storage.from(bucket).getPublicUrl(path);
      return { bucket, url: data.publicUrl, error: null };
    }
    lastMessage = error.message;
    if (!isBucketNotFoundError(error)) {
      return { bucket: null, url: null, error: error.message };
    }
  }
  return {
    bucket: null,
    url: null,
    error:
      lastMessage ||
      'No se encontró bucket de proyectos. Ejecuta migración 038 para crear ci-proyectos-media.',
  };
}

function sanitizeExt(file: File, fallback: string): string {
  const n = file.name.split('.').pop()?.toLowerCase();
  if (n && /^[a-z0-9]+$/.test(n)) return n;
  return fallback;
}

export async function uploadProjectAsset(
  supabase: SupabaseClient,
  file: File,
  opts: { proyectoId: string; category: 'proyecto' | 'plano' | 'visita'; folderHint?: string },
): Promise<{ bucket: string | null; path: string | null; publicUrl: string | null; error: string | null }> {
  const ext = sanitizeExt(file, 'bin');
  const folder = opts.folderHint?.trim() || opts.category;
  const path = `ci-proyectos/${opts.proyectoId}/${folder}/${crypto.randomUUID()}.${ext}`;
  const up = await uploadToFirstAvailableBucket(supabase, path, file);
  if (up.error || !up.url || !up.bucket) {
    return { bucket: null, path: null, publicUrl: null, error: up.error ?? 'upload_error' };
  }
  return { bucket: up.bucket, path, publicUrl: up.url, error: null };
}

export const PROJECT_MEDIA_BUCKET = 'ci-proyectos-media';
