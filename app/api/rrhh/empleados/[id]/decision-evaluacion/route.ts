import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requirePermisoRrhhAny } from '@/lib/rrhh/requirePermisoRrhh';
import { aplicarDecisionEvaluacionHumana } from '@/lib/rrhh/decisionEvaluacionHumana';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type Ctx = { params: { id: string } };

const bodySchema = z.object({
  decision: z.enum(['aprobado', 'rechazado']),
  notas: z.string().max(2000).optional().nullable(),
});

/** PATCH — OK humano post-test (Aprobar / Rechazar). */
export async function PATCH(req: Request, { params }: Ctx) {
  const empleadoId = (params.id ?? '').trim();
  if (!empleadoId) {
    return NextResponse.json({ error: 'id requerido' }, { status: 400 });
  }

  const gate = await requirePermisoRrhhAny();
  if (!gate.ok) return gate.response;

  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return NextResponse.json({ error: 'JSON inválido' }, { status: 400 });
  }

  const parsed = bodySchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Indique decision: aprobado | rechazado' },
      { status: 400 },
    );
  }

  const out = await aplicarDecisionEvaluacionHumana(
    gate.supabase,
    empleadoId,
    parsed.data.decision,
    parsed.data.notas,
  );

  if (!out.ok) {
    return NextResponse.json({ error: out.error }, { status: out.status });
  }

  return NextResponse.json({ ok: true, estado: out.estado, empleado_id: empleadoId });
}
