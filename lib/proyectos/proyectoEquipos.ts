/** Inventario técnico por proyecto (`ci_proyecto_equipos`). */

export const CATEGORIAS_EQUIPO_PROYECTO = [
  'equipo',
  'maquinaria_propia',
  'maquinaria_alquilada',
] as const;

export type CategoriaEquipoProyecto = (typeof CATEGORIAS_EQUIPO_PROYECTO)[number];

export const PROYECTO_EQUIPO_SELECT =
  'id,proyecto_id,categoria,nombre_equipo,marca,modelo,serial,cantidad,notas,fecha_asignacion,fecha_arriendo_inicio,fecha_arriendo_fin,arrendatario,arrendatario_rif,costo_arriendo,moneda_arriendo,created_at';

export type ProyectoEquipoRow = {
  id: string;
  proyecto_id: string;
  categoria: string | null;
  nombre_equipo: string;
  marca: string | null;
  modelo: string | null;
  serial: string | null;
  cantidad: number;
  notas: string | null;
  fecha_asignacion: string | null;
  fecha_arriendo_inicio: string | null;
  fecha_arriendo_fin: string | null;
  arrendatario: string | null;
  arrendatario_rif: string | null;
  costo_arriendo: number | null;
  moneda_arriendo: string | null;
  created_at?: string;
};

export function normalizarCategoriaEquipo(raw: string | null | undefined): CategoriaEquipoProyecto {
  const c = (raw ?? '').trim().toLowerCase();
  if (c === 'maquinaria_propia' || c === 'maquinaria_alquilada') return c;
  return 'equipo';
}

export function etiquetaCategoriaEquipo(c: string | null | undefined): string {
  switch (normalizarCategoriaEquipo(c)) {
    case 'maquinaria_propia':
      return 'Maquinaria propia';
    case 'maquinaria_alquilada':
      return 'Maquinaria alquilada';
    default:
      return 'Equipo';
  }
}

export function filtrarEquiposPorCategoria(
  rows: ProyectoEquipoRow[],
  categoria: CategoriaEquipoProyecto,
): ProyectoEquipoRow[] {
  return rows.filter((r) => normalizarCategoriaEquipo(r.categoria) === categoria);
}

export function parseCostoArriendo(raw: string): number | null {
  const t = raw.trim().replace(/\s/g, '').replace(/,/g, '.');
  if (!t) return null;
  const n = Number(t);
  if (!Number.isFinite(n) || n < 0) return null;
  return Math.round(n * 100) / 100;
}

export function isMaquinariaColumnMissing(message: string): boolean {
  const m = message.toLowerCase();
  return (
    m.includes('fecha_arriendo') ||
    m.includes('arrendatario') ||
    m.includes('costo_arriendo') ||
    m.includes('fecha_asignacion') ||
    m.includes('moneda_arriendo') ||
    (m.includes('column') && m.includes('does not exist'))
  );
}

export const PROYECTO_EQUIPO_SELECT_LEGACY =
  'id,proyecto_id,categoria,nombre_equipo,marca,modelo,serial,cantidad,notas,created_at';

/** Normaliza fila de PostgREST (con o sin columnas de migración 155). */
export function mapProyectoEquipoRow(raw: Record<string, unknown>): ProyectoEquipoRow {
  const costo = raw.costo_arriendo;
  return {
    id: String(raw.id ?? ''),
    proyecto_id: String(raw.proyecto_id ?? ''),
    categoria: raw.categoria != null ? String(raw.categoria) : null,
    nombre_equipo: String(raw.nombre_equipo ?? ''),
    marca: raw.marca != null ? String(raw.marca) : null,
    modelo: raw.modelo != null ? String(raw.modelo) : null,
    serial: raw.serial != null ? String(raw.serial) : null,
    cantidad: Number(raw.cantidad) || 1,
    notas: raw.notas != null ? String(raw.notas) : null,
    fecha_asignacion: raw.fecha_asignacion != null ? String(raw.fecha_asignacion) : null,
    fecha_arriendo_inicio: raw.fecha_arriendo_inicio != null ? String(raw.fecha_arriendo_inicio) : null,
    fecha_arriendo_fin: raw.fecha_arriendo_fin != null ? String(raw.fecha_arriendo_fin) : null,
    arrendatario: raw.arrendatario != null ? String(raw.arrendatario) : null,
    arrendatario_rif: raw.arrendatario_rif != null ? String(raw.arrendatario_rif) : null,
    costo_arriendo:
      typeof costo === 'number' && Number.isFinite(costo) ? Math.round(costo * 100) / 100 : null,
    moneda_arriendo: raw.moneda_arriendo != null ? String(raw.moneda_arriendo) : null,
    created_at: raw.created_at != null ? String(raw.created_at) : undefined,
  };
}
