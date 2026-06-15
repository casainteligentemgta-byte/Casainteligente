import type { InventarioShareState } from '@/lib/almacen/inventarioExportShare';

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
  hayFiltrosActivos: boolean;
}): MensajeVacioCuadroAlmacen | null {
  if (opts.cargandoStockUbicacion) return null;

  if (opts.filtroSinUbicaciones && opts.filtroStockPorUbicacion) {
    if (opts.filterDepositId && !opts.filterProyectoId && !opts.filterEntidadId) {
      return {
        titulo: 'Sin ubicaciones para este almacén',
        subtitulo:
          'No hay sitios de inventario (inv_ubicaciones) vinculados a ese depósito. Revise maestros o elija una obra.',
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

  if (opts.hayFiltrosActivos && !opts.filtroStockPorUbicacion && opts.filterEntidadId) {
    return {
      titulo: 'Sin materiales para esta entidad',
      subtitulo:
        'No hay ítems del catálogo clasificados bajo esta entidad con stock disponible. Pruebe otra entidad o limpie filtros.',
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
