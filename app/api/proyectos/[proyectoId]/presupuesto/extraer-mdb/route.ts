import { createClient } from '@/lib/supabase/server';
import { formatMdbReadError } from '@/lib/proyectos/mdbBuffer';
import { postExtraerLuloCompleto } from '@/lib/proyectos/extraerMdbLuloCompleto';
import {
  isValidProyectoUuid,
  mensajeProyectoIdInvalido,
} from '@/lib/proyectos/validarProyectoUuid';
import { NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 120;

type RouteContext = { params: { proyectoId: string } };

/**
 * POST /api/proyectos/:proyectoId/presupuesto/extraer-mdb
 * Volcado completo del MDB/CSV → ci_lulo_import_snapshots (todas las tablas).
 */
export async function POST(req: Request, { params }: RouteContext) {
  try {
    const proyectoId = params.proyectoId?.trim();
    if (!isValidProyectoUuid(proyectoId)) {
      return NextResponse.json(
        { error: mensajeProyectoIdInvalido(proyectoId) },
        { status: 400 },
      );
    }

    const formData = await req.formData();
    const file = formData.get('file');
    if (!(file instanceof File)) {
      return NextResponse.json({ error: 'Archivo faltante' }, { status: 400 });
    }

    const reemplazar =
      formData.get('reemplazar') === 'true' || formData.get('reemplazar') === '1';

    const supabase = await createClient();
    const { extraccion, resumen, snapshotId } = await postExtraerLuloCompleto(
      supabase,
      proyectoId,
      file,
      reemplazar,
    );

    const tablasConDatos = extraccion.catalogoTablas.filter((t) => t.rowCount > 0).length;

    return NextResponse.json({
      success: true,
      extraccionCompleta: true,
      message: `Extracción completa: ${extraccion.catalogoTablas.length} tablas, ${extraccion.filasTotales} filas (${tablasConDatos} con datos).`,
      proyectoId,
      snapshotId,
      resumen,
      catalogoTablas: extraccion.catalogoTablas,
      tablasConDatos,
      filasTotales: extraccion.filasTotales,
    });
  } catch (err: unknown) {
    const raw = err instanceof Error ? err.message : 'Error al extraer el archivo.';
    const friendly = formatMdbReadError(err);
    if (friendly !== raw) {
      return NextResponse.json({ error: friendly }, { status: 400 });
    }
    console.error('[POST extraer-mdb]', err);
    return NextResponse.json({ error: raw }, { status: 500 });
  }
}
