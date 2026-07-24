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

/** Mensaje legible para errores de Storage (p. ej. «Object not found»). */
export function mensajeAmigableErrorStorage(
  msg: string,
  contexto: 'abrir' | 'subir' | 'copiar' = 'abrir',
): string {
  const raw = msg.trim();
  if (/bucket not found/i.test(raw)) {
    return 'El bucket procurement-documents no existe. Ejecute la migración 133 en Supabase.';
  }
  if (/not found|object not found|404/i.test(raw)) {
    if (contexto === 'subir') {
      return 'No se pudo guardar el archivo en Storage. Verifique el bucket procurement-documents.';
    }
    if (contexto === 'copiar') {
      return 'El comprobante ya no está en Storage (ruta antigua o archivo borrado).';
    }
    return 'El archivo ya no está en Storage (fue borrado o la ruta es incorrecta). Vuelva a adjuntar la factura.';
  }
  return raw || 'No se pudo acceder al documento en Storage.';
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
    throw new Error(mensajeAmigableErrorStorage(error.message, 'subir'));
  }

  return { path, fileName: file.name, mimeType };
}

/**
 * Copia un documento (p. ej. telegram-pending/…) a la carpeta de la factura de recepción.
 * Devuelve null si el origen no existe — no lanza error (el registro contable puede continuar).
 */
export async function copiarDocumentoProcurementAInvoice(
  supabase: SupabaseClient,
  params: {
    sourcePath: string;
    purchaseInvoiceId: string;
    fileName?: string | null;
    mimeType?: string | null;
  },
): Promise<{ path: string; fileName: string; mimeType: string } | null> {
  const src = params.sourcePath.trim();
  const invoiceId = params.purchaseInvoiceId.trim();
  if (!src || !invoiceId) return null;

  const { data: blob, error: dlErr } = await supabase.storage
    .from(PROCUREMENT_DOCUMENTS_BUCKET)
    .download(src);

  if (dlErr || !blob) {
    console.warn(
      '[copiarDocumentoProcurementAInvoice]',
      src,
      dlErr?.message ?? 'sin datos',
    );
    return null;
  }

  const ext = src.split('.').pop()?.toLowerCase() || 'jpg';
  const base = safeFileName(params.fileName ?? 'factura').replace(/\.[^.]+$/, '');
  const dest = `${invoiceId}/${Date.now()}-${base}.${ext}`;
  const contentType =
    params.mimeType?.trim() ||
    (ext === 'pdf' ? 'application/pdf' : 'image/jpeg');

  const buf = blob instanceof Blob ? await blob.arrayBuffer() : blob;
  const { error: upErr } = await supabase.storage
    .from(PROCUREMENT_DOCUMENTS_BUCKET)
    .upload(dest, buf, {
      cacheControl: '3600',
      upsert: true,
      contentType,
    });

  if (upErr) {
    console.warn('[copiarDocumentoProcurementAInvoice] upload', upErr.message);
    return null;
  }

  return {
    path: dest,
    fileName: params.fileName?.trim() || `${base}.${ext}`,
    mimeType: contentType,
  };
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
    throw new Error(
      mensajeAmigableErrorStorage(error?.message ?? '', 'abrir'),
    );
  }
  return data.signedUrl;
}
