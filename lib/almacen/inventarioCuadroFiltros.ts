import type { InventarioShareState } from '@/lib/almacen/inventarioExportShare';
import type { InspeccionCuarentenaRow } from '@/lib/almacen/listarInspeccionesCuarentena';

export const INVENTARIO_CUADRO_FILTROS_STORAGE_KEY = 'ci-inventario-cuadro-filtros-v1';

export type MensajeVacioCuadroAlmacen = {
  titulo: string;
  subtitulo: string;
};

export function leerInventarioCuadroFiltrosGuardados(): Partial<InventarioShareState> | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(INVENTARIO_CUADRO_FILTROS_STORAGE_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw) as Partial<InventarioShareState>;
    return data && typeof data === 'object' ? data : null;
  } catch {
    return null;
  }
}

export function guardarInventarioCuadroFiltros(state: InventarioShareState): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(INVENTARIO_CUADRO_FILTROS_STORAGE_KEY, JSON.stringify(state));
  } catch {
    /* quota / modo privado */
  }
}

export function borrarInventarioCuadroFiltrosGuardados(): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.removeItem(INVENTARIO_CUADRO_FILTROS_STORAGE_KEY);
  } catch {
    /* ignore */
  }
}

/** Mensaje contextual cuando la tabla filtrada queda vacía. */
export function mensajeVacioCuadroAlmacen(opts: {
  cargandoStockUbicacion: boolean;
  filtroStockPorUbicacion: boolean;
  filtroSinUbicaciones: boolean;
  filterDepositId: boolean;
  filterProyectoId: boolean;
  filterEntidadId: boolean;
  filtroSoloEntidad?: boolean;
  filtroGastoEntidad?: boolean;
  hayFiltrosActivos: boolean;
  kpiCuarentena?: boolean;
}): MensajeVacioCuadroAlmacen | null {
  if (!opts.filterEntidadId && !opts.filterProyectoId && !opts.filterDepositId && !opts.hayFiltrosActivos) {
    return {
      titulo: 'Seleccione un almacén',
      subtitulo:
        'Use la barra superior (entidad · obra · almacén) para ver el stock físico de ese depósito.',
    };
  }

  if (opts.cargandoStockUbicacion) return null;

  if (opts.filtroSinUbicaciones && opts.filtroStockPorUbicacion) {
    if (opts.filterDepositId && !opts.filterProyectoId && !opts.filterEntidadId) {
      return {
        titulo: 'Sin ubicaciones para este almacén',
        subtitulo:
          'No hay inv_ubicaciones vinculadas; se filtra por depósito asignado en catálogo. Revise maestros para stock físico.',
      };
    }
    return {
      titulo: 'Sin ubicaciones para este filtro',
      subtitulo:
        'La obra o entidad seleccionada no tiene almacenes registrados. Configure ubicaciones en maestros.',
    };
  }

  if (opts.filtroStockPorUbicacion && !opts.filtroSinUbicaciones) {
    return {
      titulo: 'Sin stock en la ubicación filtrada',
      subtitulo:
        'Hay ubicaciones registradas, pero ningún material con cantidad disponible. Pruebe otro almacén o limpie filtros.',
    };
  }

  if (opts.filtroSoloEntidad && !opts.filtroSinUbicaciones) {
    return {
      titulo: 'Sin stock en esta entidad',
      subtitulo:
        'No hay materiales con cantidad en los almacenes de la entidad. Elija una obra o almacén concreto.',
    };
  }

  if (opts.hayFiltrosActivos && !opts.filtroStockPorUbicacion && !opts.filtroSoloEntidad && opts.filterEntidadId) {
    return {
      titulo: 'Sin materiales para esta entidad',
      subtitulo:
        'No hay ítems del catálogo clasificados bajo esta entidad. Registre materiales con entidad o prefijo SAP de la entidad.',
    };
  }

  if (opts.hayFiltrosActivos && opts.filtroGastoEntidad) {
    return {
      titulo: 'Sin materiales para este gasto de entidad',
      subtitulo:
        'No hay ítems OpEx con esa clasificación. Use imputación entidad en compras o asigne clasificación al material.',
    };
  }

  if (opts.hayFiltrosActivos && opts.kpiCuarentena) {
    return {
      titulo: 'Sin inspecciones en cuarentena',
      subtitulo:
        'No hay mercancía pendiente de liberación para la entidad u obra seleccionada.',
    };
  }

  if (opts.hayFiltrosActivos) {
    return {
      titulo: 'No se encontraron materiales',
      subtitulo: 'Ajusta búsqueda, categoría o filtros avanzados.',
    };
  }

  return {
    titulo: 'No se encontraron materiales',
    subtitulo: 'Registra un nuevo ítem o verifica que haya stock en almacén.',
  };
}

function normalizarEtiquetaEntidad(s: string): string {
  return s.trim().toLowerCase().replace(/\s+/g, ' ');
}

/** Coincide clasificación de catálogo (entidad_id, obra de la entidad o prefijo SAP). */
export function materialCoincideCatalogoEntidad(
  item: {
    entidad_id?: string | null;
    proyecto_id?: string | null;
    proyecto?: { entidad_id?: string | null } | null;
    entidad?: { id?: string | null; nombre?: string | null } | null;
    sap_code?: string | null;
  },
  opts: {
    filterEntidadId: string;
    filterEntidadNombre?: string | null;
    proyectoIdsEntidad?: Set<string>;
    sapPrefijoEntidad?: string | null;
  },
): boolean {
  const eid = opts.filterEntidadId.trim();
  if (!eid) return true;
  if (String(item.entidad_id ?? '').trim() === eid) return true;
  if (String(item.entidad?.id ?? '').trim() === eid) return true;
  if (String(item.proyecto?.entidad_id ?? '').trim() === eid) return true;
  const pid = item.proyecto_id?.trim();
  if (pid && opts.proyectoIdsEntidad?.has(pid)) return true;
  const pref = opts.sapPrefijoEntidad?.trim().toUpperCase();
  const sap = item.sap_code?.trim().toUpperCase();
  if (pref && sap && (sap.startsWith(`${pref}-`) || sap.startsWith(pref))) return true;
  const nombreFiltro = opts.filterEntidadNombre?.trim();
  const nombreItem = item.entidad?.nombre?.trim();
  if (nombreFiltro && nombreItem) {
    const nf = normalizarEtiquetaEntidad(nombreFiltro);
    const ni = normalizarEtiquetaEntidad(nombreItem);
    if (ni === nf || ni.includes(nf) || nf.includes(ni)) return true;
  }
  return false;
}

/** Catálogo o stock físico en el depósito filtrado o en algún almacén del alcance obra/entidad. */
export function materialAsignadoDepositoEnAlcance(
  item: { deposit_id?: string | null },
  stockUb: { deposit_ids?: string[] } | undefined,
  opts: {
    filterDepositId?: string;
    depositIdsScope?: readonly string[];
  },
): boolean {
  const depId = opts.filterDepositId?.trim();
  if (depId) {
    if (String(item.deposit_id ?? '').trim() === depId) return true;
    if (stockUb?.deposit_ids?.includes(depId)) return true;
    return false;
  }

  const scope = opts.depositIdsScope?.filter(Boolean) ?? [];
  if (!scope.length) return false;
  const scopeSet = new Set(scope);
  const catalogDep = String(item.deposit_id ?? '').trim();
  if (catalogDep && scopeSet.has(catalogDep)) return true;
  if (stockUb?.deposit_ids?.some((id) => scopeSet.has(id))) return true;
  return false;
}

/** Stock físico o asignación de catálogo en el depósito filtrado. */
export function materialPasaFiltroDeposito(
  item: { deposit_id?: string | null },
  stockUb: { deposit_ids?: string[]; cantidad_disponible?: number } | undefined,
  opts: {
    filterDepositId?: string;
    filtroStockPorUbicacion: boolean;
    filtroSinUbicaciones: boolean;
    cargandoStockUbicacion: boolean;
  },
): boolean {
  const depId = opts.filterDepositId?.trim();
  if (!depId) return true;

  const stockEnDeposito = Number(stockUb?.cantidad_disponible ?? 0);
  const catalogDep = String(item.deposit_id ?? '').trim();
  const depositIdsFisicos = stockUb?.deposit_ids ?? [];

  if (stockEnDeposito > 0) return true;
  if (catalogDep === depId) return true;
  if (depositIdsFisicos.includes(depId)) return true;

  if (opts.filtroSinUbicaciones && opts.filtroStockPorUbicacion) {
    return catalogDep === depId;
  }

  if (!opts.filtroStockPorUbicacion) {
    return catalogDep === depId;
  }

  if (opts.cargandoStockUbicacion && catalogDep === depId) return true;

  return false;
}

/** Cuarentena operativa acotada a entidad / obra / ubicaciones del cuadro. */
export function filtrarInspeccionesCuarentenaCuadro(
  rows: InspeccionCuarentenaRow[],
  opts: {
    filterEntidadId?: string;
    filterProyectoId?: string;
    filterDepositId?: string;
    ubicacionIdsFiltro?: readonly string[];
  },
): InspeccionCuarentenaRow[] {
  const entidad = opts.filterEntidadId?.trim();
  const proyecto = opts.filterProyectoId?.trim();
  const deposito = opts.filterDepositId?.trim();
  const ubSet = opts.ubicacionIdsFiltro?.length
    ? new Set(opts.ubicacionIdsFiltro)
    : null;

  if (!entidad && !proyecto && !deposito) return rows;

  return rows.filter((row) => {
    if (entidad && row.entidad_id?.trim() !== entidad) return false;
    if (proyecto && row.proyecto_id?.trim() !== proyecto) return false;
    if (ubSet?.size) {
      const ub = row.ubicacion_destino_id?.trim();
      if (ub && !ubSet.has(ub)) return false;
    }
    return true;
  });
}
