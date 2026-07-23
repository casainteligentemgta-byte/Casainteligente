import { NextResponse } from 'next/server';
import { uploadSoporteCco, type CcoSoporteTipo } from '@/lib/contabilidad/cco/uploadSoporteCco';
import { supabaseAdminForRoute } from '@/lib/talento/supabase-admin';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/** POST multipart: file + tipo=factura|comprobante + gastoId? */
export async function POST(req: Request) {
  try {
    const admin = supabaseAdminForRoute();
    if (!admin.ok) return admin.response;

    const form = await req.formData();
    const file = form.get('file');
    if (!(file instanceof File)) {
      return NextResponse.json({ ok: false, error: 'Campo file requerido.' }, { status: 400 });
    }
    const tipoRaw = String(form.get('tipo') ?? 'factura').toLowerCase();
    const tipo: CcoSoporteTipo = tipoRaw === 'comprobante' ? 'comprobante' : 'factura';
    const gastoId = form.get('gastoId') != null ? String(form.get('gastoId')) : null;

    const maxMb = 12;
    if (file.size > maxMb * 1024 * 1024) {
      return NextResponse.json(
        { ok: false, error: `Archivo demasiado grande (máx. ${maxMb} MB).` },
        { status: 400 },
      );
    }

    const { path, publicUrl } = await uploadSoporteCco(admin.client, {
      file,
      fileName: file.name,
      contentType: file.type || 'application/octet-stream',
      tipo,
      gastoId,
    });

    return NextResponse.json({
      ok: true,
      path,
      url: publicUrl,
      tipo,
      campo: tipo === 'factura' ? 'link_factura' : 'link_comprobante',
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Error al subir soporte.';
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
