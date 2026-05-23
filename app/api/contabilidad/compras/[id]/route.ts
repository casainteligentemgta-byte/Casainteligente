import { NextResponse } from 'next/server';
import { deleteCompraRegistro } from '@/lib/contabilidad/deleteCompraRegistro';
import { supabaseAdminForRoute } from '@/lib/talento/supabase-admin';

export const dynamic = 'force-dynamic';

/** DELETE compra en contabilidad (+ recepción). ?duplicados=1 incluye mismo nº factura. ?canalId= uuid telegram. */
export async function DELETE(req: Request, { params }: { params: { id: string } }) {
  try {
    const admin = supabaseAdminForRoute();
    if (!admin.ok) return admin.response;

    const { searchParams } = new URL(req.url);
    const incluirDuplicados = searchParams.get('duplicados') === '1';
    const canalId = searchParams.get('canalId')?.trim() || null;

    const result = await deleteCompraRegistro(admin.client, params.id, {
      incluirDuplicadosMismaFactura: incluirDuplicados,
    });

    if (canalId) {
      const { error: canalErr } = await admin.client
        .from('ci_facturas_canal_pendientes')
        .delete()
        .eq('id', canalId);
      if (canalErr) {
        console.warn('[DELETE compra] canal:', canalErr.message);
      }
    }

    return NextResponse.json({ ok: true, ...result });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'No se pudo eliminar la compra.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
