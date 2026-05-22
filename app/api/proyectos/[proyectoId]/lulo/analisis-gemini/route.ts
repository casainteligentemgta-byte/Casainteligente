import { createClient } from '@/lib/supabase/server';
import { analizarPresupuestoPorCapitulosGemini } from '@/lib/proyectos/geminiAnalisisPresupuestoObra';
import { buildObraDataPresupuesto } from '@/lib/proyectos/mapObraDataPresupuesto';
import { ordenarPartidasPorCapitulos } from '@/lib/proyectos/luloCapitulos';
import { agruparPartidasPorCapitulo } from '@/components/proyectos/PresupuestoPorCapitulos';
import {
  isValidProyectoUuid,
  mensajeProyectoIdInvalido,
} from '@/lib/proyectos/validarProyectoUuid';
import { formatErrorMessage } from '@/lib/utils/formatErrorMessage';
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function POST(
  _req: Request,
  { params }: { params: { proyectoId: string } },
) {
  const proyectoId = params.proyectoId?.trim();
  if (!isValidProyectoUuid(proyectoId)) {
    return NextResponse.json({ error: mensajeProyectoIdInvalido() }, { status: 400 });
  }

  try {
    const supabase = await createClient();
    const { data: partidas, error } = await supabase
      .from('ci_presupuesto_partidas')
      .select('*')
      .eq('proyecto_id', proyectoId)
      .in('origen', ['lulo_csv', 'lulo_mdb'])
      .order('capitulo_orden', { ascending: true })
      .order('codigo_partida');

    if (error) throw new Error(formatErrorMessage(error));

    const { data: proyecto } = await supabase
      .from('ci_proyectos')
      .select('nombre, codigo_lulo, obra_cliente, obra_ubicacion, ubicacion_texto')
      .eq('id', proyectoId)
      .maybeSingle();

    const ordenadas = ordenarPartidasPorCapitulos(partidas ?? []);
    const obra = buildObraDataPresupuesto(ordenadas, proyecto, proyecto?.nombre, proyectoId);
    const grupos = agruparPartidasPorCapitulo(obra.partidas);
    const totalGeneral = grupos.reduce((s, g) => s + g.subtotal, 0);

    if (grupos.length === 0) {
      return NextResponse.json(
        { error: 'No hay partidas Lulo para analizar.' },
        { status: 400 },
      );
    }

    const out = await analizarPresupuestoPorCapitulosGemini({
      nombreObra: obra.nombre_obra,
      grupos,
      totalGeneral,
    });

    return NextResponse.json({
      texto: out.texto,
      desdeGemini: out.desdeGemini,
      totalGeneral,
      capitulos: grupos.length,
    });
  } catch (e) {
    console.error('[lulo/analisis-gemini]', e);
    return NextResponse.json(
      { error: formatErrorMessage(e) },
      { status: 500 },
    );
  }
}
