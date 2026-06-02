import { NextResponse } from 'next/server';
import { deleteCompraLineaRegistro } from '@/lib/contabilidad/deleteCompraLineaRegistro';
import { supabaseAdminForRoute } from '@/lib/talento/supabase-admin';

export const dynamic = 'force-dynamic';

/** DELETE — elimina una línea de contabilidad_compra_lineas (no la factura completa salvo que sea la única línea). */
export async function DELETE(
  _req: Request,
  { params }: { params: { id: string; lineaId: string } },
) {
  try {
    if (params.id.startsWith('canal-')) {
      return NextResponse.json(
        { error: 'Esta compra aún no está en contabilidad. Confírmela o elimine la factura pendiente.' },
        { status: 400 },
      );
    }

    const admin = supabaseAdminForRoute();
    if (!admin.ok) return admin.response;

    const result = await deleteCompraLineaRegistro(admin.client, params.id, params.lineaId);
    return NextResponse.json({ ok: true, ...result });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'No se pudo eliminar la línea.';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
