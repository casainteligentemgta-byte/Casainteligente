import type { CronogramaCapitulo, CronogramaTarea } from '@/types/cronograma';
import type { SupabaseClient } from '@supabase/supabase-js';

function iso(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function fechaBorradorPartida(index: number): { inicio: string; fin: string } {
  const base = new Date();
  base.setHours(12, 0, 0, 0);
  const inicio = new Date(base);
  inicio.setDate(inicio.getDate() + index * 7);
  const fin = new Date(inicio);
  fin.setDate(fin.getDate() + 13);
  return { inicio: iso(inicio), fin: iso(fin) };
}

export function crearTareaPartidaBorrador(
  proyectoId: string,
  partida: {
    id: string;
    codigo: string;
    descripcion: string;
    unidad: string;
    cantidad_presupuestada?: number | null;
    evidencias_fotos?: string[] | null;
    evidencias_videos?: string[] | null;
  },
  capitulo: { id: string; codigo: string; nombre: string },
  ordenGlobal: number,
  tareaExistente?: Partial<CronogramaTarea>,
): CronogramaTarea {
  const fechas = tareaExistente?.fecha_inicio_planificada
    ? {
        inicio: tareaExistente.fecha_inicio_planificada,
        fin: tareaExistente.fecha_fin_planificada ?? tareaExistente.fecha_inicio_planificada,
      }
    : fechaBorradorPartida(ordenGlobal);

  return {
    id: tareaExistente?.id ?? `borrador-${partida.id}`,
    proyecto_id: proyectoId,
    partida_id: partida.id,
    codigo_partida: partida.codigo,
    nombre_tarea:
      tareaExistente?.nombre_tarea ?? (partida.descripcion?.trim() || partida.codigo),
    fecha_inicio_planificada: fechas.inicio,
    fecha_fin_planificada: fechas.fin,
    porcentaje_avance: Number(tareaExistente?.porcentaje_avance) || 0,
    orden: tareaExistente?.orden ?? ordenGlobal,
    notas: tareaExistente?.notas ?? null,
    tipo: 'partida',
    capitulo_id: capitulo.id,
    capitulo_codigo: capitulo.codigo,
    capitulo_nombre: capitulo.nombre,
    descripcion_partida: partida.descripcion,
    unidad_partida: partida.unidad,
    cantidad_presupuestada: Number(partida.cantidad_presupuestada ?? 0) || null,
    evidencias_fotos: partida.evidencias_fotos ?? [],
    evidencias_videos: partida.evidencias_videos ?? [],
  };
}

/** Tarea resumen del capítulo (rango y avance agregados de sus partidas). */
export function resumirCapituloComoTarea(
  proyectoId: string,
  capitulo: CronogramaCapitulo,
): CronogramaTarea {
  const hijas = capitulo.partidas;
  if (!hijas.length) {
    const { inicio, fin } = fechaBorradorPartida(capitulo.orden);
    return {
      id: `cap-${capitulo.id}`,
      proyecto_id: proyectoId,
      partida_id: null,
      codigo_partida: capitulo.codigo || null,
      nombre_tarea: capitulo.nombre,
      fecha_inicio_planificada: inicio,
      fecha_fin_planificada: fin,
      porcentaje_avance: 0,
      orden: capitulo.orden,
      tipo: 'capitulo',
      capitulo_id: capitulo.id,
      capitulo_codigo: capitulo.codigo,
      capitulo_nombre: capitulo.nombre,
    };
  }

  let min = parseFecha(hijas[0].fecha_inicio_planificada);
  let max = parseFecha(hijas[0].fecha_fin_planificada);
  let avanceSum = 0;
  for (const h of hijas) {
    const a = parseFecha(h.fecha_inicio_planificada);
    const b = parseFecha(h.fecha_fin_planificada);
    if (a < min) min = a;
    if (b > max) max = b;
    avanceSum += Number(h.porcentaje_avance) || 0;
  }

  return {
    id: `cap-${capitulo.id}`,
    proyecto_id: proyectoId,
    partida_id: null,
    codigo_partida: capitulo.codigo || null,
    nombre_tarea: capitulo.nombre,
    fecha_inicio_planificada: iso(min),
    fecha_fin_planificada: iso(max),
    porcentaje_avance: avanceSum / hijas.length,
    orden: capitulo.orden,
    tipo: 'capitulo',
    capitulo_id: capitulo.id,
    capitulo_codigo: capitulo.codigo,
    capitulo_nombre: capitulo.nombre,
  };
}

function parseFecha(s: string): Date {
  const part = s.slice(0, 10);
  const [y, m, d] = part.split('-').map(Number);
  if (!y || !m || !d) return new Date();
  return new Date(y, m - 1, d, 12, 0, 0, 0);
}

export function aplanarPartidasCapitulos(capitulos: CronogramaCapitulo[]): CronogramaTarea[] {
  return capitulos.flatMap((c) => c.partidas);
}

async function fetchPartidasCascada(
  supabase: SupabaseClient,
  capIds: string[],
): Promise<
  Array<{
    id: string;
    capitulo_id: string;
    codigo: string;
    descripcion: string;
    unidad: string;
    cantidad_presupuestada: number;
  }>
> {
  const partidas: Array<{
    id: string;
    capitulo_id: string;
    codigo: string;
    descripcion: string;
    unidad: string;
    cantidad_presupuestada: number;
  }> = [];
  for (let i = 0; i < capIds.length; i += 80) {
    const batch = capIds.slice(i, i + 80);
    const { data } = await supabase
      .from('partidas')
      .select('id, capitulo_id, codigo, descripcion, unidad, cantidad_presupuestada')
      .in('capitulo_id', batch)
      .order('codigo');
    if (data?.length) partidas.push(...data);
  }
  return partidas;
}

/** Capítulos y partidas desde tablas cascada (capitulos → partidas). */
export async function buildCapitulosDesdeCascada(
  supabase: SupabaseClient,
  proyectoId: string,
  tareasPorPartidaId?: Map<string, CronogramaTarea>,
): Promise<CronogramaCapitulo[] | null> {
  const { data: caps, error } = await supabase
    .from('capitulos')
    .select('id, codigo, nombre')
    .eq('proyecto_id', proyectoId)
    .order('codigo');
  if (error?.code === '42P01' || !caps?.length) return null;

  const capIds = caps.map((c) => String(c.id));
  const partidas = await fetchPartidasCascada(supabase, capIds);
  if (!partidas.length) return null;

  let ordenGlobal = 0;
  return caps.map((cap, capIndex) => {
    const capId = String(cap.id);
    const capMeta = {
      id: capId,
      codigo: String(cap.codigo ?? '').trim(),
      nombre: String(cap.nombre ?? cap.codigo ?? 'Capítulo').trim(),
    };
    const delCap = partidas.filter((p) => String(p.capitulo_id) === capId);
    const partidasTareas = delCap.map((p) => {
      const existente = tareasPorPartidaId?.get(String(p.id));
      const t = crearTareaPartidaBorrador(
        proyectoId,
        {
          id: String(p.id),
          codigo: String(p.codigo).trim(),
          descripcion: String(p.descripcion),
          unidad: String(p.unidad || 'UND'),
          cantidad_presupuestada: Number(p.cantidad_presupuestada),
        },
        capMeta,
        ordenGlobal,
        existente,
      );
      ordenGlobal += 1;
      return t;
    });
    return {
      id: capId,
      codigo: capMeta.codigo,
      nombre: capMeta.nombre,
      orden: capIndex,
      partidas: partidasTareas,
    };
  });
}

/** Capítulos agrupados desde ci_presupuesto_partidas. */
export async function buildCapitulosDesdeCiPresupuesto(
  supabase: SupabaseClient,
  proyectoId: string,
  tareasPorPartidaId?: Map<string, CronogramaTarea>,
): Promise<CronogramaCapitulo[] | null> {
  const { data, error } = await supabase
    .from('ci_presupuesto_partidas')
    .select(
      'id, codigo_partida, descripcion, unidad, cantidad_presupuestada, capitulo_codigo, capitulo_descripcion, capitulo_orden, evidencias_fotos, evidencias_videos',
    )
    .eq('proyecto_id', proyectoId)
    .order('capitulo_orden', { ascending: true })
    .order('codigo_partida');

  if (error || !data?.length) return null;

  type Bucket = { codigo: string; nombre: string; orden: number; rows: typeof data };
  const buckets = new Map<string, Bucket>();

  for (const row of data) {
    const cod = String(row.capitulo_codigo ?? '0').trim() || '0';
    if (!buckets.has(cod)) {
      buckets.set(cod, {
        codigo: cod,
        nombre: String(row.capitulo_descripcion ?? `Capítulo ${cod}`).trim(),
        orden: Number(row.capitulo_orden ?? 0),
        rows: [],
      });
    }
    buckets.get(cod)!.rows.push(row);
  }

  const sorted = Array.from(buckets.values()).sort((a, b) => a.orden - b.orden || a.codigo.localeCompare(b.codigo));
  let ordenGlobal = 0;

  return sorted.map((bucket, capIndex) => {
    const capId = `cap-ci-${bucket.codigo}`;
    const capMeta = { id: capId, codigo: bucket.codigo, nombre: bucket.nombre };
    const partidasTareas = bucket.rows.map((r) => {
      const id = String(r.id);
      const existente = tareasPorPartidaId?.get(id);
      const t = crearTareaPartidaBorrador(
        proyectoId,
        {
          id,
          codigo: String(r.codigo_partida).trim(),
          descripcion: String(r.descripcion),
          unidad: String(r.unidad || 'UND'),
          cantidad_presupuestada: Number(r.cantidad_presupuestada),
          evidencias_fotos: r.evidencias_fotos as string[] | undefined,
          evidencias_videos: r.evidencias_videos as string[] | undefined,
        },
        capMeta,
        ordenGlobal,
        existente,
      );
      ordenGlobal += 1;
      return t;
    });
    return {
      id: capId,
      codigo: bucket.codigo,
      nombre: bucket.nombre,
      orden: capIndex,
      partidas: partidasTareas,
    };
  });
}

export async function buildCapitulosParaCronograma(
  supabase: SupabaseClient,
  proyectoId: string,
  tareasGuardadas: CronogramaTarea[] = [],
): Promise<CronogramaCapitulo[]> {
  const porPartidaId = new Map<string, CronogramaTarea>();
  const porCodigo = new Map<string, CronogramaTarea>();
  for (const t of tareasGuardadas) {
    if (t.partida_id) porPartidaId.set(t.partida_id, t);
    if (t.codigo_partida) porCodigo.set(t.codigo_partida.trim().toUpperCase(), t);
  }

  const desdeCascada = await buildCapitulosDesdeCascada(supabase, proyectoId, porPartidaId);
  if (desdeCascada?.some((c) => c.partidas.length > 0)) {
    return mergeTareasGuardadasEnCapitulos(desdeCascada, tareasGuardadas, porCodigo);
  }

  const desdeCi = await buildCapitulosDesdeCiPresupuesto(supabase, proyectoId, porPartidaId);
  if (desdeCi?.length) {
    return mergeTareasGuardadasEnCapitulos(desdeCi, tareasGuardadas, porCodigo);
  }

  return agruparTareasPlanasPorCapitulo(proyectoId, tareasGuardadas);
}

function mergeTareasGuardadasEnCapitulos(
  capitulos: CronogramaCapitulo[],
  tareasGuardadas: CronogramaTarea[],
  porCodigo: Map<string, CronogramaTarea>,
): CronogramaCapitulo[] {
  if (!tareasGuardadas.length) return capitulos;

  const idsEnArbol = new Set(
    capitulos.flatMap((c) => c.partidas.map((p) => p.id)),
  );
  const huerfanas = tareasGuardadas.filter((t) => !idsEnArbol.has(t.id));
  if (!huerfanas.length) {
    return capitulos.map((cap) => ({
      ...cap,
      partidas: cap.partidas.map((p) => {
        const g = porCodigo.get((p.codigo_partida ?? '').toUpperCase());
        return g && g.id === p.id ? { ...p, ...g, tipo: 'partida' as const } : p;
      }),
    }));
  }

  const sinCap: CronogramaCapitulo = {
    id: 'cap-sin-asignar',
    codigo: '—',
    nombre: 'Otras actividades',
    orden: 9999,
    partidas: huerfanas.map((t) => ({ ...t, tipo: 'partida' as const })),
  };
  return [...capitulos, sinCap];
}

function agruparTareasPlanasPorCapitulo(
  proyectoId: string,
  tareas: CronogramaTarea[],
): CronogramaCapitulo[] {
  const buckets = new Map<string, CronogramaCapitulo>();
  for (const t of tareas) {
    const capId = t.capitulo_id ?? `cap-${t.capitulo_codigo ?? '0'}`;
    if (!buckets.has(capId)) {
      buckets.set(capId, {
        id: capId,
        codigo: t.capitulo_codigo ?? '',
        nombre: t.capitulo_nombre ?? 'Capítulo',
        orden: t.orden ?? 0,
        partidas: [],
      });
    }
    buckets.get(capId)!.partidas.push({ ...t, tipo: 'partida' });
  }
  if (!buckets.size && tareas.length) {
    return [
      {
        id: 'cap-unico',
        codigo: '',
        nombre: 'Actividades',
        orden: 0,
        partidas: tareas.map((t) => ({ ...t, tipo: 'partida' as const })),
      },
    ];
  }
  return Array.from(buckets.values()).sort((a, b) => a.orden - b.orden);
}
