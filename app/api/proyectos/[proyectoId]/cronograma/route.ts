import { createClient } from '@/lib/supabase/server';
import {
  isValidProyectoUuid,
  mensajeProyectoIdInvalido,
} from '@/lib/proyectos/validarProyectoUuid';
import type { CronogramaTarea } from '@/types/cronograma';
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

/** Genera borrador de cronograma desde partidas Lulo (2 semanas por partida escalonadas). */
async function borradorDesdePartidas(
  supabase: Awaited<ReturnType<typeof createClient>>,
  proyectoId: string,
): Promise<CronogramaTarea[]> {
  const { data, error } = await supabase
    .from('ci_presupuesto_partidas')
    .select(
      'id, codigo_partida, descripcion, unidad, cantidad_presupuestada, evidencias_fotos, evidencias_videos',
    )
    .eq('proyecto_id', proyectoId)
    .order('capitulo_orden', { ascending: true })
    .order('codigo_partida')
    .limit(40);

  if (error || !data?.length) return [];

  const base = new Date();
  base.setHours(12, 0, 0, 0);
  const iso = (d: Date) => d.toISOString().slice(0, 10);

  return data.map((row, i) => {
    const inicio = new Date(base);
    inicio.setDate(inicio.getDate() + i * 7);
    const fin = new Date(inicio);
    fin.setDate(fin.getDate() + 13);
    const r = row as {
      id: string;
      codigo_partida: string;
      descripcion: string;
      unidad: string;
      cantidad_presupuestada: number;
      evidencias_fotos?: string[];
      evidencias_videos?: string[];
    };
    return {
      id: `borrador-${r.id}`,
      proyecto_id: proyectoId,
      partida_id: r.id,
      codigo_partida: r.codigo_partida,
      nombre_tarea: r.descripcion?.trim() || r.codigo_partida,
      fecha_inicio_planificada: iso(inicio),
      fecha_fin_planificada: iso(fin),
      porcentaje_avance: 0,
      orden: i,
      descripcion_partida: r.descripcion,
      unidad_partida: r.unidad,
      cantidad_presupuestada: Number(r.cantidad_presupuestada),
      evidencias_fotos: r.evidencias_fotos ?? [],
      evidencias_videos: r.evidencias_videos ?? [],
    };
  });
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
        const borrador = incluirBorrador
          ? await borradorDesdePartidas(supabase, proyectoId)
          : [];
        return NextResponse.json({
          tareas: borrador,
          origen: 'borrador_partidas',
          aviso: 'Tabla cronograma_tareas no existe. Ejecuta migración 168.',
        });
      }
      throw error;
    }

    const filas = (data ?? []) as TareaDbRow[];
    const enriquecidas = await enriquecerTareasConPartidas(supabase, filas);
    let tareas = enriquecidas.map((row) => mapTarea(row));

    if (tareas.length === 0 && incluirBorrador) {
      tareas = await borradorDesdePartidas(supabase, proyectoId);
      return NextResponse.json({
        tareas,
        origen: 'borrador_partidas',
        aviso: 'Vista previa desde partidas del presupuesto. Guarde tareas en cronograma_tareas.',
      });
    }

    return NextResponse.json({ tareas, origen: 'cronograma_tareas' });
  } catch (err: unknown) {
    console.error('[GET cronograma]', err);
    return NextResponse.json(
      { error: formatErrorMessage(err) },
      { status: 500 },
    );
  }
}
