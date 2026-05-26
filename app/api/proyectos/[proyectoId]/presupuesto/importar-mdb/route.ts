import { importarLuloMdbDirecto } from '@/lib/proyectos/importarLuloMdbDirecto';
import { formatMdbReadError } from '@/lib/proyectos/mdbBuffer';
import {
  isValidProyectoUuid,
  mensajeProyectoIdInvalido,
} from '@/lib/proyectos/validarProyectoUuid';
import { createClient } from '@/lib/supabase/server';
import { formatErrorMessage } from '@/lib/utils/formatErrorMessage';
import { NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
/** MDB Lulo pueden ser grandes */
export const maxDuration = 120;

type RouteContext = { params: { proyectoId: string } };

function isMdbFile(file: File): boolean {
  const name = file.name.toLowerCase();
  return name.endsWith('.mdb') || name.endsWith('.accdb');
}

/**
 * POST /api/proyectos/:proyectoId/presupuesto/importar-mdb
 *
 * FormData:
 * - file: archivo .mdb / .accdb de LuloWin (requerido)
 * - proyectoId: uuid (opcional, debe coincidir con la URL)
 * - reemplazar: "true" | "1" para borrar presupuesto previo del proyecto
 */
export async function POST(req: Request, { params }: RouteContext) {
  try {
    const proyectoId = params.proyectoId?.trim() ?? '';
    if (!isValidProyectoUuid(proyectoId)) {
      return NextResponse.json(
        { success: false, error: mensajeProyectoIdInvalido(proyectoId) },
        { status: 400 },
      );
    }

    const formData = await req.formData();
    const formProyectoId = String(formData.get('proyectoId') ?? formData.get('proyecto_id') ?? '').trim();
    if (formProyectoId && formProyectoId !== proyectoId) {
      return NextResponse.json(
        {
          success: false,
          error: 'El proyectoId del formulario no coincide con el de la URL.',
        },
        { status: 400 },
      );
    }

    const file = formData.get('file');
    if (!(file instanceof File)) {
      return NextResponse.json(
        { success: false, error: 'Archivo faltante. Envíe el campo "file" con el .mdb de LuloWin.' },
        { status: 400 },
      );
    }

    if (!isMdbFile(file)) {
      return NextResponse.json(
        {
          success: false,
          error: 'Formato no soportado.',
          hint: 'Este endpoint solo acepta archivos Microsoft Access / Access (.mdb) o (.accdb) exportados desde LuloWin.',
        },
        { status: 400 },
      );
    }

    const reemplazar =
      formData.get('reemplazar') === 'true' ||
      formData.get('reemplazar') === '1' ||
      formData.get('reemplazar') === 'on';

    const supabase = await createClient();
    const buffer = Buffer.from(await file.arrayBuffer());

    const result = await importarLuloMdbDirecto(supabase, proyectoId, buffer, {
      reemplazar,
      nombreArchivo: file.name,
    });

    const tablasUsadas =
      'tablasUsadas' in result ? result.tablasUsadas : undefined;
    const nombreArchivo =
      'nombreArchivo' in result ? result.nombreArchivo : file.name;

    return NextResponse.json({
      success: true,
      message: `Importación Lulo MDB: ${result.capitulos} capítulos, ${result.partidas} partidas, ${result.apuItems} ítems APU.`,
      proyectoId: result.proyectoId,
      capitulos: result.capitulos,
      partidas: result.partidas,
      apuItems: result.apuItems,
      reemplazar,
      tablasLulo: tablasUsadas,
      nombreArchivo,
      codigo_obr: 'codigo_obr' in result ? result.codigo_obr : undefined,
    });
  } catch (err: unknown) {
    const raw = formatErrorMessage(err) || 'Error al importar el presupuesto MDB.';
    const friendly = formatMdbReadError(err);
    const message = friendly !== raw && !friendly.includes('[object Object]') ? friendly : raw;
    const statusCode =
      typeof err === 'object' &&
      err !== null &&
      'statusCode' in err &&
      typeof (err as { statusCode: unknown }).statusCode === 'number'
        ? (err as { statusCode: number }).statusCode
        : friendly !== raw
          ? 400
          : 500;

    const tablasDetectadas =
      typeof err === 'object' &&
      err !== null &&
      'tablasDetectadas' in err &&
      Array.isArray((err as { tablasDetectadas: unknown }).tablasDetectadas)
        ? (err as { tablasDetectadas: string[] }).tablasDetectadas
        : undefined;

    console.error('[POST importar-mdb]', err);

    return NextResponse.json(
      {
        success: false,
        error: message,
        hint: message,
        tablasDetectadas,
      },
      { status: statusCode },
    );
  }
}
