import { NextResponse } from 'next/server';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { supabaseAdminForRoute } from '@/lib/talento/supabase-admin';
import { CATALOGO_FASES_TECNICAS_OBRA } from '@/lib/talento/catalogoFasesTecnicasObra';
import {
  listarFasesTecnicasContrato,
  recordarFaseTecnicaUsada,
  trimFaseTecnica,
} from '@/lib/talento/fasesTecnicasContrato';

export const runtime = 'nodejs';

const postSchema = z.object({
  texto: z.string().min(2).max(4000),
  proyecto_id: z.string().uuid().optional().nullable(),
});

/** GET — catálogo fijo + fases usadas (sugerencias para contratos/obras). */
export async function GET() {
  const supabase = await createClient();
  const fases = await listarFasesTecnicasContrato(supabase, 100);
  return NextResponse.json({
    ok: true,
    fases,
    catalogo: CATALOGO_FASES_TECNICAS_OBRA,
  });
}

/**
 * POST — graba una fase técnica en el catálogo (y opcionalmente como default de la obra).
 * Body: { texto, proyecto_id? }
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

  const parsed = postSchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json({ error: 'texto requerido (2–4000 caracteres)' }, { status: 400 });
  }

  const texto = trimFaseTecnica(parsed.data.texto);
  if (!texto) {
    return NextResponse.json({ error: 'Fase técnica inválida' }, { status: 400 });
  }

  const result = await recordarFaseTecnicaUsada(admin.client, texto, {
    proyectoId: parsed.data.proyecto_id ?? null,
  });
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 500 });
  }

  const fases = await listarFasesTecnicasContrato(admin.client, 100);
  return NextResponse.json({
    ok: true,
    texto: result.texto,
    fases,
    catalogo: CATALOGO_FASES_TECNICAS_OBRA,
  });
}
