import { NextResponse } from 'next/server';
import { z } from 'zod';
import { formalizarContratoExpressPorId } from '@/lib/talento/formalizarContratoExpress';
import { supabaseAdminForRoute } from '@/lib/talento/supabase-admin';

export const runtime = 'nodejs';

const bodySchema = z.object({
  /** UUID de la fila en `ci_contratos_express` (alias “fast” del snippet). */
  contratoFastId: z.string().uuid(),
});

/**
 * POST `{ contratoFastId }` — Misma formalización que `POST /api/talento/contratos-express/[id]/formalizar`,
 * pero con cuerpo JSON como en plantillas legacy (`ci_contratos_fast` → en BD es `ci_contratos_express`).
 */
export async function POST(req: Request) {
  const admin = supabaseAdminForRoute();
  if (!admin.ok) return admin.response;

  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return NextResponse.json({ error: 'JSON inválido' }, { status: 400 });
  }

  const parsed = bodySchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'contratoFastId (UUID) requerido', details: parsed.error.flatten().fieldErrors },
      { status: 400 },
    );
  }

  const out = await formalizarContratoExpressPorId(admin.client, parsed.data.contratoFastId);
  if (!out.ok) {
    return NextResponse.json(
      { error: out.error, empleadoId: out.empleado_id ?? null },
      { status: out.status },
    );
  }

  return NextResponse.json({
    success: true,
    empleadoId: out.empleado_id,
    empleado_id: out.empleado_id,
  });
}
