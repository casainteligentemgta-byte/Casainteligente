import { NextResponse } from 'next/server';
import { requireAccesoLegal } from '@/lib/legal/requireAccesoLegal';
import { emailEsDuenioLegal } from '@/lib/legal/accesoLegal';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

type Ctx = { params: Promise<{ id: string }> | { id: string } };

/** POST — rechazar solicitud (dueño CI). Body: { notas? } */
export async function POST(req: Request, ctx: Ctx) {
  const gate = await requireAccesoLegal();
  if (!gate.ok) return gate.response;
  if (!emailEsDuenioLegal(gate.email) && gate.acceso.plan !== 'owner') {
    return NextResponse.json({ error: 'Solo el dueño CI puede rechazar' }, { status: 403 });
  }

  const { id } = await Promise.resolve(ctx.params);
  let body: Record<string, unknown> = {};
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    /* ok */
  }

  const { data, error } = await gate.admin
    .from('ci_legal_solicitudes')
    .update({
      estado: 'rechazada',
      revisado_por: gate.userId,
      revisado_at: new Date().toISOString(),
      notas_internas: body.notas != null ? String(body.notas) : null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
    .eq('estado', 'pendiente')
    .select('*')
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  if (!data) {
    return NextResponse.json({ error: 'Solicitud no encontrada o ya procesada' }, { status: 404 });
  }
  return NextResponse.json({ ok: true, solicitud: data });
}
