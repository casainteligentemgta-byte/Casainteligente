import { createClient } from '@/lib/supabase/server';
import { createSupabaseAdminOnlyClient } from '@/lib/supabase/adminOnlyClient';
import { cargarPresupuestoLuloDesdeMdb } from '@/lib/proyectos/presupuestosLulo';
import {
  isValidProyectoUuid,
  mensajeProyectoIdInvalido,
} from '@/lib/proyectos/validarProyectoUuid';
import { formatErrorMessage } from '@/lib/utils/formatErrorMessage';
import { NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 120;

type RouteContext = { params: { proyectoId: string } };

function esMdb(file: File): boolean {
  const n = file.name.toLowerCase();
  return n.endsWith('.mdb') || n.endsWith('.accdb');
}

/**
 * POST multipart: file (.mdb/.accdb), codigo_obr?, nombre?
 * Elimina presupuestos Lulo anteriores del proyecto e importa el MDB en cascada.
 */
export async function POST(req: Request, { params }: RouteContext) {
  try {
    const proyectoId = params.proyectoId?.trim() ?? '';
    if (!isValidProyectoUuid(proyectoId)) {
      return NextResponse.json({ error: mensajeProyectoIdInvalido(proyectoId) }, { status: 400 });
    }

    const formData = await req.formData();
    const file = formData.get('file');
    if (!(file instanceof File)) {
      return NextResponse.json({ error: 'Archivo MDB faltante.' }, { status: 400 });
    }
    if (!esMdb(file)) {
      return NextResponse.json(
        { error: 'Solo archivos .mdb o .accdb de LuloWin.' },
        { status: 400 },
      );
    }

    const codigoObr = String(formData.get('codigo_obr') ?? formData.get('codigoObr') ?? '').trim();
    const nombrePresupuesto = String(formData.get('nombre') ?? formData.get('nombre_presupuesto') ?? '').trim();

    const supabase = createSupabaseAdminOnlyClient() ?? (await createClient());
    const buffer = await file.arrayBuffer();

    const result = await cargarPresupuestoLuloDesdeMdb(supabase, proyectoId, buffer, {
      codigoObr: codigoObr || undefined,
      nombrePresupuesto: nombrePresupuesto || undefined,
      nombreArchivo: file.name,
    });

    return NextResponse.json({
      success: true,
      message: `Presupuesto Lulo cargado: ${result.capitulos} capítulos, ${result.partidas} partidas, ${result.apuItems} APU.`,
      presupuesto: result.presupuesto,
      codigo_obr: result.codigo_obr,
      capitulos: result.capitulos,
      partidas: result.partidas,
      apu: result.apuItems,
      reemplazado: true,
    });
  } catch (err) {
    const e = err as Error & { statusCode?: number; tablasDetectadas?: string[] };
    const status = e.statusCode === 422 ? 422 : 500;
    return NextResponse.json(
      {
        error: formatErrorMessage(err),
        tablasDetectadas: e.tablasDetectadas,
      },
      { status },
    );
  }
}
