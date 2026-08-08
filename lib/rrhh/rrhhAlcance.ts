/**
 * Alcance operativo del módulo RRHH:
 * - `entidad` = Dirección de RRHH (políticas, banca, nómina, expedientes)
 * - `obra` = RRHH de obra (solicitud, gestión, express)
 *
 * Persistencia: URL + localStorage (`ci-rrhh-alcance-v1`).
 */

export type RrhhAlcanceMode = 'entidad' | 'obra';

export type RrhhAlcanceState = {
  mode: RrhhAlcanceMode;
  entidadId: string | null;
  proyectoModuloId: string | null;
};

export const RRHH_ALCANCE_STORAGE_KEY = 'ci-rrhh-alcance-v1';

export const RRHH_ALCANCE_DEFAULT: RrhhAlcanceState = {
  mode: 'obra',
  entidadId: null,
  proyectoModuloId: null,
};

export function parseRrhhAlcanceMode(raw: string | null | undefined): RrhhAlcanceMode | null {
  const v = (raw ?? '').trim().toLowerCase();
  if (v === 'entidad' || v === 'direccion') return 'entidad';
  if (v === 'obra' || v === 'proyecto') return 'obra';
  return null;
}

export function leerRrhhAlcanceDesdeStorage(): RrhhAlcanceState | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(RRHH_ALCANCE_STORAGE_KEY);
    if (!raw) return null;
    const j = JSON.parse(raw) as Partial<RrhhAlcanceState>;
    const mode = parseRrhhAlcanceMode(j.mode as string) ?? RRHH_ALCANCE_DEFAULT.mode;
    return {
      mode,
      entidadId: (j.entidadId ?? '').trim() || null,
      proyectoModuloId: (j.proyectoModuloId ?? '').trim() || null,
    };
  } catch {
    return null;
  }
}

export function guardarRrhhAlcanceEnStorage(state: RrhhAlcanceState): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(RRHH_ALCANCE_STORAGE_KEY, JSON.stringify(state));
  } catch {
    /* quota / privado */
  }
}

/** Lee alcance desde searchParams (prioridad) con fallback a storage. */
export function resolverRrhhAlcanceDesdeUrl(
  searchParams: URLSearchParams | { get: (k: string) => string | null },
): RrhhAlcanceState {
  const stored = typeof window !== 'undefined' ? leerRrhhAlcanceDesdeStorage() : null;
  const modeUrl = parseRrhhAlcanceMode(searchParams.get('alcance'));
  const entidadUrl = (searchParams.get('entidad') ?? '').trim() || null;
  const proyectoUrl =
    (searchParams.get('proyecto_modulo') ?? searchParams.get('proyecto') ?? '').trim() || null;

  const mode = modeUrl ?? stored?.mode ?? RRHH_ALCANCE_DEFAULT.mode;
  return {
    mode,
    entidadId: entidadUrl ?? stored?.entidadId ?? null,
    proyectoModuloId: proyectoUrl ?? stored?.proyectoModuloId ?? null,
  };
}

/** Construye query string de alcance para navegar manteniendo contexto. */
export function queryRrhhAlcance(state: RrhhAlcanceState): string {
  const params = new URLSearchParams();
  params.set('alcance', state.mode);
  if (state.mode === 'entidad' && state.entidadId) {
    params.set('entidad', state.entidadId);
  }
  if (state.mode === 'obra' && state.proyectoModuloId) {
    params.set('proyecto_modulo', state.proyectoModuloId);
    params.set('proyecto', state.proyectoModuloId);
  }
  if (state.mode === 'obra' && state.entidadId) {
    params.set('entidad', state.entidadId);
  }
  const q = params.toString();
  return q ? `?${q}` : '';
}

export function etiquetaRrhhAlcanceMode(mode: RrhhAlcanceMode): string {
  return mode === 'entidad' ? 'Dirección RRHH' : 'RRHH de obra';
}
