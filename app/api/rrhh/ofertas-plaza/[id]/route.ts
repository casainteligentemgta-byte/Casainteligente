import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requirePermisoRrhhAny } from '@/lib/rrhh/requirePermisoRrhh';
import { responderOfertaPlaza } from '@/lib/rrhh/ofertasPlaza';

export const runtime = 'nodejs';

const patchSchema = z.object({
  estado: z.enum(['aceptada', 'rechazada', 'caducada', 'asignada']),
  notas: z.string().max(2000).optional().nullable(),
});

/** PATCH — Registra respuesta del obrero (aceptó / rechazó plaza). */
export async function PATCH(req: Request, context: { params: { id: string } }) {
  const gate = await requirePermisoRrhhAny();
  if (!gate.ok) return gate.response;

  const id = (context.params?.id ?? '').trim();
  if (!id) return NextResponse.json({ error: 'id requerido' }, { status: 400 });

  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return NextResponse.json({ error: 'JSON inválido' }, { status: 400 });
  }

  const parsed = patchSchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json({ error: 'estado inválido' }, { status: 400 });
  }

  const out = await responderOfertaPlaza(
    gate.supabase,
    id,
    parsed.data.estado,
    parsed.data.notas,
  );

  if (!out.ok) {
    return NextResponse.json({ error: out.error }, { status: 500 });
  }

  return NextResponse.json({ ok: true, oferta: out.oferta });
}
