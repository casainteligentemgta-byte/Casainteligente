import { NextResponse } from 'next/server';
import { BUCKET_CONTRATOS_OBREROS } from '@/lib/talento/contratoLaboralRegistroStorage';
import { supabaseAdminForRoute } from '@/lib/talento/supabase-admin';

export const runtime = 'nodejs';

type ExpressRowPaths = {
  pdf_storage_path: string | null;
  pdf_firmado_storage_path?: string | null;
};

/**
 * DELETE — Elimina la fila en `ci_contratos_express` y los objetos asociados en Storage (borrador y firmado si existen).
 */
export async function DELETE(_req: Request, context: { params: { id: string } }) {
  const id = (context.params?.id ?? '').trim();
  if (!id) {
    return NextResponse.json({ error: 'id requerido' }, { status: 400 });
  }

  const admin = supabaseAdminForRoute();
  if (!admin.ok) return admin.response;

  let row: ExpressRowPaths | null = null;
  const full = await admin.client
    .from('ci_contratos_express')
    .select('id,pdf_storage_path,pdf_firmado_storage_path')
    .eq('id', id)
    .maybeSingle();

  if (full.error && /column|does not exist|42703/i.test(full.error.message)) {
    const lite = await admin.client.from('ci_contratos_express').select('id,pdf_storage_path').eq('id', id).maybeSingle();
    if (lite.error) {
      return NextResponse.json({ error: lite.error.message }, { status: 500 });
    }
    if (!lite.data) {
      return NextResponse.json({ error: 'Contrato express no encontrado' }, { status: 404 });
    }
    row = lite.data as ExpressRowPaths;
  } else if (full.error) {
    return NextResponse.json({ error: full.error.message }, { status: 500 });
  } else if (!full.data) {
    return NextResponse.json({ error: 'Contrato express no encontrado' }, { status: 404 });
  } else {
    row = full.data as ExpressRowPaths;
  }

  const paths = [row.pdf_storage_path, row.pdf_firmado_storage_path].filter(
    (p): p is string => typeof p === 'string' && p.trim().length > 0,
  );

  if (paths.length > 0) {
    const { error: rmErr } = await admin.client.storage.from(BUCKET_CONTRATOS_OBREROS).remove(paths);
    if (rmErr) {
      console.warn('[contratos-express DELETE] storage remove', rmErr.message);
    }
  }

  const { error: delErr } = await admin.client.from('ci_contratos_express').delete().eq('id', id);
  if (delErr) {
    console.error('[contratos-express DELETE] row', delErr.message);
    return NextResponse.json({ error: delErr.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
