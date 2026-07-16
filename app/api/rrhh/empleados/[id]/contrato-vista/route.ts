import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import {
  compilarContratoObreroDesdeEmpleadoId,
  parseOverridesContratoRequestBody,
} from '@/lib/talento/contratoObreroPdfContext';

export const runtime = 'nodejs';

async function compilarJson(id: string, overrides?: Record<string, string>) {
  const supabase = await createClient();
  const out = await compilarContratoObreroDesdeEmpleadoId(supabase, id, overrides);
  if (!out.ok) {
    return NextResponse.json({ error: out.error }, { status: 404 });
  }
  return NextResponse.json({
    texto: out.texto,
    faltantes: out.faltantes,
    tiene_datos_faltantes: out.faltantes.length > 0,
  });
}

/**
 * GET — Vista previa del contrato obrero rellenado (plantilla biblioteca + expediente del empleado).
 * No exige sesión; el acceso efectivo depende de RLS/políticas del cliente Supabase del servidor.
 */
export async function GET(_req: Request, context: { params: { id: string } }) {
  const id = (context.params?.id ?? '').trim();
  if (!id) {
    return NextResponse.json({ error: 'Falta id de empleado' }, { status: 400 });
  }

  try {
    return await compilarJson(id, undefined);
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Error interno';
    if (msg.includes('NEXT_PUBLIC_SUPABASE')) {
      return NextResponse.json({ error: 'Configuración Supabase incompleta en el servidor.' }, { status: 503 });
    }
    console.error('[contrato-vista]', e);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

/**
 * POST — Misma vista previa con `{ overrides: { CLAVE: "valor" } }` para simular datos manuales.
 */
export async function POST(req: Request, context: { params: { id: string } }) {
  const id = (context.params?.id ?? '').trim();
  if (!id) {
    return NextResponse.json({ error: 'Falta id de empleado' }, { status: 400 });
  }
  let overrides: Record<string, string> | undefined;
  try {
    const ct = (req.headers.get('content-type') ?? '').toLowerCase();
    if (ct.includes('application/json')) {
      const body = await req.json();
      overrides = parseOverridesContratoRequestBody(body);
    }
  } catch {
    /* ignore */
  }
  try {
    return await compilarJson(id, overrides);
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Error interno';
    if (msg.includes('NEXT_PUBLIC_SUPABASE')) {
      return NextResponse.json({ error: 'Configuración Supabase incompleta en el servidor.' }, { status: 503 });
    }
    console.error('[contrato-vista POST]', e);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
