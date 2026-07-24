import {
  parseClasificacionGastoEntidad,
  type ClasificacionGastoEntidad,
} from '@/lib/contabilidad/clasificacionGastoEntidad';

export const NATURALEZAS_PROYECTO = ['obra_construccion', 'centro_costo_entidad'] as const;
export type NaturalezaProyecto = (typeof NATURALEZAS_PROYECTO)[number];

export type ProyectoConNaturaleza = {
  id: string;
  nombre: string;
  entidad_id?: string | null;
  naturaleza_proyecto?: string | null;
  clasificacion_gasto_entidad?: string | null;
};

export function parseNaturalezaProyecto(v: unknown): NaturalezaProyecto {
  const s = String(v ?? '')
    .trim()
    .toLowerCase();
  if (s === 'centro_costo_entidad') return 'centro_costo_entidad';
  return 'obra_construccion';
}

export function esObraConstruccion(p: ProyectoConNaturaleza): boolean {
  return parseNaturalezaProyecto(p.naturaleza_proyecto) === 'obra_construccion';
}

export function esCentroCostoEntidad(p: ProyectoConNaturaleza): boolean {
  return parseNaturalezaProyecto(p.naturaleza_proyecto) === 'centro_costo_entidad';
}

export function filtrarObrasConstruccion<T extends ProyectoConNaturaleza>(proyectos: T[]): T[] {
  return proyectos.filter(esObraConstruccion);
}

export function filtrarCentrosCostoEntidad<T extends ProyectoConNaturaleza>(
  proyectos: T[],
  entidadId?: string | null,
): T[] {
  const eid = entidadId?.trim();
  return proyectos.filter((p) => {
    if (!esCentroCostoEntidad(p)) return false;
    if (!eid) return true;
    return String(p.entidad_id ?? '').trim() === eid;
  });
}

export type FiltroClasificacionGastoEntidadCuadro =
  | ClasificacionGastoEntidad
  | 'sin_clasificar';

export const OPCIONES_FILTRO_GASTO_ENTIDAD: {
  value: FiltroClasificacionGastoEntidadCuadro | '';
  label: string;
}[] = [
  { value: '', label: 'Todo gasto de entidad' },
  { value: 'operacional', label: 'Gasto operativo' },
  { value: 'administrativo', label: 'Gasto administrativo' },
  { value: 'servicio', label: 'Servicios' },
  { value: 'sin_clasificar', label: 'Sin clasificar' },
];

export function parseFiltroGastoEntidadCuadro(v: unknown): FiltroClasificacionGastoEntidadCuadro | '' {
  const s = String(v ?? '')
    .trim()
    .toLowerCase();
  if (!s) return '';
  if (s === 'sin_clasificar' || s === 'sin clasificar') return 'sin_clasificar';
  const cl = parseClasificacionGastoEntidad(s);
  return cl ?? '';
}

export function clasificacionEfectivaMaterial(
  item: {
    clasificacion_gasto_entidad?: string | null;
    proyecto_id?: string | null;
  },
  proyectosById: Map<string, ProyectoConNaturaleza>,
): ClasificacionGastoEntidad | null {
  const direct = parseClasificacionGastoEntidad(item.clasificacion_gasto_entidad);
  if (direct) return direct;
  const pid = item.proyecto_id?.trim();
  if (!pid) return null;
  const pr = proyectosById.get(pid);
  if (!pr || !esCentroCostoEntidad(pr)) return null;
  return parseClasificacionGastoEntidad(pr.clasificacion_gasto_entidad);
}

export function materialCoincideFiltroGastoEntidad(
  item: {
    clasificacion_gasto_entidad?: string | null;
    proyecto_id?: string | null;
    entidad_id?: string | null;
    proyecto?: { entidad_id?: string | null; naturaleza_proyecto?: string | null; clasificacion_gasto_entidad?: string | null } | null;
  },
  opts: {
    filterClasificacionGastoEntidad: FiltroClasificacionGastoEntidadCuadro;
    filterEntidadId: string;
    proyectoIdsCentroCosto: ReadonlySet<string>;
    proyectosById: Map<string, ProyectoConNaturaleza>;
    catalogoEntidadOk: boolean;
  },
): boolean {
  const efectiva = clasificacionEfectivaMaterial(item, opts.proyectosById);
  const pid = item.proyecto_id?.trim();
  const enCentroCosto = pid ? opts.proyectoIdsCentroCosto.has(pid) : false;

  if (opts.filterClasificacionGastoEntidad === 'sin_clasificar') {
    if (efectiva) return false;
    if (enCentroCosto) return opts.catalogoEntidadOk;
    return opts.catalogoEntidadOk && !pid;
  }

  if (efectiva === opts.filterClasificacionGastoEntidad) return opts.catalogoEntidadOk;
  if (enCentroCosto) {
    const pr = pid ? opts.proyectosById.get(pid) : undefined;
    const pCl = parseClasificacionGastoEntidad(pr?.clasificacion_gasto_entidad);
    return pCl === opts.filterClasificacionGastoEntidad && opts.catalogoEntidadOk;
  }
  return false;
}

export function proyectoIdsCentroCostoPorClasificacion(
  proyectos: ProyectoConNaturaleza[],
  entidadId: string,
  filtro: FiltroClasificacionGastoEntidadCuadro | '',
): Set<string> {
  const eid = entidadId.trim();
  const ids = new Set<string>();
  for (const p of filtrarCentrosCostoEntidad(proyectos, eid)) {
    const cl = parseClasificacionGastoEntidad(p.clasificacion_gasto_entidad);
    if (!filtro) {
      ids.add(p.id);
      continue;
    }
    if (filtro === 'sin_clasificar' && !cl) ids.add(p.id);
    else if (cl === filtro) ids.add(p.id);
  }
  return ids;
}
