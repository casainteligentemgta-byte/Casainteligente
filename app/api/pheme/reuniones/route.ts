import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { uploadMeetingAudio } from '@/lib/pheme/uploadMeetingAudio';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const MIGRATION_HINT =
  'Ejecute la migración 297_ci_pheme_pipeline_embeddings.sql en Supabase (tablas reuniones/pheme + bucket reuniones-audio).';

/** GET — lista reuniones del usuario autenticado. */
export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user?.id) {
    return NextResponse.json({ error: 'Debe iniciar sesión' }, { status: 401 });
  }

  const { data, error } = await supabase
    .from('reuniones')
    .select(
      'id, titulo, estado, file_name, mime_type, file_size_bytes, duracion_segundos, created_at, updated_at, error_message',
    )
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(100);

  if (error) {
    const hint = error.message.includes('reuniones') ? ` ${MIGRATION_HINT}` : '';
    return NextResponse.json({ error: `${error.message}.${hint}` }, { status: 500 });
  }

  return NextResponse.json({ data: data ?? [] });
}

/**
 * POST multipart — sube audio y crea registro en `reuniones`.
 * Campos: file (requerido), titulo?, process?=1 para encadenar STT+Pheme.
 */
export async function POST(req: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user?.id) {
    return NextResponse.json({ error: 'Debe iniciar sesión' }, { status: 401 });
  }

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json({ error: 'Se esperaba multipart/form-data' }, { status: 400 });
  }

  const file = form.get('file');
  if (!(file instanceof File)) {
    return NextResponse.json({ error: 'Campo file requerido' }, { status: 400 });
  }

  const titulo = String(form.get('titulo') ?? '').trim();
  const autoProcess =
    String(form.get('process') ?? '').trim() === '1' ||
    String(form.get('process') ?? '').toLowerCase() === 'true';

  try {
    const uploaded = await uploadMeetingAudio(supabase, user.id, {
      file,
      fileName: file.name,
      mimeType: file.type,
      titulo: titulo || undefined,
    });

    if (!autoProcess) {
      return NextResponse.json({ data: uploaded }, { status: 201 });
    }

    const { processMeeting } = await import('@/lib/pheme/processMeeting');
    const result = await processMeeting(supabase, uploaded.reunionId);
    return NextResponse.json({ data: { ...uploaded, process: result } }, { status: 201 });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    const status =
      msg.includes('límite') || msg.includes('vacío') || msg.includes('no soportado')
        ? 400
        : 500;
    const hint = msg.includes('reuniones') || msg.includes('migración') ? ` ${MIGRATION_HINT}` : '';
    return NextResponse.json({ error: `${msg}.${hint}`.replace(/\.\s*\./g, '.') }, { status });
  }
}
