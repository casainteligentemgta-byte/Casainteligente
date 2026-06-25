import { NextResponse } from 'next/server';
import { requirePermisoWeb } from '@/lib/auth/requirePermisoRoute';
import { vincularProcurasFacturaContabilidad } from '@/lib/procuras/vincularProcurasFacturaContabilidad';
import { supabaseAdminForRoute } from '@/lib/talento/supabase-admin';

export const dynamic = 'force-dynamic';

function isUuid(v: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v);
}

/** POST — Vincula una o varias procuras aprobada(s) con la misma factura contable. */
export async function POST(req: Request) {
  const auth = await requirePermisoWeb('procura.ejecutar_compra');
  if (!auth.ok) {
    const alt = await requirePermisoWeb('procura.aprobar');
    if (!alt.ok) return auth.response;
  }

  let body: { procura_id?: string; procura_ids?: string[]; contabilidad_compra_id?: string };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: 'JSON inválido' }, { status: 400 });
  }

  const compraId = String(body.contabilidad_compra_id ?? '').trim();
  const procuraIds = Array.isArray(body.procura_ids)
    ? body.procura_ids.map((id) => String(id).trim()).filter(Boolean)
    : body.procura_id?.trim()
      ? [body.procura_id.trim()]
      : [];

  if (!isUuid(compraId) || !procuraIds.length || procuraIds.some((id) => !isUuid(id))) {
    return NextResponse.json(
      { error: 'contabilidad_compra_id y al menos un procura_id (o procura_ids) son obligatorios.' },
      { status: 400 },
    );
  }

  const admin = supabaseAdminForRoute();
  if (!admin.ok) return admin.response;

  try {
    const resultado = await vincularProcurasFacturaContabilidad(admin.client, {
      contabilidadCompraId: compraId,
      procuraIds,
    });

    if (!resultado.ok) {
      return NextResponse.json(
        {
          error: resultado.errores.join('\n') || 'No se pudo vincular ninguna procura.',
          errores: resultado.errores,
        },
        { status: 400 },
      );
    }

    return NextResponse.json({
      ok: true,
      contabilidad_compra_id: resultado.contabilidadCompraId,
      invoice_number: resultado.invoiceNumber,
      supplier_name: resultado.supplierName,
      vinculadas: resultado.vinculadas,
      tickets: resultado.vinculadas.map((v) => v.ticket),
      errores: resultado.errores.length ? resultado.errores : undefined,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'No se pudo vincular.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
