import { NextResponse } from 'next/server';
import {
  generarMinutaDesdeAudio,
  generarMinutaDesdeTexto,
} from '@/lib/pheme/generarMinuta';

/**
 * POST /api/pheme/minuta
 * Body:
 *  - { transcripcion: string }  ó  { texto: string }
 *  - ó { audio_base64: string, mime_type?: string }
 *
 * Pheme: resume reunión → puntos clave → acuerdos → alertas.
 */
export async function POST(req: Request) {
  let body: {
    transcripcion?: unknown;
    texto?: unknown;
    audio_base64?: unknown;
    mime_type?: unknown;
    mimeType?: unknown;
  };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: 'JSON inválido' }, { status: 400 });
  }

  const audioB64 =
    typeof body.audio_base64 === 'string' ? body.audio_base64.trim() : '';
  const texto =
    typeof body.transcripcion === 'string'
      ? body.transcripcion
      : typeof body.texto === 'string'
        ? body.texto
        : '';

  try {
    if (audioB64) {
      const mime =
        (typeof body.mime_type === 'string' && body.mime_type.trim()) ||
        (typeof body.mimeType === 'string' && body.mimeType.trim()) ||
        'audio/ogg';
      const out = await generarMinutaDesdeAudio({ base64: audioB64, mimeType: mime });
      return NextResponse.json(out);
    }

    if (!texto.trim()) {
      return NextResponse.json(
        { error: 'Indica transcripcion (texto) o audio_base64' },
        { status: 400 },
      );
    }

    const out = await generarMinutaDesdeTexto(texto);
    return NextResponse.json(out);
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
