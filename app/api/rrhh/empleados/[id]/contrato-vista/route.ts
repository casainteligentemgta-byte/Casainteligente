import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { compilarContratoObreroDesdeEmpleadoId } from '@/lib/talento/contratoObreroPdfContext';

export const runtime = 'nodejs';

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
    const supabase = await createClient();
    const out = await compilarContratoObreroDesdeEmpleadoId(supabase, id);
    if (!out.ok) {
      return NextResponse.json({ error: out.error }, { status: 404 });
    }

    return NextResponse.json({
      texto: out.texto,
      faltantes: out.faltantes,
      tiene_datos_faltantes: out.faltantes.length > 0,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Error interno';
    if (msg.includes('NEXT_PUBLIC_SUPABASE')) {
      return NextResponse.json({ error: 'Configuración Supabase incompleta en el servidor.' }, { status: 503 });
    }
    console.error('[contrato-vista]', e);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
