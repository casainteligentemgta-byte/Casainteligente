import { NextResponse } from 'next/server';
import { requireAccesoLegal } from '@/lib/legal/requireAccesoLegal';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

type Ctx = { params: Promise<{ id: string }> };

/** GET — listar lapsos/tareas del caso. */
export async function GET(_req: Request, ctx: Ctx) {
  const gate = await requireAccesoLegal();
  if (!gate.ok) return gate.response;
  const { id: casoId } = await ctx.params;

  const { data: caso } = await gate.admin
    .from('ci_legal_casos')
    .select('id')
    .eq('id', casoId)
    .eq('org_id', gate.acceso.orgId!)
    .maybeSingle();
  if (!caso) return NextResponse.json({ error: 'Caso no encontrado' }, { status: 404 });

  const { data, error } = await gate.admin
    .from('ci_legal_tareas')
    .select('*')
    .eq('caso_id', casoId)
    .eq('org_id', gate.acceso.orgId!)
    .order('fecha_limite_lapso', { ascending: true });

  if (error) {
    return NextResponse.json(
      {
        error: error.message,
        hint: 'Ejecute la migración 281_ci_legal_tareas_lapsos.sql en Supabase SQL Editor.',
      },
      { status: 500 },
    );
  }

  return NextResponse.json({ ok: true, tareas: data ?? [] });
}

/** POST — crear lapso/tarea. */
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
  if (!caso) return NextResponse.json({ error: 'Caso no encontrado' }, { status: 404 });

  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: 'JSON inválido' }, { status: 400 });
  }

  const descripcion = String(body.descripcion ?? '').trim();
  const fechaLimite = String(body.fecha_limite_lapso ?? '').trim();
  if (!descripcion) {
    return NextResponse.json({ error: 'descripcion requerida' }, { status: 400 });
  }
  if (!fechaLimite) {
    return NextResponse.json({ error: 'fecha_limite_lapso requerida' }, { status: 400 });
  }

  const row = {
    org_id: gate.acceso.orgId!,
    caso_id: casoId,
    descripcion,
    tipo_actuacion: body.tipo_actuacion != null ? String(body.tipo_actuacion).trim() || null : null,
    fecha_limite_lapso: fechaLimite.includes('T')
      ? fechaLimite
      : `${fechaLimite}T23:59:59.000Z`,
    completada: Boolean(body.completada),
    responsable_abogado:
      body.responsable_abogado != null
        ? String(body.responsable_abogado).trim() || null
        : null,
  };

  const { data, error } = await gate.admin.from('ci_legal_tareas').insert(row).select('*').single();

  if (error) {
    return NextResponse.json(
      {
        error: error.message,
        hint: 'Ejecute la migración 281_ci_legal_tareas_lapsos.sql en Supabase SQL Editor.',
      },
      { status: 500 },
    );
  }

  await gate.admin
    .from('ci_legal_casos')
    .update({ updated_at: new Date().toISOString() })
    .eq('id', casoId);

  return NextResponse.json({ ok: true, tarea: data }, { status: 201 });
}
