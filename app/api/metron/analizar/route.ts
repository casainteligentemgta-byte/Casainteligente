import { NextResponse } from 'next/server';
import { analizarPlanoMetron, METRON_MAX_BYTES, assertMetronMime } from '@/lib/metron/analizarPlano';
import { persistirAnalisisMetron } from '@/lib/metron/persistirAnalisis';
import { supabaseAdminForRoute } from '@/lib/talento/supabase-admin';
import type { MetronDisciplina } from '@/types/metron';

export const runtime = 'nodejs';
export const maxDuration = 120;

/**
 * POST /api/metron/analizar
 *
 * Multipart: proyecto_id, archivo (PDF/imagen), disciplina?, plano_archivo_id?
 * JSON: { proyecto_id, plano_archivo_id, disciplina? } — descarga el PDF del plano registrado.
 */
export async function POST(req: Request) {
  const admin = supabaseAdminForRoute();
  if (!admin.ok) return admin.response;

  try {
    const contentType = req.headers.get('content-type') || '';
    let proyectoId = '';
    let planoArchivoId: string | null = null;
    let disciplinaPreferida: MetronDisciplina | 'auto' = 'auto';
    let buffer: Buffer | null = null;
    let mimeType = 'application/pdf';
    let archivoNombre = 'plano.pdf';
    let publicUrl: string | null = null;
    let codigoPlano = '';
    let nombrePlano = '';
    let nombreObra = '';

    if (contentType.includes('multipart/form-data')) {
      const form = await req.formData();
      proyectoId = String(form.get('proyecto_id') ?? '').trim();
      planoArchivoId = String(form.get('plano_archivo_id') ?? '').trim() || null;
      const disc = String(form.get('disciplina') ?? 'auto').trim().toLowerCase();
      disciplinaPreferida = (disc || 'auto') as MetronDisciplina | 'auto';
      nombreObra = String(form.get('nombre_obra') ?? '').trim();
      codigoPlano = String(form.get('codigo_plano') ?? '').trim();
      nombrePlano = String(form.get('nombre_plano') ?? '').trim();

      const file =
        form.get('archivo') instanceof File
          ? (form.get('archivo') as File)
          : form.get('file') instanceof File
            ? (form.get('file') as File)
            : null;

      if (file && file.size > 0) {
        if (file.size > METRON_MAX_BYTES) {
          return NextResponse.json(
            { error: `Archivo demasiado grande (máx. ${Math.floor(METRON_MAX_BYTES / (1024 * 1024))} MB).` },
            { status: 400 },
          );
        }
        buffer = Buffer.from(await file.arrayBuffer());
        mimeType = file.type || 'application/pdf';
        archivoNombre = file.name || archivoNombre;
      }
    } else {
      const body = (await req.json().catch(() => ({}))) as {
        proyecto_id?: string;
        plano_archivo_id?: string;
        disciplina?: string;
        nombre_obra?: string;
      };
      proyectoId = String(body.proyecto_id ?? '').trim();
      planoArchivoId = String(body.plano_archivo_id ?? '').trim() || null;
      const disc = String(body.disciplina ?? 'auto').trim().toLowerCase();
      disciplinaPreferida = (disc || 'auto') as MetronDisciplina | 'auto';
      nombreObra = String(body.nombre_obra ?? '').trim();
    }

    if (!proyectoId) {
      return NextResponse.json({ error: 'proyecto_id es requerido' }, { status: 400 });
    }

    if (planoArchivoId && (!buffer || !nombrePlano)) {
      const { data: planoRaw, error: pErr } = await admin.client
        .from('ci_proyecto_archivos')
        .select('id, titulo, codigo_plano, public_url, mime_type, proyecto_id')
        .eq('id', planoArchivoId)
        .maybeSingle();

      const plano = planoRaw as {
        id: string;
        titulo?: string | null;
        codigo_plano?: string | null;
        public_url?: string | null;
        mime_type?: string | null;
        proyecto_id?: string | null;
      } | null;

      if (pErr || !plano) {
        return NextResponse.json(
          { error: pErr?.message || 'Plano no encontrado' },
          { status: 404 },
        );
      }
      if (String(plano.proyecto_id) !== proyectoId) {
        return NextResponse.json(
          { error: 'El plano no pertenece a este proyecto' },
          { status: 400 },
        );
      }

      codigoPlano = codigoPlano || String(plano.codigo_plano ?? '');
      nombrePlano = nombrePlano || String(plano.titulo ?? '');
      publicUrl = plano.public_url || null;
      mimeType = String(plano.mime_type || 'application/pdf');

      if (!buffer) {
        if (!publicUrl) {
          return NextResponse.json(
            { error: 'El plano no tiene URL de PDF/imagen' },
            { status: 400 },
          );
        }
        const fetched = await fetch(publicUrl);
        if (!fetched.ok) {
          return NextResponse.json(
            { error: `No se pudo descargar el plano (${fetched.status})` },
            { status: 502 },
          );
        }
        const ab = await fetched.arrayBuffer();
        if (ab.byteLength > METRON_MAX_BYTES) {
          return NextResponse.json({ error: 'Plano demasiado grande para analizar' }, { status: 400 });
        }
        buffer = Buffer.from(ab);
        const ct = fetched.headers.get('content-type');
        if (ct) mimeType = ct.split(';')[0].trim();
        archivoNombre = `${codigoPlano || 'plano'}.pdf`;
      }
    }

    if (!buffer) {
      return NextResponse.json(
        { error: 'Envíe archivo (multipart) o plano_archivo_id con PDF público' },
        { status: 400 },
      );
    }

    try {
      assertMetronMime(mimeType);
    } catch (err) {
      return NextResponse.json(
        { error: err instanceof Error ? err.message : 'MIME no soportado' },
        { status: 400 },
      );
    }

    if (!nombreObra) {
      const { data: proy } = await admin.client
        .from('ci_proyectos')
        .select('nombre')
        .eq('id', proyectoId)
        .maybeSingle();
      nombreObra = String((proy as { nombre?: string } | null)?.nombre ?? '');
    }

    const base64 = buffer.toString('base64');
    const { resultado, modelo, desdeGemini } = await analizarPlanoMetron({
      base64,
      mimeType,
      nombreObra,
      codigoPlano,
      nombrePlano,
      disciplinaPreferida,
    });

    const saved = await persistirAnalisisMetron(admin.client, {
      proyectoId,
      planoArchivoId,
      archivoNombre,
      mimeType,
      publicUrl,
      modelo,
      resultado,
      status: 'borrador',
    });

    return NextResponse.json({
      status: 'ok',
      desdeGemini,
      modelo,
      analisis: saved,
      total_computos: saved.computos?.length ?? 0,
      total_estimado: (saved.computos ?? []).reduce((s, c) => s + (c.monto_estimado || 0), 0),
    });
  } catch (err) {
    console.error('[metron/analizar]', err);
    return NextResponse.json(
      {
        status: 'error',
        error: err instanceof Error ? err.message : 'Error al analizar con Metron',
      },
      { status: 500 },
    );
  }
}
