import type { SupabaseClient } from '@supabase/supabase-js';
import { PROCUREMENT_DOCUMENTS_BUCKET } from '@/lib/almacen/procurementDocumentStorage';

export type ParteDocumentoCanal = {
  orden: number;
  storage_path: string;
  mime_type: string;
  file_name: string;
  file_id?: string;
  telegram_message_id?: string;
};

export function parseDocumentParts(raw: unknown): ParteDocumentoCanal[] {
  if (!Array.isArray(raw)) return [];
  const parts: ParteDocumentoCanal[] = [];
  for (const item of raw) {
    if (!item || typeof item !== 'object') continue;
    const r = item as Record<string, unknown>;
    const storage_path = String(r.storage_path ?? '').trim();
    if (!storage_path) continue;
    parts.push({
      orden: Number(r.orden) || parts.length,
      storage_path,
      mime_type: String(r.mime_type ?? 'image/jpeg').trim() || 'image/jpeg',
      file_name: String(r.file_name ?? 'factura.jpg').trim() || 'factura.jpg',
      ...(r.file_id ? { file_id: String(r.file_id) } : {}),
      ...(r.telegram_message_id ? { telegram_message_id: String(r.telegram_message_id) } : {}),
    });
  }
  return parts.sort((a, b) => a.orden - b.orden);
}

export function archivosPendienteCanal(row: {
  document_storage_path?: string | null;
  document_mime_type?: string | null;
  document_file_name?: string | null;
  document_parts?: unknown;
}): Array<{ storagePath: string; mimeType: string; fileName: string; orden: number }> {
  const fromParts = parseDocumentParts(row.document_parts).map((p) => ({
    storagePath: p.storage_path,
    mimeType: p.mime_type,
    fileName: p.file_name,
    orden: p.orden,
  }));
  if (fromParts.length) return fromParts;
  const path = String(row.document_storage_path ?? '').trim();
  if (!path) return [];
  return [
    {
      storagePath: path,
      mimeType: String(row.document_mime_type ?? 'image/jpeg').trim() || 'image/jpeg',
      fileName: String(row.document_file_name ?? 'factura.jpg').trim() || 'factura.jpg',
      orden: 0,
    },
  ];
}

export async function descargarArchivosPendienteCanal(
  supabase: SupabaseClient,
  row: {
    document_storage_path?: string | null;
    document_mime_type?: string | null;
    document_file_name?: string | null;
    document_parts?: unknown;
  },
): Promise<Array<{ buffer: Buffer; mimeType: string; fileName: string; storagePath: string }>> {
  const lista = archivosPendienteCanal(row);
  const out: Array<{ buffer: Buffer; mimeType: string; fileName: string; storagePath: string }> = [];
  for (const a of lista) {
    const { data: blob, error } = await supabase.storage
      .from(PROCUREMENT_DOCUMENTS_BUCKET)
      .download(a.storagePath);
    if (error || !blob) {
      throw new Error(error?.message ?? `No se pudo descargar ${a.fileName}`);
    }
    out.push({
      buffer: Buffer.from(await blob.arrayBuffer()),
      mimeType: a.mimeType,
      fileName: a.fileName,
      storagePath: a.storagePath,
    });
  }
  return out;
}
