import type { SupabaseClient } from '@supabase/supabase-js';

export const PROCUREMENT_DOCUMENTS_BUCKET = 'procurement-documents';

const MAX_BYTES = 12 * 1024 * 1024;

const ALLOWED_MIME = new Set([
  'application/pdf',
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
  'image/heic',
  'image/heif',
]);

function safeFileName(name: string): string {
  const base = name.replace(/[^\w.\-áéíóúñÁÉÍÓÚÑ ]+/g, '_').trim() || 'documento';
  return base.slice(0, 120);
}

function extFromFile(file: { name: string; type: string }): string {
  const fromName = file.name.split('.').pop()?.toLowerCase();
  if (fromName && fromName.length <= 5) return fromName;
  if (file.type === 'application/pdf') return 'pdf';
  if (file.type === 'image/png') return 'png';
  if (file.type === 'image/webp') return 'webp';
  return 'jpg';
}

export function validateProcurementDocument(file: File): string | null {
  const mime = file.type?.toLowerCase() || '';
  const okMime =
    ALLOWED_MIME.has(mime) ||
    mime.startsWith('image/') ||
    file.name.toLowerCase().endsWith('.pdf');
  if (!okMime) {
    return 'Formato no soportado. Use PDF o imagen (JPG, PNG, WEBP).';
  }
  if (file.size > MAX_BYTES) {
    return 'El archivo supera el límite de 12 MB.';
  }
  return null;
}

export function buildProcurementDocumentPath(invoiceId: string, file: File): string {
  const ext = extFromFile(file);
  const safe = safeFileName(file.name).replace(/\.[^.]+$/, '');
  return `${invoiceId}/${Date.now()}-${safe}.${ext}`;
}

export async function uploadProcurementDocument(
  supabase: SupabaseClient,
  invoiceId: string,
  file: File
): Promise<{ path: string; fileName: string; mimeType: string }> {
  const validation = validateProcurementDocument(file);
  if (validation) throw new Error(validation);

  const path = buildProcurementDocumentPath(invoiceId, file);
  const mimeType =
    file.type?.trim() ||
    (path.endsWith('.pdf') ? 'application/pdf' : 'image/jpeg');

  const { error } = await supabase.storage
    .from(PROCUREMENT_DOCUMENTS_BUCKET)
    .upload(path, file, {
      cacheControl: '3600',
      upsert: true,
      contentType: mimeType,
    });

  if (error) {
    throw new Error(`No se pudo guardar el archivo: ${error.message}`);
  }

  return { path, fileName: file.name, mimeType };
}

export async function createProcurementDocumentSignedUrl(
  supabase: SupabaseClient,
  storagePath: string,
  expiresSec = 3600
): Promise<string> {
  const { data, error } = await supabase.storage
    .from(PROCUREMENT_DOCUMENTS_BUCKET)
    .createSignedUrl(storagePath, expiresSec);

  if (error || !data?.signedUrl) {
    throw new Error(error?.message || 'No se pudo abrir el documento.');
  }
  return data.signedUrl;
}
