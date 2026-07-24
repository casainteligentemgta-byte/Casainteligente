import { createClient } from '@/lib/supabase/server';
import {
  isValidProyectoUuid,
  mensajeProyectoIdInvalido,
} from '@/lib/proyectos/validarProyectoUuid';
import {
  aplanarPartidasCapitulos,
  buildCapitulosParaCronograma,
} from '@/lib/proyectos/cronogramaCapitulos';
import { aplicarAvanceCronograma } from '@/lib/proyectos/aplicarAvanceCronograma';
import type { CronogramaCapitulo, CronogramaTarea } from '@/types/cronograma';
import { formatErrorMessage } from '@/lib/utils/formatErrorMessage';
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

type PartidaCronograma = {
  descripcion: string;
  unidad: string;
  cantidad_presupuestada: number;
  evidencias_fotos: string[] | null;
  evidencias_videos: string[] | null;
};

type TareaRow = {
  id: string;
  proyecto_id: string;
  partida_id: string | null;
  codigo_partida: string | null;
  nombre_tarea: string;
  fecha_inicio_planificada: string;
  fecha_fin_planificada: string;
  porcentaje_avance: number;
  orden: number;
  notas: string | null;
  partida?: PartidaCronograma | null;
};

type TareaDbRow = Omit<TareaRow, 'partida'>;

function mapTarea(row: TareaRow): CronogramaTarea {
  const p = row.partida;
  return {
    id: row.id,
    proyecto_id: row.proyecto_id,
    partida_id: row.partida_id,
    codigo_partida: row.codigo_partida,
    nombre_tarea: row.nombre_tarea,
    fecha_inicio_planificada: row.fecha_inicio_planificada,
    fecha_fin_planificada: row.fecha_fin_planificada,
    porcentaje_avance: Number(row.porcentaje_avance) || 0,
    orden: row.orden,
    notas: row.notas,
    descripcion_partida: p?.descripcion ?? null,
    unidad_partida: p?.unidad ?? null,
    cantidad_presupuestada: p?.cantidad_presupuestada ?? null,
    evidencias_fotos: p?.evidencias_fotos ?? [],
    evidencias_videos: p?.evidencias_videos ?? [],
  };
}

async function respuestaConCapitulos(
  capitulos: CronogramaCapitulo[],
  origen: string,
  aviso?: string,
) {
  const tareas = aplanarPartidasCapitulos(capitulos);
  return NextResponse.json({ tareas, capitulos, origen, aviso });
}

/** Evita embed PostgREST (PGRST200) si el schema cache no tiene la FK registrada. */
async function enriquecerTareasConPartidas(
  supabase: Awaited<ReturnType<typeof createClient>>,
  filas: TareaDbRow[],
): Promise<TareaRow[]> {
  const ids = Array.from(
    new Set(filas.map((f) => f.partida_id).filter((id): id is string => Boolean(id))),
  );
  const porId = new Map<string, PartidaCronograma>();

  if (ids.length > 0) {
    const { data: partidas, error } = await supabase
      .from('ci_presupuesto_partidas')
      .select(
        'id, descripcion, unidad, cantidad_presupuestada, evidencias_fotos, evidencias_videos',
      )
      .in('id', ids);

    if (!error && partidas) {
      for (const p of partidas as (PartidaCronograma & { id: string })[]) {
        porId.set(p.id, {
          descripcion: p.descripcion,
          unidad: p.unidad,
          cantidad_presupuestada: p.cantidad_presupuestada,
          evidencias_fotos: p.evidencias_fotos ?? [],
          evidencias_videos: p.evidencias_videos ?? [],
        });
      }
    }
  }

  return filas.map((f) => ({
    ...f,
    partida: f.partida_id ? (porId.get(f.partida_id) ?? null) : null,
  }));
}

export async function GET(
  _req: Request,
  { params }: { params: { proyectoId: string } },
) {
  try {
    const proyectoId = params.proyectoId?.trim();
    if (!isValidProyectoUuid(proyectoId)) {
      return NextResponse.json(
        { error: mensajeProyectoIdInvalido(proyectoId) },
        { status: 400 },
      );
    }

    const supabase = await createClient();
    const { searchParams } = new URL(_req.url);
    const incluirBorrador = searchParams.get('borrador') === '1';

    const { data, error } = await supabase
      .from('cronograma_tareas')
      .select(
        `
        id,
        proyecto_id,
        partida_id,
        codigo_partida,
        nombre_tarea,
        fecha_inicio_planificada,
        fecha_fin_planificada,
        porcentaje_avance,
        orden,
        notas
      `,
      )
      .eq('proyecto_id', proyectoId)
      .order('orden', { ascending: true })
      .order('fecha_inicio_planificada', { ascending: true });

    if (error) {
      if (error.message.includes('does not exist') || error.code === '42P01') {
        if (!incluirBorrador) {
          return respuestaConCapitulos([], 'borrador_partidas', 'Tabla cronograma_tareas no existe. Ejecuta migración 168.');
        }
        const capitulos = await buildCapitulosParaCronograma(supabase, proyectoId, []);
        return respuestaConCapitulos(
          capitulos,
          'borrador_partidas',
          capitulos.length
            ? 'Vista previa por capítulos del presupuesto. Ejecuta migración 168 para guardar tareas.'
            : 'Tabla cronograma_tareas no existe. Importa presupuesto Lulo.',
        );
      }
      throw error;
    }

    const filas = (data ?? []) as TareaDbRow[];
    const enriquecidas = await enriquecerTareasConPartidas(supabase, filas);
    const tareasGuardadas = enriquecidas.map((row) => mapTarea(row));
    const capitulos = await buildCapitulosParaCronograma(
      supabase,
      proyectoId,
      tareasGuardadas,
    );

    if (tareasGuardadas.length === 0 && incluirBorrador) {
      const borradorCaps = await buildCapitulosParaCronograma(supabase, proyectoId, []);
      return respuestaConCapitulos(
        borradorCaps,
        'borrador_partidas',
        borradorCaps.length
          ? 'Vista previa por capítulos. Pulse un capítulo para ver sus partidas. Guarde en cronograma_tareas para persistir.'
          : 'Sin partidas en el presupuesto. Importa Lulo primero.',
      );
    }

    return respuestaConCapitulos(capitulos, 'cronograma_tareas');
  } catch (err: unknown) {
    console.error('[GET cronograma]', err);
    return NextResponse.json(
      { error: formatErrorMessage(err) },
      { status: 500 },
    );
  }
}

type ActualizacionAvance = {
  id?: string;
  partida_id?: string | null;
  codigo_partida?: string | null;
  nombre_tarea?: string;
  porcentaje_avance: number;
  fecha_inicio_planificada?: string;
  fecha_fin_planificada?: string;
  orden?: number;
};

/** Registra avance diario; anti-embudo: inserta tarea si la partida no tiene filas en cronograma_tareas. */
export async function PATCH(
  req: Request,
  { params }: { params: { proyectoId: string } },
) {
  try {
    const proyectoId = params.proyectoId?.trim();
    if (!isValidProyectoUuid(proyectoId)) {
      return NextResponse.json(
        { error: mensajeProyectoIdInvalido(proyectoId) },
        { status: 400 },
      );
    }

    const body = (await req.json()) as { actualizaciones?: ActualizacionAvance[] };
    const actualizaciones = body.actualizaciones ?? [];
    if (!actualizaciones.length) {
      return NextResponse.json({ error: 'Sin actualizaciones' }, { status: 400 });
    }

    const supabase = await createClient();
    const guardados = await aplicarAvanceCronograma(supabase, proyectoId, actualizaciones);

    return NextResponse.json({ ok: true, guardados });
  } catch (err: unknown) {
    console.error('[PATCH cronograma]', err);
    return NextResponse.json(
      { error: formatErrorMessage(err) },
      { status: 500 },
    );
  }
}
