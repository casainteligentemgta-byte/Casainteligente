import type { SupabaseClient } from '@supabase/supabase-js';

/** Debe coincidir con el bucket en `012_products_manual_storage.sql` */
export const PRODUCT_MEDIA_BUCKET = 'product-media';

const MAX_IMAGE_BYTES = 8 * 1024 * 1024;
const MAX_PDF_BYTES = 10 * 1024 * 1024;

function extFromFile(file: File, allowed: string[], fallback: string) {
  const fromName = file.name.split('.').pop()?.toLowerCase();
  if (fromName && allowed.includes(fromName)) return fromName;
  const mime = file.type.split('/').pop()?.toLowerCase();
  if (mime && allowed.includes(mime)) return mime === 'jpeg' ? 'jpg' : mime;
  return fallback;
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
  const { error } = await supabase.storage.from(PRODUCT_MEDIA_BUCKET).upload(path, file, {
    cacheControl: '3600',
    upsert: false,
  });
  if (error) return { url: null, error: error.message };
  const { data } = supabase.storage.from(PRODUCT_MEDIA_BUCKET).getPublicUrl(path);
  return { url: data.publicUrl, error: null };
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
  const { error } = await supabase.storage.from(PRODUCT_MEDIA_BUCKET).upload(path, file, {
    cacheControl: '3600',
    upsert: false,
  });
  if (error) return { url: null, error: error.message };
  const { data } = supabase.storage.from(PRODUCT_MEDIA_BUCKET).getPublicUrl(path);
  return { url: data.publicUrl, error: null };
}
