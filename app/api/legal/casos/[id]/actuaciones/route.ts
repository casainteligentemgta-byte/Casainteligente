import { NextResponse } from 'next/server';
import { requireAccesoLegal } from '@/lib/legal/requireAccesoLegal';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

type Ctx = { params: Promise<{ id: string }> };

/** POST — registrar actuación en el caso. */
export async function POST(req: Request, ctx: Ctx) {
  const gate = await requireAccesoLegal();
  if (!gate.ok) return gate.response;
  const { id: casoId } = await ctx.params;

  const { data: caso } = await gate.admin
    .from('ci_legal_casos')
    .select('id')
    .eq('id', casoId)
    .eq('org_id', gate.acceso.orgId!)
    .maybeSingle();

  if (!caso) return NextResponse.json({ error: 'Expediente no encontrado' }, { status: 404 });

  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: 'JSON inválido' }, { status: 400 });
  }

  const detalle = String(body.detalle ?? '').trim();
  const titulo = String(body.titulo ?? '').trim() || null;
  if (!detalle && !titulo) {
    return NextResponse.json({ error: 'Indique título o detalle' }, { status: 400 });
  }

  const row = {
    caso_id: casoId,
    org_id: gate.acceso.orgId!,
    tipo: String(body.tipo ?? 'nota').trim() || 'nota',
    titulo,
    detalle: detalle || null,
    ocurrio_at: body.ocurrio_at ? String(body.ocurrio_at) : new Date().toISOString(),
    creado_por: gate.userId,
  };

  const { data, error } = await gate.admin
    .from('ci_legal_actuaciones')
    .insert(row)
    .select('*')
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await gate.admin
    .from('ci_legal_casos')
    .update({ updated_at: new Date().toISOString() })
    .eq('id', casoId);

  return NextResponse.json({ ok: true, actuacion: data }, { status: 201 });
}
