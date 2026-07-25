import { createClient } from '@/lib/supabase/server';
import { JOB_SELECT, type ObraTourJob } from '@/lib/proyectos/obraTours';
import {
  isValidProyectoUuid,
  mensajeProyectoIdInvalido,
} from '@/lib/proyectos/validarProyectoUuid';
import { formatErrorMessage } from '@/lib/utils/formatErrorMessage';
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

/**
 * Desarrollo / demo: marca el job como modelo_listo sin worker GPU.
 * Solo si el job está en stub (worker_payload.stub) o ALLOW_OBRA_TOURS_SIMULAR=1.
 */
export async function POST(
  _req: Request,
  { params }: { params: { proyectoId: string; jobId: string } },
) {
  const proyectoId = params?.proyectoId?.trim() ?? '';
  const jobId = params?.jobId?.trim() ?? '';
  if (!isValidProyectoUuid(proyectoId)) {
    return NextResponse.json(
      { error: mensajeProyectoIdInvalido(proyectoId) },
      { status: 400 },
    );
  }
  if (!jobId) {
    return NextResponse.json({ error: 'Falta jobId' }, { status: 400 });
  }

  try {
    const supabase = await createClient();
    const { data: existing, error } = await supabase
      .from('ci_obra_tour_jobs')
      .select(JOB_SELECT)
      .eq('id', jobId)
      .eq('proyecto_id', proyectoId)
      .maybeSingle();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    if (!existing) {
      return NextResponse.json({ error: 'Job no encontrado' }, { status: 404 });
    }

    const job = existing as ObraTourJob;
    const stub = Boolean((job.worker_payload as { stub?: boolean } | null)?.stub);
    const allow = process.env.ALLOW_OBRA_TOURS_SIMULAR === '1' || stub;
    if (!allow) {
      return NextResponse.json(
        {
          error:
            'Simulación deshabilitada. Configura OBRA_TOURS_WORKER_URL o ALLOW_OBRA_TOURS_SIMULAR=1.',
        },
        { status: 403 },
      );
    }

    const placeholderModelo =
      job.video_public_url ||
      'https://casainteligente.company/placeholder-obra-tour.glb';

    const { data: updated, error: upErr } = await supabase
      .from('ci_obra_tour_jobs')
      .update({
        estado: 'modelo_listo',
        progreso_pct: 100,
        mensaje_estado: 'Modelo simulado (sin worker GPU). Listo para modo piloto / tour.',
        modelo_formato: 'glb',
        modelo_public_url: placeholderModelo,
        started_at: job.started_at ?? new Date().toISOString(),
        worker_result: {
          simulated: true,
          note: 'Placeholder para probar UI piloto y export DJI stub',
        },
      })
      .eq('id', jobId)
      .select(JOB_SELECT)
      .single();

    if (upErr) {
      return NextResponse.json({ error: upErr.message }, { status: 500 });
    }

    return NextResponse.json({ job: updated as ObraTourJob });
  } catch (e) {
    return NextResponse.json({ error: formatErrorMessage(e) }, { status: 500 });
  }
}
