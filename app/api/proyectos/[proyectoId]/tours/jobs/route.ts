import { createClient } from '@/lib/supabase/server';
import {
  CALIDADES_RECONSTRUCCION,
  FUENTES_CAPTURA,
  JOB_SELECT,
  type CalidadReconstruccion,
  type FuenteCaptura,
  type ObraTourJob,
} from '@/lib/proyectos/obraTours';
import {
  callbackUrlTours,
  encolarReconstruccionTour,
  nuevoCallbackToken,
} from '@/lib/proyectos/obraToursWorker';
import {
  isValidProyectoUuid,
  mensajeProyectoIdInvalido,
} from '@/lib/proyectos/validarProyectoUuid';
import { formatErrorMessage } from '@/lib/utils/formatErrorMessage';
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

type CreateJobBody = {
  fuente_captura?: string;
  calidad?: string;
  video_storage_bucket?: string | null;
  video_storage_path?: string | null;
  video_public_url?: string | null;
  video_bytes?: number | null;
  video_duracion_s?: number | null;
};

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

  let body: CreateJobBody;
  try {
    body = (await req.json()) as CreateJobBody;
  } catch {
    return NextResponse.json({ error: 'JSON inválido' }, { status: 400 });
  }

  const fuente = (body.fuente_captura ?? '').trim() as FuenteCaptura;
  if (!FUENTES_CAPTURA.includes(fuente)) {
    return NextResponse.json(
      { error: 'fuente_captura debe ser celular o dron' },
      { status: 400 },
    );
  }

  const calidadRaw = (body.calidad ?? 'rapida').trim() as CalidadReconstruccion;
  const calidad: CalidadReconstruccion = CALIDADES_RECONSTRUCCION.includes(calidadRaw)
    ? calidadRaw
    : 'rapida';

  const videoUrl = body.video_public_url?.trim() || null;
  if (!videoUrl) {
    return NextResponse.json(
      { error: 'Falta video_public_url (sube el video antes de crear el job)' },
      { status: 400 },
    );
  }

  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    const callbackToken = nuevoCallbackToken();
    const vercelHost = process.env.VERCEL_PROJECT_PRODUCTION_URL?.trim();
    const origin =
      process.env.NEXT_PUBLIC_APP_URL?.trim() ||
      (vercelHost ? `https://${vercelHost}` : new URL(req.url).origin);
    const callback_url = callbackUrlTours(origin);

    const worker_payload = {
      callback_token: callbackToken,
      callback_url,
      enqueued_at: new Date().toISOString(),
    };

    const { data: inserted, error } = await supabase
      .from('ci_obra_tour_jobs')
      .insert({
        proyecto_id: proyectoId,
        fuente_captura: fuente,
        calidad,
        estado: 'encolado',
        progreso_pct: 0,
        mensaje_estado: 'Video recibido; en cola de reconstrucción',
        video_storage_bucket: body.video_storage_bucket ?? null,
        video_storage_path: body.video_storage_path ?? null,
        video_public_url: videoUrl,
        video_bytes: body.video_bytes ?? null,
        video_duracion_s: body.video_duracion_s ?? null,
        worker_payload,
        created_by: user?.id ?? null,
      })
      .select(JOB_SELECT)
      .single();

    if (error || !inserted) {
      return NextResponse.json(
        { error: error?.message ?? 'No se pudo crear el job' },
        { status: 500 },
      );
    }

    const job = inserted as ObraTourJob;
    const enqueue = await encolarReconstruccionTour({
      job_id: job.id,
      proyecto_id: proyectoId,
      video_url: videoUrl,
      fuente_captura: fuente,
      calidad,
      callback_url,
      callback_token: callbackToken,
    });

    if (!enqueue.ok) {
      await supabase
        .from('ci_obra_tour_jobs')
        .update({
          estado: 'error',
          error_codigo: 'worker_enqueue_failed',
          error_detalle: enqueue.error,
          mensaje_estado: 'No se pudo encolar en el worker',
          finished_at: new Date().toISOString(),
        })
        .eq('id', job.id);

      return NextResponse.json(
        { error: enqueue.error, job_id: job.id },
        { status: 502 },
      );
    }

    if (enqueue.stub) {
      await supabase
        .from('ci_obra_tour_jobs')
        .update({
          mensaje_estado:
            'En cola (worker no configurado). Usa «Simular modelo» en desarrollo o define OBRA_TOURS_WORKER_URL.',
          worker_payload: {
            ...worker_payload,
            stub: true,
          },
        })
        .eq('id', job.id);
    }

    const { data: refreshed } = await supabase
      .from('ci_obra_tour_jobs')
      .select(JOB_SELECT)
      .eq('id', job.id)
      .single();

    return NextResponse.json(
      {
        job: (refreshed ?? job) as ObraTourJob,
        stub: enqueue.stub,
      },
      { status: 201 },
    );
  } catch (e) {
    return NextResponse.json({ error: formatErrorMessage(e) }, { status: 500 });
  }
}
