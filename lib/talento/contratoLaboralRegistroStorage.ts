import { createElement } from 'react';
import { pdf } from '@react-pdf/renderer';
import type { SupabaseClient } from '@supabase/supabase-js';
import { ConstanciaAceptacionContratoLaboralPdf } from '@/lib/talento/ConstanciaAceptacionContratoLaboralPdf';

export const BUCKET_CONTRATOS_OBREROS = 'contratos_obreros';

/** Archiva el PDF de plantilla la primera vez (idempotente si ya hay ruta). */
export async function persistLaboralPlantillaPdfIfMissing(
  admin: SupabaseClient,
  contratoId: string,
  pdfBuffer: Buffer,
): Promise<{ path: string } | { skipped: true } | { error: string }> {
  const { data: row, error: sel } = await admin
    .from('ci_contratos_empleado_obra')
    .select('id, laboral_pdf_storage_path')
    .eq('id', contratoId)
    .maybeSingle();
  if (sel || !row) {
    return { error: sel?.message ?? 'Contrato no encontrado' };
  }
  const existing = String((row as { laboral_pdf_storage_path?: string | null }).laboral_pdf_storage_path ?? '').trim();
  if (existing) {
    return { skipped: true };
  }
  const path = `laboral/${contratoId}/contrato-plantilla.pdf`;
  const { error: up } = await admin.storage.from(BUCKET_CONTRATOS_OBREROS).upload(path, pdfBuffer, {
    contentType: 'application/pdf',
    upsert: true,
  });
  if (up) {
    console.error('[persistLaboralPlantillaPdfIfMissing] storage', up.message);
    return { error: up.message };
  }
  const ahora = new Date().toISOString();
  const { error: u2 } = await admin
    .from('ci_contratos_empleado_obra')
    .update({ laboral_pdf_storage_path: path, laboral_pdf_generado_at: ahora } as never)
    .eq('id', contratoId);
  if (u2) {
    console.error('[persistLaboralPlantillaPdfIfMissing] update', u2.message);
    return { error: u2.message };
  }
  return { path };
}

export type ConstanciaAceptacionParams = {
  nombreTrabajador: string;
  documento: string;
  contratoId: string;
  expedienteRef: string;
  aceptadoEnIso: string;
  ipCliente: string | null;
};

/** Genera y sube la constancia de aceptación electrónica; actualiza la fila del contrato. */
export async function generarYSubirConstanciaAceptacionLaboral(
  admin: SupabaseClient,
  params: ConstanciaAceptacionParams,
): Promise<{ path: string } | { error: string }> {
  const path = `laboral/${params.contratoId}/constancia-aceptacion.pdf`;
  try {
    const node = createElement(ConstanciaAceptacionContratoLaboralPdf, {
      nombreTrabajador: params.nombreTrabajador,
      documento: params.documento,
      contratoId: params.contratoId,
      expedienteRef: params.expedienteRef,
      aceptadoEnIso: params.aceptadoEnIso,
      ipCliente: params.ipCliente,
    });
    const blob = await pdf(node as Parameters<typeof pdf>[0]).toBlob();
    const buf = Buffer.from(await blob.arrayBuffer());
    const { error: up } = await admin.storage.from(BUCKET_CONTRATOS_OBREROS).upload(path, buf, {
      contentType: 'application/pdf',
      upsert: true,
    });
    if (up) {
      console.error('[generarYSubirConstanciaAceptacionLaboral]', up.message);
      return { error: up.message };
    }
    const { error: u2 } = await admin
      .from('ci_contratos_empleado_obra')
      .update({ laboral_constancia_aceptacion_storage_path: path } as never)
      .eq('id', params.contratoId);
    if (u2) {
      return { error: u2.message };
    }
    return { path };
  } catch (e) {
    console.error('[generarYSubirConstanciaAceptacionLaboral]', e);
    return { error: e instanceof Error ? e.message : 'Error al generar constancia' };
  }
}

export async function signedUrlContratoLaboralBucket(
  admin: SupabaseClient,
  storagePath: string,
  expiresSec: number,
): Promise<{ url: string } | { error: string }> {
  const { data, error } = await admin.storage.from(BUCKET_CONTRATOS_OBREROS).createSignedUrl(storagePath, expiresSec);
  if (error || !data?.signedUrl) {
    return { error: error?.message ?? 'No se pudo firmar URL' };
  }
  return { url: data.signedUrl };
}
