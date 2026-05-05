import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { cargarFuentesContratoObreroPorEmpleadoId } from '@/lib/talento/contratoObreroPdfContext';
import {
  compilarPlantillaContratoObrero,
  construirMapaVariablesContratoObrero,
} from '@/lib/talento/plantillaContratoObreroCompile';
import { CONTRATO_OBRERO_CUERPO_DEFAULT } from '@/lib/talento/plantillas/contratoObreroDefaultCuerpo';

export const runtime = 'nodejs';

/**
 * GET — Vista previa del contrato obrero rellenado (plantilla biblioteca + expediente del empleado).
 * Requiere sesión Supabase (RRHH autenticado).
 */
export async function GET(_req: Request, context: { params: { id: string } }) {
  const id = (context.params?.id ?? '').trim();
  if (!id) {
    return NextResponse.json({ error: 'Falta id de empleado' }, { status: 400 });
  }

  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Inicia sesión para ver el contrato.' }, { status: 401 });
    }

    const fu = await cargarFuentesContratoObreroPorEmpleadoId(supabase, id);
    if (!fu.ok) {
      return NextResponse.json({ error: fu.error }, { status: 404 });
    }

    const { data: pl, error: pe } = await supabase
      .from('ci_documento_plantillas')
      .select('cuerpo')
      .eq('codigo', 'contrato_obrero')
      .eq('activo', true)
      .maybeSingle();

    if (pe) {
      console.warn('[contrato-vista] plantilla', pe.message);
    }

    const cuerpoRaw = (pl as { cuerpo?: string } | null)?.cuerpo;
    const cuerpo =
      typeof cuerpoRaw === 'string' && cuerpoRaw.trim().length > 80 ? cuerpoRaw.trim() : CONTRATO_OBRERO_CUERPO_DEFAULT;

    const mapa = construirMapaVariablesContratoObrero(fu.fuentes);
    const { texto, faltantes } = compilarPlantillaContratoObrero(cuerpo, mapa);

    return NextResponse.json({
      texto,
      faltantes,
      tiene_datos_faltantes: faltantes.length > 0,
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
