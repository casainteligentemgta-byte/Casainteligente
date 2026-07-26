import { NextResponse } from 'next/server';
import type { SupabaseClient } from '@supabase/supabase-js';
import { REUNIONES_AUDIO_BUCKET } from '@/lib/pheme/constants';
import {
  extFromAudioMime,
  guessAudioMime,
  isMinutaRapidaAudioPath,
  validateMinutaAudio,
} from '@/lib/pheme/minutaAudioUpload';
import { procesarReunionDesdeAudio } from '@/lib/pheme/procesarReunionDesdeAudio';
import { friendlyStorageError } from '@/lib/supabase/friendlyStorageError';
import { supabaseAdminForRoute } from '@/lib/talento/supabase-admin';

export const runtime = 'nodejs';
/** Upload Gemini + PROCESSING + minuta + persist; Storage evita el 413 del body. */
export const maxDuration = 300;

/**
 * POST /api/pheme/procesar-audio
 *
 * 1) multipart (archivos pequeños / scripts):
 *    Form: titulo_reunion, duracion_minutos?, archivo_audio
 *
 * 2) JSON (recomendado; audio ya en Storage):
 *    { titulo_reunion, audio_path, bucket?, mime_type?, file_name?, duracion_minutos? }
 *
 * Respuesta:
 *   { status, id_reunion, minuta, transcripcion }
 */
export async function POST(req: Request) {
  const contentType = req.headers.get('content-type') ?? '';
  let tmpHint = '';
  try {
    if (contentType.includes('application/json')) {
      return await handleJson(req);
    }
    return await handleMultipart(req);
  } catch (e) {
    const err = e as Error & { status?: number };
    console.error('[api/pheme/procesar-audio]', tmpHint, err);
    const status =
      typeof err.status === 'number' && err.status >= 400 && err.status < 600
        ? err.status
        : 500;
    return NextResponse.json(
      { status: 'error', detail: err.message || 'Error al procesar audio' },
      { status },
    );
  }

  async function handleMultipart(request: Request) {
    let form: FormData;
    try {
      form = await request.formData();
    } catch {
      return NextResponse.json(
        {
          status: 'error',
          detail:
            'No se pudo leer el archivo (¿demasiado grande para el servidor?). ' +
            'La app sube el audio a Storage primero; recargue e intente de nuevo.',
        },
        { status: 413 },
      );
    }

    const titulo = String(form.get('titulo_reunion') ?? '').trim();
    if (!titulo) {
      return NextResponse.json(
        { status: 'error', detail: 'titulo_reunion es requerido' },
        { status: 400 },
      );
    }

    const duracionMinutos = parseDuracion(form.get('duracion_minutos'));
    if (duracionMinutos === 'invalid') {
      return NextResponse.json(
        { status: 'error', detail: 'duracion_minutos debe ser numérico' },
        { status: 400 },
      );
    }

    const file =
      form.get('archivo_audio') instanceof File
        ? (form.get('archivo_audio') as File)
        : form.get('audio') instanceof File
          ? (form.get('audio') as File)
          : null;

    if (!file || file.size === 0) {
      return NextResponse.json(
        {
          status: 'error',
          detail: 'archivo_audio es requerido (multipart/form-data)',
        },
        { status: 400 },
      );
    }

    tmpHint = file.name;
    const mimeType = file.type || guessAudioMime(file.name) || 'audio/mpeg';
    const validation = validateMinutaAudio(file.size, file.name, mimeType);
    if (validation) {
      return NextResponse.json({ status: 'error', detail: validation }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    return runFlow({
      titulo,
      buffer,
      mimeType,
      fileName: file.name || `reunion${extFromAudioMime(mimeType)}`,
      duracionMinutos,
    });
  }

  async function handleJson(request: Request) {
    let body: {
      titulo_reunion?: unknown;
      duracion_minutos?: unknown;
      audio_path?: unknown;
      bucket?: unknown;
      mime_type?: unknown;
      mimeType?: unknown;
      file_name?: unknown;
      fileName?: unknown;
    };
    try {
      body = (await request.json()) as typeof body;
    } catch {
      return NextResponse.json(
        { status: 'error', detail: 'JSON inválido' },
        { status: 400 },
      );
    }

    const titulo = String(body.titulo_reunion ?? '').trim();
    if (!titulo) {
      return NextResponse.json(
        { status: 'error', detail: 'titulo_reunion es requerido' },
        { status: 400 },
      );
    }

    const audioPath = String(body.audio_path ?? '').trim().replace(/^\/+/, '');
    if (!audioPath || !isMinutaRapidaAudioPath(audioPath)) {
      return NextResponse.json(
        {
          status: 'error',
          detail:
            'audio_path inválido. Obtenga una URL con POST /api/pheme/audio-upload-url y suba el archivo primero.',
        },
        { status: 400 },
      );
    }

    const bucket =
      (typeof body.bucket === 'string' && body.bucket.trim()) || REUNIONES_AUDIO_BUCKET;
    if (bucket !== REUNIONES_AUDIO_BUCKET) {
      return NextResponse.json(
        { status: 'error', detail: `bucket no permitido: ${bucket}` },
        { status: 400 },
      );
    }

    const fileName =
      (typeof body.file_name === 'string' && body.file_name.trim()) ||
      (typeof body.fileName === 'string' && body.fileName.trim()) ||
      audioPath.split('/').pop() ||
      'reunion.mp3';
    const mimeType =
      (typeof body.mime_type === 'string' && body.mime_type.trim()) ||
      (typeof body.mimeType === 'string' && body.mimeType.trim()) ||
      guessAudioMime(fileName) ||
      'audio/mpeg';

    const duracionMinutos = parseDuracion(body.duracion_minutos);
    if (duracionMinutos === 'invalid') {
      return NextResponse.json(
        { status: 'error', detail: 'duracion_minutos debe ser numérico' },
        { status: 400 },
      );
    }

    tmpHint = `${bucket}/${audioPath}`;

    const admin = supabaseAdminForRoute();
    if (!admin.ok) {
      return NextResponse.json(
        {
          status: 'error',
          detail:
            'Falta SUPABASE_SERVICE_ROLE_KEY / URL para leer el audio en Storage.',
        },
        { status: 503 },
      );
    }

    const { data: blob, error: dlError } = await admin.client.storage
      .from(bucket)
      .download(audioPath);

    if (dlError || !blob) {
      const raw = dlError?.message || 'No se pudo descargar el audio de Storage';
      return NextResponse.json(
        {
          status: 'error',
          detail: friendlyStorageError(bucket, raw),
        },
        { status: 502 },
      );
    }

    const buffer = Buffer.from(await blob.arrayBuffer());
    const validation = validateMinutaAudio(buffer.byteLength, fileName, mimeType);
    if (validation) {
      await safeRemove(admin.client, bucket, audioPath);
      return NextResponse.json({ status: 'error', detail: validation }, { status: 400 });
    }

    try {
      return await runFlow({
        titulo,
        buffer,
        mimeType,
        fileName,
        duracionMinutos,
        supabase: admin.client,
      });
    } finally {
      await safeRemove(admin.client, bucket, audioPath);
    }
  }

  async function runFlow(opts: {
    titulo: string;
    buffer: Buffer;
    mimeType: string;
    fileName: string;
    duracionMinutos: number | null;
    supabase?: SupabaseClient;
  }) {
    let supabase = opts.supabase;
    if (!supabase) {
      const admin = supabaseAdminForRoute();
      if (!admin.ok) {
        return NextResponse.json(
          {
            status: 'error',
            detail:
              'Falta SUPABASE_SERVICE_ROLE_KEY / URL para guardar en reuniones_pheme.',
          },
          { status: 503 },
        );
      }
      supabase = admin.client;
    }

    const out = await procesarReunionDesdeAudio({
      tituloReunion: opts.titulo,
      buffer: opts.buffer,
      mimeType: opts.mimeType,
      fileName: opts.fileName,
      duracionMinutos: opts.duracionMinutos,
      supabase,
      guardar: true,
    });

    if (out.id_reunion == null) {
      return NextResponse.json(
        {
          status: 'error',
          detail:
            out.aviso ||
            'Minuta generada pero no se obtuvo id_reunion. Aplica migración 292_reuniones_pheme.sql.',
          minuta: out.minuta,
          transcripcion: out.transcripcion,
        },
        { status: 502 },
      );
    }

    return NextResponse.json({
      status: 'success',
      id_reunion: out.id_reunion,
      minuta: out.minuta,
      transcripcion: out.transcripcion,
      markdown: out.markdown,
      titulo_reunion: out.titulo_reunion,
      modelo: out.modelo ?? null,
    });
  }
}

function parseDuracion(raw: unknown): number | null | 'invalid' {
  if (raw == null || String(raw).trim() === '') return null;
  const n = Number(raw);
  if (!Number.isFinite(n)) return 'invalid';
  return n;
}

async function safeRemove(
  client: SupabaseClient,
  bucket: string,
  path: string,
): Promise<void> {
  try {
    await client.storage.from(bucket).remove([path]);
  } catch (cleanupErr) {
    console.warn('[api/pheme/procesar-audio] no se pudo borrar audio temporal:', cleanupErr);
  }
}
