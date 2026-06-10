import { NextResponse } from 'next/server';
import { reintentarContabilidadRecepcionCampo } from '@/lib/contabilidad/contabilidadRecepcionCampoSync';
import { actualizarProcuraDesdeRecepcionCampo } from '@/lib/procuras/actualizarProcuraDesdeRecepcion';
import { supabaseAdminForRoute } from '@/lib/talento/supabase-admin';

export const dynamic = 'force-dynamic';

function isUuid(v: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v);
}

/** POST — Reintenta sync contable para recepción con stock ya ingresado (D-08). */
export async function POST(
  _req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const { id } = await ctx.params;
  const recepcionId = id?.trim() ?? '';

  if (!isUuid(recepcionId)) {
    return NextResponse.json({ error: 'ID de recepción inválido.' }, { status: 400 });
  }

  const admin = supabaseAdminForRoute();
  if (!admin.ok) return admin.response;

  const result = await reintentarContabilidadRecepcionCampo(admin.client, recepcionId);

  if (!result.ok) {
    const status = result.yaSincronizada ? 409 : 400;
    return NextResponse.json(
      {
        ok: false,
        error: result.error,
        ya_sincronizada: result.yaSincronizada ?? false,
      },
      { status },
    );
  }

  const { data: recepcion } = await admin.client
    .from('ci_recepciones_campo')
    .select('procura_id')
    .eq('id', recepcionId)
    .maybeSingle();

  const procuraId = String((recepcion as { procura_id?: string | null } | null)?.procura_id ?? '').trim() || null;
  const procura = procuraId
    ? await actualizarProcuraDesdeRecepcionCampo(admin.client, {
        recepcionId,
        procuraId,
      })
    : null;

  return NextResponse.json({
    ok: true,
    compra_id: result.compraId,
    ya_existia: result.yaExistia,
    provisional: result.provisional,
    ...(procura
      ? {
          procura: {
            actualizado: procura.actualizado,
            ticket: procura.ticket,
            estado: procura.estadoNuevo,
            error: procura.error,
          },
        }
      : {}),
  });
}
