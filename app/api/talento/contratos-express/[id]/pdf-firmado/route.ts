import { NextResponse } from 'next/server';
import { BUCKET_CONTRATOS_OBREROS } from '@/lib/talento/contratoLaboralRegistroStorage';
import { supabaseAdminForRoute } from '@/lib/talento/supabase-admin';

export const runtime = 'nodejs';

const MAX_BYTES = 20 * 1024 * 1024;

const ALLOWED: Record<string, string> = {
  'application/pdf': 'pdf',
  'image/jpeg': 'jpg',
  'image/jpg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
};

function extFromMime(mime: string): string | null {
  const m = mime.toLowerCase().split(';')[0]?.trim() ?? '';
  return ALLOWED[m] ?? null;
}

function looksLikePdf(buf: Buffer): boolean {
  return buf.length >= 5 && buf.subarray(0, 5).toString('ascii') === '%PDF-';
}

/**
 * POST — Sube PDF o imagen (escaneo) del contrato firmado por el obrero; guarda ruta en `ci_contratos_express`.
 * Cuerpo: `multipart/form-data` con campo `file`.
 */
export async function POST(req: Request, context: { params: { id: string } }) {
  const id = (context.params?.id ?? '').trim();
  if (!id) {
    return NextResponse.json({ error: 'id requerido' }, { status: 400 });
  }

  const admin = supabaseAdminForRoute();
  if (!admin.ok) return admin.response;

  const { data: exists, error: exErr } = await admin.client.from('ci_contratos_express').select('id').eq('id', id).maybeSingle();
  if (exErr || !exists) {
    return NextResponse.json({ error: exErr?.message ?? 'Contrato express no encontrado' }, { status: 404 });
  }

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json({ error: 'FormData inválido' }, { status: 400 });
  }

  const file = form.get('file');
  if (!file || !(file instanceof Blob)) {
    return NextResponse.json({ error: 'Adjunte el archivo en el campo «file».' }, { status: 400 });
  }

  if (file.size > MAX_BYTES) {
    return NextResponse.json({ error: 'Archivo demasiado grande (máx. 20 MB).' }, { status: 413 });
  }

  const mime = (file.type || 'application/octet-stream').toLowerCase();
  const ext = extFromMime(mime);
  if (!ext) {
    return NextResponse.json(
      { error: 'Tipo no permitido. Use PDF o imagen (JPEG, PNG, WEBP).' },
      { status: 400 },
    );
  }

  const buf = Buffer.from(await file.arrayBuffer());
  if (mime === 'application/pdf' && !looksLikePdf(buf)) {
    return NextResponse.json({ error: 'El PDF no parece válido.' }, { status: 400 });
  }

  const storagePath = `express/${id}/contrato-firmado.${ext}`;
  const contentType = mime.split(';')[0]?.trim() || 'application/octet-stream';

  const { error: upErr } = await admin.client.storage.from(BUCKET_CONTRATOS_OBREROS).upload(storagePath, buf, {
    contentType,
    upsert: true,
  });
  if (upErr) {
    console.error('[pdf-firmado] storage', upErr.message);
    return NextResponse.json({ error: upErr.message }, { status: 500 });
  }

  const subidoAt = new Date().toISOString();
  const patch = { pdf_firmado_storage_path: storagePath, pdf_firmado_subido_at: subidoAt };

  const { error: upRow } = await admin.client.from('ci_contratos_express').update(patch as never).eq('id', id);
  if (upRow) {
    if (/column|does not exist|42703/i.test(upRow.message)) {
      return NextResponse.json(
        {
          error:
            'Faltan columnas en la base de datos. Ejecute la migración 127_ci_contratos_express_pdf_firmado en Supabase.',
        },
        { status: 503 },
      );
    }
    console.error('[pdf-firmado] update', upRow.message);
    return NextResponse.json({ error: upRow.message }, { status: 500 });
  }

  return NextResponse.json({
    ok: true,
    pdf_firmado_storage_path: storagePath,
    pdf_firmado_subido_at: subidoAt,
  });
}
