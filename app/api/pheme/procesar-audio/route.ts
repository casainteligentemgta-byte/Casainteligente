import { NextResponse } from 'next/server';
import { procesarReunionDesdeAudio } from '@/lib/pheme/procesarReunionDesdeAudio';
import { supabaseAdminForRoute } from '@/lib/talento/supabase-admin';

export const runtime = 'nodejs';
export const maxDuration = 120;

/**
 * POST /api/pheme/procesar-audio
 *
 * Contrato alineado al FastAPI de referencia:
 *   Form: titulo_reunion, duracion_minutos?, archivo_audio
 *
 * Respuesta:
 *   { status, id_reunion, minuta, transcripcion }
 */
export async function POST(req: Request) {
  let tmpHint = '';
  try {
    const form = await req.formData();
    const titulo = String(form.get('titulo_reunion') ?? '').trim();
    if (!titulo) {
      return NextResponse.json(
        { status: 'error', detail: 'titulo_reunion es requerido' },
        { status: 400 },
      );
    }

    const durRaw = form.get('duracion_minutos');
    let duracionMinutos: number | null = null;
    if (durRaw != null && String(durRaw).trim() !== '') {
      const n = Number(durRaw);
      if (!Number.isFinite(n)) {
        return NextResponse.json(
          { status: 'error', detail: 'duracion_minutos debe ser numérico' },
          { status: 400 },
        );
      }
      duracionMinutos = n;
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
    const buffer = Buffer.from(await file.arrayBuffer());
    const mimeType = file.type || guessMime(file.name) || 'audio/mpeg';

    const admin = supabaseAdminForRoute();
    if (!admin.ok) {
      // Sin service role no se puede persistir; igual intentamos analizar y devolver 503 claro.
      return NextResponse.json(
        {
          status: 'error',
          detail:
            'Falta SUPABASE_SERVICE_ROLE_KEY / URL para guardar en reuniones_pheme.',
        },
        { status: 503 },
      );
    }

    const out = await procesarReunionDesdeAudio({
      tituloReunion: titulo,
      buffer,
      mimeType,
      fileName: file.name || `reunion${extFromMime(mimeType)}`,
      duracionMinutos,
      supabase: admin.client,
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
      // extras útiles para la UI Casa Inteligente
      markdown: out.markdown,
      titulo_reunion: out.titulo_reunion,
      modelo: out.modelo ?? null,
    });
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
}

function guessMime(name: string): string | null {
  const n = name.toLowerCase();
  if (n.endsWith('.mp3')) return 'audio/mpeg';
  if (n.endsWith('.wav')) return 'audio/wav';
  if (n.endsWith('.m4a')) return 'audio/mp4';
  if (n.endsWith('.ogg') || n.endsWith('.oga')) return 'audio/ogg';
  if (n.endsWith('.webm')) return 'audio/webm';
  return null;
}

function extFromMime(mime: string): string {
  if (mime.includes('wav')) return '.wav';
  if (mime.includes('ogg')) return '.ogg';
  if (mime.includes('webm')) return '.webm';
  if (mime.includes('mp4') || mime.includes('m4a')) return '.m4a';
  return '.mp3';
}
