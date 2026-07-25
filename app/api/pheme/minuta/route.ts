import { NextResponse } from 'next/server';
import {
  generarMinutaDesdeAudio,
  procesarReunionConPheme,
} from '@/lib/pheme/generarMinuta';
import { persistirReunionPheme } from '@/lib/pheme/persistirReunion';
import { supabaseAdminForRoute } from '@/lib/talento/supabase-admin';

/**
 * POST /api/pheme/minuta
 * Body (prototipo Python):
 *  - { titulo_reunion?: string, transcripcion: string }
 *  - ó { titulo_reunion?, audio_base64, mime_type? }
 *  - guardar?: boolean (default true)
 */
export async function POST(req: Request) {
  let body: {
    titulo_reunion?: unknown;
    titulo?: unknown;
    transcripcion?: unknown;
    texto?: unknown;
    audio_base64?: unknown;
    mime_type?: unknown;
    mimeType?: unknown;
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

  const audioB64 =
    typeof body.audio_base64 === 'string' ? body.audio_base64.trim() : '';
  const texto =
    typeof body.transcripcion === 'string'
      ? body.transcripcion
      : typeof body.texto === 'string'
        ? body.texto
        : '';
  const guardar = body.guardar !== false;

  try {
    let out =
      audioB64.length > 0
        ? await generarMinutaDesdeAudio({
            tituloReunion: titulo,
            base64: audioB64,
            mimeType:
              (typeof body.mime_type === 'string' && body.mime_type.trim()) ||
              (typeof body.mimeType === 'string' && body.mimeType.trim()) ||
              'audio/ogg',
          })
        : null;

    if (!out) {
      if (!texto.trim()) {
        return NextResponse.json(
          { error: 'Indica transcripcion (texto) o audio_base64' },
          { status: 400 },
        );
      }
      out = await procesarReunionConPheme(titulo, texto);
    }

    let reunionId: string | null = null;
    let avisoPersist: string | undefined;

    if (guardar) {
      const admin = supabaseAdminForRoute();
      if (admin.ok) {
        const saved = await persistirReunionPheme(admin.client, {
          titulo: out.titulo_reunion,
          transcripcion: texto.trim() || (audioB64 ? '[audio]' : ''),
          minuta: out.minuta,
          markdown: out.markdown,
          modelo: out.modelo ?? null,
          desdeGemini: out.desdeGemini,
        });
        reunionId = saved.id;
        avisoPersist = saved.aviso;
      } else if (out.desdeGemini) {
        avisoPersist =
          'Minuta generada; no se pudo guardar (falta SUPABASE service role).';
      }
    }

    return NextResponse.json({
      ...out,
      reunion_id: reunionId,
      aviso: [out.aviso, avisoPersist].filter(Boolean).join(' ') || undefined,
      // Alias del schema Python para clientes que esperan el JSON crudo
      ...out.minuta,
    });
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
