import { NextResponse } from 'next/server';
import {
  MAX_MINUTA_AUDIO_BYTES,
  REUNIONES_AUDIO_BUCKET,
} from '@/lib/pheme/constants';
import {
  buildMinutaRapidaAudioPath,
  guessAudioMime,
  validateMinutaAudio,
} from '@/lib/pheme/minutaAudioUpload';
import { friendlyStorageError } from '@/lib/supabase/friendlyStorageError';
import { supabaseAdminForRoute } from '@/lib/talento/supabase-admin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * POST /api/pheme/audio-upload-url
 *
 * Emite URL firmada para subir el audio directo a Supabase Storage
 * (evita el límite ~4.5 MB del body en Vercel).
 *
 * Body JSON: { file_name, mime_type?, file_size }
 */
export async function POST(req: Request) {
  let body: {
    file_name?: unknown;
    fileName?: unknown;
    mime_type?: unknown;
    mimeType?: unknown;
    file_size?: unknown;
    fileSize?: unknown;
  };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json(
      { status: 'error', detail: 'JSON inválido' },
      { status: 400 },
    );
  }

  const fileName =
    (typeof body.file_name === 'string' && body.file_name.trim()) ||
    (typeof body.fileName === 'string' && body.fileName.trim()) ||
    '';
  if (!fileName) {
    return NextResponse.json(
      { status: 'error', detail: 'file_name es requerido' },
      { status: 400 },
    );
  }

  const mimeType =
    (typeof body.mime_type === 'string' && body.mime_type.trim()) ||
    (typeof body.mimeType === 'string' && body.mimeType.trim()) ||
    guessAudioMime(fileName) ||
    'audio/mpeg';

  const fileSizeRaw = body.file_size ?? body.fileSize;
  const fileSize = Number(fileSizeRaw);
  if (!Number.isFinite(fileSize) || fileSize <= 0) {
    return NextResponse.json(
      { status: 'error', detail: 'file_size debe ser un número positivo' },
      { status: 400 },
    );
  }

  const validation = validateMinutaAudio(fileSize, fileName, mimeType);
  if (validation) {
    return NextResponse.json({ status: 'error', detail: validation }, { status: 400 });
  }

  const admin = supabaseAdminForRoute();
  if (!admin.ok) {
    return NextResponse.json(
      {
        status: 'error',
        detail:
          'Falta SUPABASE_SERVICE_ROLE_KEY / URL para emitir la URL de subida.',
      },
      { status: 503 },
    );
  }

  const path = buildMinutaRapidaAudioPath(fileName, mimeType);

  try {
    const { data, error } = await admin.client.storage
      .from(REUNIONES_AUDIO_BUCKET)
      .createSignedUploadUrl(path);

    if (error || !data?.signedUrl || !data?.token || !data?.path) {
      const raw = error?.message || 'No se pudo crear URL firmada de subida';
      return NextResponse.json(
        {
          status: 'error',
          detail: friendlyStorageError(REUNIONES_AUDIO_BUCKET, raw),
        },
        { status: 502 },
      );
    }

    return NextResponse.json({
      status: 'success',
      bucket: REUNIONES_AUDIO_BUCKET,
      path: data.path,
      token: data.token,
      signedUrl: data.signedUrl,
      mime_type: mimeType,
      file_name: fileName,
      max_bytes: MAX_MINUTA_AUDIO_BYTES,
    });
  } catch (e) {
    const err = e as Error;
    console.error('[api/pheme/audio-upload-url]', err);
    return NextResponse.json(
      {
        status: 'error',
        detail: friendlyStorageError(
          REUNIONES_AUDIO_BUCKET,
          err.message || 'Error al crear URL de subida',
        ),
      },
      { status: 500 },
    );
  }
}
