import type { SupabaseClient } from '@supabase/supabase-js';
import { PDFDocument } from 'pdf-lib';
import { generarBufferContratoExpressPdf } from '@/lib/rrhh/expressContratoPdfBuffer';
import {
  descargarPdfDesdeStorage,
  primeraRutaStorageExpress,
} from '@/lib/rrhh/resolverContratoPdfServer';

export const MAX_CONTRATOS_PDF_LOTE = 80;

export type BufferPdfExpressResult =
  | { ok: true; id: string; buf: Buffer; nombre: string }
  | { ok: false; id: string; error: string; nombre?: string };

/** Obtiene el PDF de un contrato express (storage o generación). */
export async function bufferPdfContratoExpress(
  supabase: SupabaseClient,
  expressId: string,
): Promise<BufferPdfExpressResult> {
  const id = expressId.trim();
  if (!id) return { ok: false, id: expressId, error: 'Id vacío.' };

  const meta = await supabase
    .from('ci_contratos_express')
    .select('id,obrero_nombre')
    .eq('id', id)
    .maybeSingle();
  const nombre =
    ((meta.data as { obrero_nombre?: string | null } | null)?.obrero_nombre ?? '').trim() ||
    id.slice(0, 8);

  if (meta.error || !meta.data) {
    return { ok: false, id, error: meta.error?.message ?? 'Contrato no encontrado.', nombre };
  }

  const path = await primeraRutaStorageExpress(supabase, id, false);
  if (path) {
    const dl = await descargarPdfDesdeStorage(supabase, path);
    if (dl.ok) {
      return { ok: true, id, buf: Buffer.from(await dl.data.arrayBuffer()), nombre };
    }
  }

  const built = await generarBufferContratoExpressPdf(supabase, id);
  if (!built.ok) {
    return { ok: false, id, error: built.error, nombre };
  }
  return { ok: true, id, buf: built.buf, nombre };
}

/** Une varios PDF en uno solo (páginas en el orden de `buffers`). */
export async function unirBuffersPdf(buffers: Buffer[]): Promise<Uint8Array> {
  const merged = await PDFDocument.create();
  for (const buf of buffers) {
    const doc = await PDFDocument.load(buf, { ignoreEncryption: true });
    const pages = await merged.copyPages(doc, doc.getPageIndices());
    for (const page of pages) {
      merged.addPage(page);
    }
  }
  return merged.save();
}

export async function generarPdfUnicoContratosExpress(
  supabase: SupabaseClient,
  expressIds: string[],
): Promise<
  | { ok: true; pdf: Uint8Array; incluidos: number; omitidos: { id: string; nombre?: string; error: string }[] }
  | { ok: false; error: string }
> {
  const ids = Array.from(
    new Set(expressIds.map((s) => s.trim()).filter(Boolean)),
  );
  if (ids.length === 0) {
    return { ok: false, error: 'Seleccione al menos un contrato.' };
  }
  if (ids.length > MAX_CONTRATOS_PDF_LOTE) {
    return {
      ok: false,
      error: `Máximo ${MAX_CONTRATOS_PDF_LOTE} contratos por PDF único.`,
    };
  }

  const buffers: Buffer[] = [];
  const omitidos: { id: string; nombre?: string; error: string }[] = [];

  for (const id of ids) {
    const r = await bufferPdfContratoExpress(supabase, id);
    if (r.ok) {
      buffers.push(r.buf);
    } else {
      omitidos.push({ id: r.id, nombre: r.nombre, error: r.error });
    }
  }

  if (buffers.length === 0) {
    return {
      ok: false,
      error:
        omitidos[0]?.error ??
        'No se pudo obtener ningún PDF de los contratos seleccionados.',
    };
  }

  const pdf = await unirBuffersPdf(buffers);
  return { ok: true, pdf, incluidos: buffers.length, omitidos };
}
