/**
 * Upload de soportes CCO → bucket `comprobantes`.
 */
import type { SupabaseClient } from '@supabase/supabase-js';

export const CCO_COMPROBANTES_BUCKET = 'comprobantes';

export type CcoSoporteTipo = 'factura' | 'comprobante';

function safeName(name: string): string {
  return name
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9._-]+/g, '_')
    .slice(0, 120);
}

export async function uploadSoporteCco(
  supabase: SupabaseClient,
  opts: {
    file: File | Blob;
    fileName: string;
    contentType?: string;
    tipo: CcoSoporteTipo;
    gastoId?: string | number | null;
  },
): Promise<{ path: string; publicUrl: string }> {
  const ext = opts.fileName.includes('.')
    ? opts.fileName.slice(opts.fileName.lastIndexOf('.'))
    : '';
  const base = safeName(opts.fileName.replace(/\.[^.]+$/, '') || opts.tipo);
  const idPart = opts.gastoId != null ? String(opts.gastoId) : 'nuevo';
  const path = `cco/${opts.tipo}/${idPart}/${Date.now()}_${base}${ext}`;
  const contentType = opts.contentType || 'application/octet-stream';

  const { error } = await supabase.storage.from(CCO_COMPROBANTES_BUCKET).upload(path, opts.file, {
    contentType,
    upsert: false,
    cacheControl: '3600',
  });
  if (error) {
    throw new Error(
      /bucket not found/i.test(error.message)
        ? `${error.message} · Aplique migración 277 (bucket comprobantes).`
        : error.message,
    );
  }

  const { data } = supabase.storage.from(CCO_COMPROBANTES_BUCKET).getPublicUrl(path);
  return { path, publicUrl: data.publicUrl };
}
