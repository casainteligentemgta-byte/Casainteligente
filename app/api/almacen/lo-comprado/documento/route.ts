import { NextResponse } from 'next/server';
import { createProcurementDocumentSignedUrl } from '@/lib/almacen/procurementDocumentStorage';
import { createClient } from '@/lib/supabase/server';
import { createSupabaseAdminOnlyClient } from '@/lib/supabase/adminOnlyClient';

import { requireAlgunPermisoWeb } from '@/lib/auth/requirePermisoRoute';
import { PERMISOS } from '@/lib/auth/permisosCatalogo';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * GET /api/almacen/lo-comprado/documento?compra_id=<uuid>
 * Devuelve una URL firmada (1 h) de la factura o nota de entrega de una compra.
 * Solo lectura; mismo control de acceso que el cuadro «Lo comprado».
 */
export async function GET(req: Request) {
  const acceso = await requireAlgunPermisoWeb(PERMISOS);
  if (!acceso.ok) return acceso.response;

  const compraId = new URL(req.url).searchParams.get('compra_id')?.trim() ?? '';
  if (!UUID_RE.test(compraId)) {
    return NextResponse.json({ ok: false, error: 'compra_id inválido.' }, { status: 400 });
  }

  try {
    const supabase = createSupabaseAdminOnlyClient() ?? (await createClient());
    const { data, error } = await supabase
      .from('contabilidad_compras')
      .select('document_storage_path')
      .eq('id', compraId)
      .maybeSingle();
    if (error) {
      return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    }
    const path = String((data as { document_storage_path?: string | null } | null)?.document_storage_path ?? '').trim();
    if (!path) {
      return NextResponse.json({ ok: false, error: 'Esta compra no tiene archivo adjunto.' }, { status: 404 });
    }
    const url = await createProcurementDocumentSignedUrl(supabase, path, 3600);
    return NextResponse.json({ ok: true, url });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'No se pudo abrir el documento.';
    console.error('[GET /api/almacen/lo-comprado/documento]', err);
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
