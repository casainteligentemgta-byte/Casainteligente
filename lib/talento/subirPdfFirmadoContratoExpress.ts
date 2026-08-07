import type { SupabaseClient } from '@supabase/supabase-js';
import { BUCKET_CONTRATOS_OBREROS } from '@/lib/talento/contratoLaboralRegistroStorage';

const MAX_BYTES = 20 * 1024 * 1024;

const ALLOWED: Record<string, string> = {
  'application/pdf': 'pdf',
  'image/jpeg': 'jpg',
  'image/jpg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
};

export type SubirPdfFirmadoExpressOk = {
  ok: true;
  pdf_firmado_storage_path: string;
  pdf_firmado_subido_at: string;
};

export type SubirPdfFirmadoExpressFail = {
  ok: false;
  error: string;
  status: number;
};

function extFromMime(mime: string): string | null {
  const m = mime.toLowerCase().split(';')[0]?.trim() ?? '';
  return ALLOWED[m] ?? null;
}

function looksLikePdf(buf: Buffer): boolean {
  return buf.length >= 5 && buf.subarray(0, 5).toString('ascii') === '%PDF-';
}

function extFromFilename(name: string): string | null {
  const m = /\.([a-z0-9]+)$/i.exec(name.trim());
  if (!m) return null;
  const e = m[1]!.toLowerCase();
  if (e === 'pdf') return 'pdf';
  if (e === 'jpg' || e === 'jpeg') return 'jpg';
  if (e === 'png') return 'png';
  if (e === 'webp') return 'webp';
  return null;
}

/**
 * Sube escaneo (PDF/imagen) del contrato firmado y actualiza `ci_contratos_express`.
 */
export async function subirPdfFirmadoContratoExpress(
  admin: SupabaseClient,
  contratoId: string,
  file: Blob,
  opts?: { filename?: string | null },
): Promise<SubirPdfFirmadoExpressOk | SubirPdfFirmadoExpressFail> {
  const id = contratoId.trim();
  if (!id) {
    return { ok: false, error: 'id requerido', status: 400 };
  }

  if (file.size <= 0) {
    return { ok: false, error: 'Archivo vacío.', status: 400 };
  }
  if (file.size > MAX_BYTES) {
    return { ok: false, error: 'Archivo demasiado grande (máx. 20 MB).', status: 413 };
  }

  const mime = (file.type || 'application/octet-stream').toLowerCase();
  let ext = extFromMime(mime);
  if (!ext && opts?.filename) {
    ext = extFromFilename(opts.filename);
  }
  if (!ext) {
    return {
      ok: false,
      error: 'Tipo no permitido. Use PDF o imagen (JPEG, PNG, WEBP).',
      status: 400,
    };
  }

  const buf = Buffer.from(await file.arrayBuffer());
  if ((mime === 'application/pdf' || ext === 'pdf') && !looksLikePdf(buf)) {
    return { ok: false, error: 'El PDF no parece válido.', status: 400 };
  }

  const { data: exists, error: exErr } = await admin
    .from('ci_contratos_express')
    .select('id')
    .eq('id', id)
    .maybeSingle();
  if (exErr || !exists) {
    return {
      ok: false,
      error: exErr?.message ?? 'Contrato express no encontrado',
      status: 404,
    };
  }

  const storagePath = `express/${id}/contrato-firmado.${ext}`;
  const contentType =
    mime.startsWith('image/') || mime === 'application/pdf'
      ? mime.split(';')[0]?.trim() || 'application/octet-stream'
      : ext === 'pdf'
        ? 'application/pdf'
        : `image/${ext === 'jpg' ? 'jpeg' : ext}`;

  const { error: upErr } = await admin.storage.from(BUCKET_CONTRATOS_OBREROS).upload(storagePath, buf, {
    contentType,
    upsert: true,
  });
  if (upErr) {
    console.error('[pdf-firmado] storage', upErr.message);
    return { ok: false, error: upErr.message, status: 500 };
  }

  const subidoAt = new Date().toISOString();
  const patch = { pdf_firmado_storage_path: storagePath, pdf_firmado_subido_at: subidoAt };
  const { error: upRow } = await admin.from('ci_contratos_express').update(patch as never).eq('id', id);
  if (upRow) {
    if (/column|does not exist|42703/i.test(upRow.message)) {
      return {
        ok: false,
        error:
          'Faltan columnas en la base de datos. Ejecute la migración 127_ci_contratos_express_pdf_firmado en Supabase.',
        status: 503,
      };
    }
    console.error('[pdf-firmado] update', upRow.message);
    return { ok: false, error: upRow.message, status: 500 };
  }

  return {
    ok: true,
    pdf_firmado_storage_path: storagePath,
    pdf_firmado_subido_at: subidoAt,
  };
}
