import { NextResponse } from 'next/server';
import { requireAccesoLegal } from '@/lib/legal/requireAccesoLegal';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: Request, ctx: Ctx) {
  const gate = await requireAccesoLegal();
  if (!gate.ok) return gate.response;
  const { id } = await ctx.params;

  const { data: caso, error } = await gate.admin
    .from('ci_legal_casos')
    .select('*')
    .eq('id', id)
    .eq('org_id', gate.acceso.orgId!)
    .maybeSingle();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!caso) return NextResponse.json({ error: 'Expediente no encontrado' }, { status: 404 });

  const [{ data: actuaciones }, { data: documentos }] = await Promise.all([
    gate.admin
      .from('ci_legal_actuaciones')
      .select('*')
      .eq('caso_id', id)
      .order('ocurrio_at', { ascending: false })
      .limit(100),
    gate.admin
      .from('ci_legal_documentos')
      .select('id, titulo, tipo, estado, contraparte, caso_id, plantilla_id, created_at, updated_at')
      .eq('org_id', gate.acceso.orgId!)
      .eq('caso_id', id)
      .order('updated_at', { ascending: false })
      .limit(100),
  ]);

  return NextResponse.json({
    ok: true,
    caso,
    expediente: caso,
    actuaciones: actuaciones ?? [],
    documentos: documentos ?? [],
  });
}

export async function PATCH(req: Request, ctx: Ctx) {
  const gate = await requireAccesoLegal();
  if (!gate.ok) return gate.response;
  const { id } = await ctx.params;

  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: 'JSON inválido' }, { status: 400 });
  }

  const allowed = [
    'titulo',
    'tipo',
    'ambito',
    'estado',
    'prioridad',
    'resumen',
    'contraparte',
    'contraparte_rif',
    'cliente_nombre',
    'proyecto_id',
    'entidad_id',
    'fecha_limite',
    'fecha_cierre',
    'codigo',
    'asignado_a',
  ] as const;

  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
  for (const k of allowed) {
    if (k in body) patch[k] = body[k];
  }

  if (patch.estado === 'resuelto' && patch.fecha_cierre == null) {
    patch.fecha_cierre = new Date().toISOString().slice(0, 10);
  }

  const { data, error } = await gate.admin
    .from('ci_legal_casos')
    .update(patch)
    .eq('id', id)
    .eq('org_id', gate.acceso.orgId!)
    .select('*')
    .maybeSingle();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data) return NextResponse.json({ error: 'Expediente no encontrado' }, { status: 404 });

  return NextResponse.json({ ok: true, caso: data, expediente: data });
}
