import { NextResponse } from 'next/server';
import type { ExtractedCanalHeader } from '@/lib/contabilidad/extractedCanal';
import { conciliarFrmConFacturaCanal } from '@/lib/contabilidad/conciliarFrmConFacturaCanal';
import { supabaseAdminForRoute } from '@/lib/talento/supabase-admin';

export const dynamic = 'force-dynamic';

function isUuid(v: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v);
}

type ConciliarFrmBody = {
  factura_id?: string;
  facturaCanalId?: string;
  recepcion_campo_id?: string;
  compraProvisionalId?: string;
  nroFacturaFiscal?: string;
  montoUsd?: number;
  montoVes?: number;
  extracted?: ExtractedCanalHeader;
};

export async function POST(req: Request) {
  let body: ConciliarFrmBody;
  try {
    body = (await req.json()) as ConciliarFrmBody;
  } catch {
    return NextResponse.json({ success: false, error: 'JSON inválido' }, { status: 400 });
  }

  const facturaCanalId = (body.facturaCanalId ?? body.factura_id ?? '').trim();
  let recepcionCampoId = (body.recepcion_campo_id ?? '').trim();
  const compraProvisionalId = (body.compraProvisionalId ?? '').trim();

  if (!isUuid(facturaCanalId)) {
    return NextResponse.json(
      { success: false, error: 'factura_id / facturaCanalId debe ser un UUID válido.' },
      { status: 400 },
    );
  }

  const admin = supabaseAdminForRoute();
  if (!admin.ok) return admin.response;

  if (!recepcionCampoId && isUuid(compraProvisionalId)) {
    const { data: recepcion } = await admin.client
      .from('ci_recepciones_campo')
      .select('id')
      .eq('contabilidad_compra_id', compraProvisionalId)
      .is('factura_canal_pendiente_id', null)
      .eq('estado', 'registrado')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    recepcionCampoId = String((recepcion as { id?: string } | null)?.id ?? '').trim();
  }

  if (!isUuid(recepcionCampoId)) {
    return NextResponse.json(
      {
        success: false,
        error: 'Faltan IDs requeridos: recepcion_campo_id o compraProvisionalId enlazable.',
      },
      { status: 400 },
    );
  }

  try {
    const result = await conciliarFrmConFacturaCanal(admin.client, {
      facturaCanalPendienteId: facturaCanalId,
      recepcionCampoId,
      extractedOverride: body.extracted,
      compraProvisionalId: compraProvisionalId || undefined,
      nroFacturaFiscal: body.nroFacturaFiscal,
      montoUsd: body.montoUsd,
      montoVes: body.montoVes,
    });

    return NextResponse.json({
      success: true,
      message: 'Conciliación FRM completada sin duplicar stock.',
      ...result,
      compraId: result.compraId,
      purchaseInvoiceId: result.purchaseInvoiceId,
      recepcionCampoId: result.recepcionCampoId,
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Error en conciliación';
    return NextResponse.json({ success: false, error: message }, { status: 400 });
  }
}
