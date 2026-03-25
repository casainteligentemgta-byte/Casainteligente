import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * Orden de buckets a probar al subir.
 * - `NEXT_PUBLIC_SUPABASE_PRODUCT_MEDIA_BUCKET` fuerza un nombre concreto (primero).
 * - Por defecto: product-media (migración 012), luego productos (migración 018).
 */
function storageBucketCandidates(): string[] {
  const fromEnv =
    typeof process !== 'undefined'
      ? process.env.NEXT_PUBLIC_SUPABASE_PRODUCT_MEDIA_BUCKET?.trim()
      : undefined;
  const chain = [fromEnv, 'product-media', 'productos'].filter(
    (b): b is string => Boolean(b),
  );
  // Sin spread de Set (tsconfig target es5 no permite iterar Set sin downlevelIteration)
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

const MAX_IMAGE_BYTES = 8 * 1024 * 1024;
const MAX_PDF_BYTES = 10 * 1024 * 1024;

function extFromFile(file: File, allowed: string[], fallback: string) {
  const fromName = file.name.split('.').pop()?.toLowerCase();
  if (fromName && allowed.includes(fromName)) return fromName;
  const mime = file.type.split('/').pop()?.toLowerCase();
  if (mime && allowed.includes(mime)) return mime === 'jpeg' ? 'jpg' : mime;
  return fallback;
}

/** True si el fallo es “bucket inexistente” y conviene probar otro nombre. */
function isBucketNotFoundError(err: { message?: string; statusCode?: string }): boolean {
  const m = (err.message ?? '').toLowerCase();
  const code = (err.statusCode ?? '').trim();
  if (code === '404') return true;
  return (
    m.includes('bucket not found') ||
    (m.includes('not found') && (m.includes('bucket') || m.includes('storage'))) ||
    (m.includes('no existe') && m.includes('bucket')) ||
    (m.includes('no se encontr') && m.includes('bucket')) ||
    (m.includes('does not exist') && m.includes('bucket'))
  );
}

async function uploadToFirstAvailableBucket(
  supabase: SupabaseClient,
  path: string,
  file: File,
  options: { cacheControl: string; upsert: boolean },
): Promise<{ url: string | null; error: string | null }> {
  const buckets = storageBucketCandidates();
  let lastMessage = '';

  for (const bucket of buckets) {
    const { error } = await supabase.storage.from(bucket).upload(path, file, options);
    if (!error) {
      const { data } = supabase.storage.from(bucket).getPublicUrl(path);
      return { url: data.publicUrl, error: null };
    }
    lastMessage = error.message;
    if (!isBucketNotFoundError(error)) {
      return { url: null, error: error.message };
    }
  }

  return {
    url: null,
    error:
      lastMessage ||
      `Ningún bucket disponible. En Supabase → SQL Editor ejecuta el archivo supabase/sql_editor_storage_fotos_productos.sql (crea product-media y productos).`,
  };
}

/**
 * Sube una imagen de producto y devuelve la URL pública.
 */
export async function uploadProductImage(
  supabase: SupabaseClient,
  file: File,
): Promise<{ url: string | null; error: string | null }> {
  if (!file.type.startsWith('image/')) {
    return { url: null, error: 'El archivo debe ser una imagen.' };
  }
  if (file.size > MAX_IMAGE_BYTES) {
    return { url: null, error: 'La imagen no debe superar 8 MB.' };
  }
  const ext = extFromFile(file, ['jpg', 'jpeg', 'png', 'webp', 'gif'], 'jpg');
  const path = `products/images/${crypto.randomUUID()}.${ext}`;
  const { url, error } = await uploadToFirstAvailableBucket(supabase, path, file, {
    cacheControl: '3600',
    upsert: false,
  });
  return { url, error };
}

/**
 * Sube un PDF (manual) y devuelve la URL pública.
 */
export async function uploadProductManualPdf(
  supabase: SupabaseClient,
  file: File,
): Promise<{ url: string | null; error: string | null }> {
  if (file.type !== 'application/pdf' && !file.name.toLowerCase().endsWith('.pdf')) {
    return { url: null, error: 'El manual debe ser un PDF.' };
  }
  if (file.size > MAX_PDF_BYTES) {
    return { url: null, error: 'El PDF no debe superar 10 MB.' };
  }
  const path = `products/manuals/${crypto.randomUUID()}.pdf`;
  const { url, error } = await uploadToFirstAvailableBucket(supabase, path, file, {
    cacheControl: '3600',
    upsert: false,
  });
  return { url, error };
}

/** Nombre del bucket preferido (solo informativo / compat). */
export const PRODUCT_MEDIA_BUCKET = 'product-media';
