import { NextResponse } from 'next/server';
import { requireAccesoLegal } from '@/lib/legal/requireAccesoLegal';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

type Ctx = { params: Promise<{ id: string; tareaId: string }> };

/** PATCH — actualizar lapso/tarea (completar, editar fecha, etc.). */
export async function PATCH(req: Request, ctx: Ctx) {
  const gate = await requireAccesoLegal();
  if (!gate.ok) return gate.response;
  const { id: casoId, tareaId } = await ctx.params;

  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: 'JSON inválido' }, { status: 400 });
  }

  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if ('descripcion' in body) {
    const d = String(body.descripcion ?? '').trim();
    if (!d) return NextResponse.json({ error: 'descripcion inválida' }, { status: 400 });
    patch.descripcion = d;
  }
  if ('tipo_actuacion' in body) {
    patch.tipo_actuacion =
      body.tipo_actuacion != null ? String(body.tipo_actuacion).trim() || null : null;
  }
  if ('fecha_limite_lapso' in body) {
    const f = String(body.fecha_limite_lapso ?? '').trim();
    if (!f) return NextResponse.json({ error: 'fecha_limite_lapso inválida' }, { status: 400 });
    patch.fecha_limite_lapso = f.includes('T') ? f : `${f}T23:59:59.000Z`;
  }
  if ('completada' in body) patch.completada = Boolean(body.completada);
  if ('responsable_abogado' in body) {
    patch.responsable_abogado =
      body.responsable_abogado != null
        ? String(body.responsable_abogado).trim() || null
        : null;
  }

  const { data, error } = await gate.admin
    .from('ci_legal_tareas')
    .update(patch)
    .eq('id', tareaId)
    .eq('caso_id', casoId)
    .eq('org_id', gate.acceso.orgId!)
    .select('*')
    .maybeSingle();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data) return NextResponse.json({ error: 'Tarea no encontrada' }, { status: 404 });

  await gate.admin
    .from('ci_legal_casos')
    .update({ updated_at: new Date().toISOString() })
    .eq('id', casoId);

  return NextResponse.json({ ok: true, tarea: data });
}

/** DELETE — eliminar lapso/tarea. */
export async function DELETE(_req: Request, ctx: Ctx) {
  const gate = await requireAccesoLegal();
  if (!gate.ok) return gate.response;
  const { id: casoId, tareaId } = await ctx.params;

  const { data, error } = await gate.admin
    .from('ci_legal_tareas')
    .delete()
    .eq('id', tareaId)
    .eq('caso_id', casoId)
    .eq('org_id', gate.acceso.orgId!)
    .select('id')
    .maybeSingle();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data) return NextResponse.json({ error: 'Tarea no encontrada' }, { status: 404 });

  return NextResponse.json({ ok: true });
}
