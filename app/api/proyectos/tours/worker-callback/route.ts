import { createSupabaseAdminOnlyClient } from '@/lib/supabase/adminOnlyClient';
import { createClient } from '@/lib/supabase/server';
import { JOB_SELECT, type ObraTourJob, type WorkerReconstruccionCallback } from '@/lib/proyectos/obraTours';
import { formatErrorMessage } from '@/lib/utils/formatErrorMessage';
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

/**
 * Callback del worker GPU de reconstrucción.
 * Auth: header `X-Obra-Tours-Token` debe coincidir con worker_payload.callback_token.
 */
export async function POST(req: Request) {
  let body: WorkerReconstruccionCallback;
  try {
    body = (await req.json()) as WorkerReconstruccionCallback;
  } catch {
    return NextResponse.json({ error: 'JSON inválido' }, { status: 400 });
  }

  const jobId = body.job_id?.trim();
  if (!jobId) {
    return NextResponse.json({ error: 'Falta job_id' }, { status: 400 });
  }

  const token =
    req.headers.get('x-obra-tours-token')?.trim() ||
    req.headers.get('authorization')?.replace(/^Bearer\s+/i, '').trim() ||
    '';

  if (!token) {
    return NextResponse.json({ error: 'Falta token de callback' }, { status: 401 });
  }

  if (!['procesando', 'modelo_listo', 'error'].includes(body.estado)) {
    return NextResponse.json({ error: 'estado inválido' }, { status: 400 });
  }

  try {
    const admin = createSupabaseAdminOnlyClient();
    const supabase = admin ?? (await createClient());

    const { data: existing, error: loadErr } = await supabase
      .from('ci_obra_tour_jobs')
      .select(JOB_SELECT)
      .eq('id', jobId)
      .maybeSingle();

    if (loadErr) {
      return NextResponse.json({ error: loadErr.message }, { status: 500 });
    }
    if (!existing) {
      return NextResponse.json({ error: 'Job no encontrado' }, { status: 404 });
    }

    const job = existing as ObraTourJob;
    const expected = String(
      (job.worker_payload as { callback_token?: string } | null)?.callback_token ?? '',
    );
    if (!expected || expected !== token) {
      return NextResponse.json({ error: 'Token inválido' }, { status: 403 });
    }

    const patch: Record<string, unknown> = {
      estado: body.estado === 'modelo_listo' ? 'modelo_listo' : body.estado,
      mensaje_estado: body.mensaje_estado ?? null,
    };

    if (typeof body.progreso_pct === 'number' && Number.isFinite(body.progreso_pct)) {
      patch.progreso_pct = Math.max(0, Math.min(100, body.progreso_pct));
    }

    if (body.estado === 'procesando' && !job.started_at) {
      patch.started_at = new Date().toISOString();
    }

    if (body.estado === 'error') {
      patch.error_codigo = body.error_codigo ?? 'worker_error';
      patch.error_detalle = body.error_detalle ?? null;
      patch.finished_at = new Date().toISOString();
    }

    if (body.estado === 'modelo_listo' && body.modelo?.url) {
      patch.modelo_formato = body.modelo.formato;
      patch.modelo_public_url = body.modelo.url;
      patch.modelo_storage_bucket = body.modelo.storage_bucket ?? null;
      patch.modelo_storage_path = body.modelo.storage_path ?? null;
      patch.progreso_pct = body.progreso_pct ?? 100;
      patch.mensaje_estado = body.mensaje_estado ?? 'Modelo 3D listo para piloto / tour DJI';
      patch.finished_at = new Date().toISOString();
      patch.error_codigo = null;
      patch.error_detalle = null;
    }

    if (body.result && typeof body.result === 'object') {
      patch.worker_result = body.result;
    }

    const { data: updated, error: upErr } = await supabase
      .from('ci_obra_tour_jobs')
      .update(patch)
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
