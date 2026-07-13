import type { SupabaseClient } from '@supabase/supabase-js';

export const BUCKET_CONTRATOS = 'contratos';

/** `proyectos/{proyectoId}/{cedulaSanitizada}/contrato_borrador.pdf` */
export function storagePathContratoBorrador(proyectoId: string, cedula: string): string {
  const ced = sanitizarCedulaPath(cedula);
  return `proyectos/${proyectoId.trim()}/${ced}/contrato_borrador.pdf`;
}

export function storagePathContratoFirmado(proyectoId: string, cedula: string): string {
  const ced = sanitizarCedulaPath(cedula);
  return `proyectos/${proyectoId.trim()}/${ced}/contrato_firmado.pdf`;
}

function sanitizarCedulaPath(cedula: string): string {
  const s = cedula.trim().replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 48);
  return s || 'sin_cedula';
}

export async function subirPdfContratos(
  admin: SupabaseClient,
  path: string,
  pdfBuffer: Buffer,
  upsert = true,
): Promise<{ path: string } | { error: string }> {
  const { error } = await admin.storage.from(BUCKET_CONTRATOS).upload(path, pdfBuffer, {
    contentType: 'application/pdf',
    upsert,
  });
  if (error) return { error: error.message };
  return { path };
}

export async function signedUrlContratos(
  admin: SupabaseClient,
  path: string,
  expiresSec = 3600,
): Promise<{ url: string } | { error: string }> {
  const { data, error } = await admin.storage.from(BUCKET_CONTRATOS).createSignedUrl(path, expiresSec);
  if (error || !data?.signedUrl) {
    return { error: error?.message ?? 'No se pudo firmar URL' };
  }
  return { url: data.signedUrl };
}
