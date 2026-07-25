import { createClient } from '@/lib/supabase/server';
import {
  JOB_SELECT,
  TOUR_SELECT,
  type ObraTour,
  type ObraTourJob,
} from '@/lib/proyectos/obraTours';
import {
  isValidProyectoUuid,
  mensajeProyectoIdInvalido,
} from '@/lib/proyectos/validarProyectoUuid';
import { formatErrorMessage } from '@/lib/utils/formatErrorMessage';
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET(
  _req: Request,
  { params }: { params: { proyectoId: string } },
) {
  const proyectoId = params?.proyectoId?.trim() ?? '';
  if (!isValidProyectoUuid(proyectoId)) {
    return NextResponse.json(
      { error: mensajeProyectoIdInvalido(proyectoId) },
      { status: 400 },
    );
  }

  try {
    const supabase = await createClient();
    const [jobsRes, toursRes] = await Promise.all([
      supabase
        .from('ci_obra_tour_jobs')
        .select(JOB_SELECT)
        .eq('proyecto_id', proyectoId)
        .order('created_at', { ascending: false })
        .limit(50),
      supabase
        .from('ci_obra_tours')
        .select(TOUR_SELECT)
        .eq('proyecto_id', proyectoId)
        .order('created_at', { ascending: false })
        .limit(50),
    ]);

    if (jobsRes.error) {
      return NextResponse.json({ error: jobsRes.error.message }, { status: 500 });
    }
    if (toursRes.error) {
      return NextResponse.json({ error: toursRes.error.message }, { status: 500 });
    }

    return NextResponse.json({
      jobs: (jobsRes.data ?? []) as ObraTourJob[],
      tours: (toursRes.data ?? []) as ObraTour[],
    });
  } catch (e) {
    return NextResponse.json({ error: formatErrorMessage(e) }, { status: 500 });
  }
}
