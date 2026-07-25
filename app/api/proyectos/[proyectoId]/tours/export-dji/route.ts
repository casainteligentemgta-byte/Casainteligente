import { createClient } from '@/lib/supabase/server';
import {
  EXPORT_LAYOUTS_DJI,
  TOUR_SELECT,
  type ExportLayoutDji,
  type ObraTour,
} from '@/lib/proyectos/obraTours';
import {
  isValidProyectoUuid,
  mensajeProyectoIdInvalido,
} from '@/lib/proyectos/validarProyectoUuid';
import { formatErrorMessage } from '@/lib/utils/formatErrorMessage';
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

type Body = {
  job_id?: string;
  nombre?: string;
  export_layout?: string;
};

/**
 * Solicita (o registra stub de) export MP4 para DJI Goggles.
 * Con worker real, encola render; sin worker, crea tour en estado generando → listo stub.
 */
export async function POST(
  req: Request,
  { params }: { params: { proyectoId: string } },
) {
  const proyectoId = params?.proyectoId?.trim() ?? '';
  if (!isValidProyectoUuid(proyectoId)) {
    return NextResponse.json(
      { error: mensajeProyectoIdInvalido(proyectoId) },
      { status: 400 },
    );
  }

  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return NextResponse.json({ error: 'JSON inválido' }, { status: 400 });
  }

  const jobId = body.job_id?.trim();
  if (!jobId) {
    return NextResponse.json({ error: 'Falta job_id' }, { status: 400 });
  }

  const layoutRaw = (body.export_layout ?? 'hsbs').trim() as ExportLayoutDji;
  const layout: ExportLayoutDji = EXPORT_LAYOUTS_DJI.includes(layoutRaw)
    ? layoutRaw
    : 'hsbs';

  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    const { data: job, error: jobErr } = await supabase
      .from('ci_obra_tour_jobs')
      .select('id, estado, modelo_public_url, video_public_url')
      .eq('id', jobId)
      .eq('proyecto_id', proyectoId)
      .maybeSingle();

    if (jobErr) {
      return NextResponse.json({ error: jobErr.message }, { status: 500 });
    }
    if (!job) {
      return NextResponse.json({ error: 'Job no encontrado' }, { status: 404 });
    }
    if (!job.modelo_public_url) {
      return NextResponse.json(
        { error: 'El job aún no tiene modelo 3D' },
        { status: 409 },
      );
    }

    const hasWorker = Boolean(process.env.OBRA_TOURS_WORKER_URL?.trim());
    const nombre = body.nombre?.trim() || `Tour DJI (${layout})`;

    const { data: tour, error: tourErr } = await supabase
      .from('ci_obra_tours')
      .insert({
        proyecto_id: proyectoId,
        job_id: jobId,
        nombre,
        modo: 'automatico',
        estado: hasWorker ? 'generando' : 'listo',
        export_formato: 'mp4_h264',
        export_layout: layout,
        export_public_url: hasWorker ? null : job.video_public_url,
        dji_ready: !hasWorker,
        notas: hasWorker
          ? 'Export encolado en worker'
          : 'Stub: usa el video fuente como paquete provisional para microSD DJI. Conecta OBRA_TOURS_WORKER_URL para render estereoscópico real.',
        camera_path: [
          { t: 0, x: 0, y: 1.6, z: 0, yaw: 0, pitch: -5, fov: 70 },
          { t: 8, x: 4, y: 1.6, z: 2, yaw: 25, pitch: -8, fov: 70 },
          { t: 16, x: 2, y: 2.2, z: 6, yaw: -10, pitch: -12, fov: 65 },
        ],
        created_by: user?.id ?? null,
      })
      .select(TOUR_SELECT)
      .single();

    if (tourErr || !tour) {
      return NextResponse.json(
        { error: tourErr?.message ?? 'No se pudo crear el tour' },
        { status: 500 },
      );
    }

    if (!hasWorker) {
      await supabase
        .from('ci_obra_tour_jobs')
        .update({
          estado: 'listo',
          mensaje_estado: 'Tour DJI stub listo (video fuente)',
          finished_at: new Date().toISOString(),
        })
        .eq('id', jobId);
    } else {
      await supabase
        .from('ci_obra_tour_jobs')
        .update({
          estado: 'renderizando_tour',
          mensaje_estado: 'Renderizando tour para DJI Goggles…',
        })
        .eq('id', jobId);
    }

    return NextResponse.json(
      { tour: tour as ObraTour, stub: !hasWorker },
      { status: 201 },
    );
  } catch (e) {
    return NextResponse.json({ error: formatErrorMessage(e) }, { status: 500 });
  }
}
