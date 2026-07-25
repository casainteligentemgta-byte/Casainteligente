import { NextResponse } from 'next/server';
import { procesarReunionConPheme } from '@/lib/pheme/generarMinuta';
import { persistirReunionPheme } from '@/lib/pheme/persistirReunion';
import { procesarReunionDesdeAudio } from '@/lib/pheme/procesarReunionDesdeAudio';
import { supabaseAdminForRoute } from '@/lib/talento/supabase-admin';

export const runtime = 'nodejs';
/** Audio + Files API puede tardar (upload + PROCESSING + 2 llamadas Gemini). */
export const maxDuration = 120;

/**
 * POST /api/pheme/minuta
 *
 * JSON:
 *  - { titulo_reunion, transcripcion } — solo minuta
 *  - { titulo_reunion, audio_base64, mime_type?, duracion_minutos? } — audio→diarización→minuta
 *
 * multipart/form-data:
 *  - titulo_reunion, audio (File), duracion_minutos?
 */
export async function POST(req: Request) {
  const contentType = req.headers.get('content-type') ?? '';

  try {
    if (contentType.includes('multipart/form-data')) {
      return await handleMultipart(req);
    }
    return await handleJson(req);
  } catch (e) {
    const err = e as Error & { status?: number; retryable?: boolean };
    const status =
      typeof err.status === 'number' && err.status >= 400 && err.status < 600
        ? err.status
        : 500;
    console.error('[api/pheme/minuta]', err);
    return NextResponse.json(
      {
        error: err.message || 'Error al generar la minuta Pheme',
        retryable: Boolean(err.retryable),
      },
      { status },
    );
  }
}

async function handleMultipart(req: Request) {
  const form = await req.formData();
  const titulo =
    String(form.get('titulo_reunion') ?? form.get('titulo') ?? '').trim() || 'Sin título';
  const durRaw = form.get('duracion_minutos');
  const duracionMinutos =
    durRaw != null && String(durRaw).trim() !== ''
      ? Number(durRaw)
      : null;
  const guardar = String(form.get('guardar') ?? 'true') !== 'false';
  const file = form.get('audio');

  if (!(file instanceof File) || file.size === 0) {
    return NextResponse.json(
      { error: 'Falta archivo audio en multipart (campo «audio»)' },
      { status: 400 },
    );
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const mimeType = file.type || guessMime(file.name) || 'audio/mpeg';
  return runAudioFlow({
    titulo,
    buffer,
    mimeType,
    fileName: file.name,
    duracionMinutos: Number.isFinite(duracionMinutos as number) ? duracionMinutos : null,
    guardar,
  });
}

async function handleJson(req: Request) {
  let body: {
    titulo_reunion?: unknown;
    titulo?: unknown;
    transcripcion?: unknown;
    texto?: unknown;
    audio_base64?: unknown;
    mime_type?: unknown;
    mimeType?: unknown;
    file_name?: unknown;
    duracion_minutos?: unknown;
    guardar?: unknown;
  };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: 'JSON inválido' }, { status: 400 });
  }

  const titulo =
    (typeof body.titulo_reunion === 'string' && body.titulo_reunion.trim()) ||
    (typeof body.titulo === 'string' && body.titulo.trim()) ||
    'Sin título';
  const guardar = body.guardar !== false;
  const duracionMinutos =
    body.duracion_minutos == null || body.duracion_minutos === ''
      ? null
      : Number(body.duracion_minutos);

  const audioB64 =
    typeof body.audio_base64 === 'string' ? body.audio_base64.trim() : '';

  if (audioB64) {
    const mime =
      (typeof body.mime_type === 'string' && body.mime_type.trim()) ||
      (typeof body.mimeType === 'string' && body.mimeType.trim()) ||
      'audio/mpeg';
    const fileName =
      (typeof body.file_name === 'string' && body.file_name.trim()) || 'reunion.mp3';
    const buffer = Buffer.from(audioB64, 'base64');
    return runAudioFlow({
      titulo,
      buffer,
      mimeType: mime,
      fileName,
      duracionMinutos: Number.isFinite(duracionMinutos as number) ? duracionMinutos : null,
      guardar,
    });
  }

  const texto =
    typeof body.transcripcion === 'string'
      ? body.transcripcion
      : typeof body.texto === 'string'
        ? body.texto
        : '';

  if (!texto.trim()) {
    return NextResponse.json(
      { error: 'Indica transcripcion, audio_base64 o multipart audio' },
      { status: 400 },
    );
  }

  const out = await procesarReunionConPheme(titulo, texto);
  let reunionId: string | null = null;
  let idReunion: number | null = null;
  let avisoPersist: string | undefined;

  if (guardar) {
    const admin = supabaseAdminForRoute();
    if (admin.ok) {
      const saved = await persistirReunionPheme(admin.client, {
        titulo: out.titulo_reunion,
        transcripcion: texto.trim(),
        minuta: out.minuta,
        markdown: out.markdown,
        modelo: out.modelo ?? null,
        desdeGemini: out.desdeGemini,
        duracionMinutos: Number.isFinite(duracionMinutos as number) ? duracionMinutos : null,
      });
      reunionId = saved.id;
      idReunion = saved.idReunion;
      avisoPersist = saved.aviso;
    }
  }

  return NextResponse.json({
    ...out,
    reunion_id: reunionId,
    id_reunion: idReunion,
    transcripcion: texto.trim(),
    aviso: [out.aviso, avisoPersist].filter(Boolean).join(' ') || undefined,
    ...out.minuta,
  });
}

async function runAudioFlow(opts: {
  titulo: string;
  buffer: Buffer;
  mimeType: string;
  fileName: string;
  duracionMinutos: number | null;
  guardar: boolean;
}) {
  const admin = supabaseAdminForRoute();
  const supabase = admin.ok ? admin.client : null;

  const out = await procesarReunionDesdeAudio({
    tituloReunion: opts.titulo,
    buffer: opts.buffer,
    mimeType: opts.mimeType,
    fileName: opts.fileName,
    duracionMinutos: opts.duracionMinutos,
    supabase,
    guardar: opts.guardar && Boolean(supabase),
  });

  return NextResponse.json({
    ...out,
    ...out.minuta,
  });
}

function guessMime(name: string): string | null {
  const n = name.toLowerCase();
  if (n.endsWith('.mp3')) return 'audio/mpeg';
  if (n.endsWith('.wav')) return 'audio/wav';
  if (n.endsWith('.m4a')) return 'audio/mp4';
  if (n.endsWith('.ogg') || n.endsWith('.oga')) return 'audio/ogg';
  if (n.endsWith('.webm')) return 'audio/webm';
  if (n.endsWith('.mp4')) return 'audio/mp4';
  return null;
}
