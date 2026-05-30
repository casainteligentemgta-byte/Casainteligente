import { NextResponse } from 'next/server';
import type { ExtractedCanalHeader } from '@/lib/contabilidad/extractedCanal';
import { conciliarFrmConFacturaCanal } from '@/lib/contabilidad/conciliarFrmConFacturaCanal';
import { supabaseAdminForRoute } from '@/lib/talento/supabase-admin';

export const dynamic = 'force-dynamic';

function isUuid(v: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v);
}

export async function POST(req: Request) {
  let body: {
    factura_id?: string;
    recepcion_campo_id?: string;
    extracted?: ExtractedCanalHeader;
  };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: 'JSON inválido' }, { status: 400 });
  }

  const facturaId = body.factura_id?.trim() ?? '';
  const recepcionCampoId = body.recepcion_campo_id?.trim() ?? '';

  if (!isUuid(facturaId) || !isUuid(recepcionCampoId)) {
    return NextResponse.json(
      { error: 'factura_id y recepcion_campo_id deben ser UUID válidos.' },
      { status: 400 },
    );
  }

  const admin = supabaseAdminForRoute();
  if (!admin.ok) return admin.response;

  try {
    const result = await conciliarFrmConFacturaCanal(admin.client, {
      facturaCanalPendienteId: facturaId,
      recepcionCampoId,
      extractedOverride: body.extracted,
    });
    return NextResponse.json({ success: true, ...result });
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Error en conciliación';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
