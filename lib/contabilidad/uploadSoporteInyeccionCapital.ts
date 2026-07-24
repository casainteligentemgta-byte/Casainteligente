import type { SupabaseClient } from '@supabase/supabase-js';
import {
  PROCUREMENT_DOCUMENTS_BUCKET,
  validateProcurementDocument,
} from '@/lib/almacen/procurementDocumentStorage';

function safeFileName(name: string): string {
  const base = name.replace(/[^\w.\-áéíóúñÁÉÍÓÚÑ ]+/g, '_').trim() || 'soporte';
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

export function buildInyeccionCapitalSoportePath(proyectoId: string, file: File): string {
  const ext = extFromFile(file);
  const safe = safeFileName(file.name).replace(/\.[^.]+$/, '');
  return `inyecciones-capital/${proyectoId}/${Date.now()}-${safe}.${ext}`;
}

export async function uploadSoporteInyeccionCapital(
  supabase: SupabaseClient,
  proyectoId: string,
  file: File,
): Promise<{ path: string; mimeType: string }> {
  const validation = validateProcurementDocument(file);
  if (validation) throw new Error(validation);

  const path = buildInyeccionCapitalSoportePath(proyectoId, file);
  const { error } = await supabase.storage.from(PROCUREMENT_DOCUMENTS_BUCKET).upload(path, file, {
    cacheControl: '3600',
    upsert: false,
    contentType: file.type || undefined,
  });
  if (error) throw new Error(error.message);

  return { path, mimeType: file.type || 'application/octet-stream' };
}
