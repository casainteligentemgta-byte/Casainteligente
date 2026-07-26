import { hrefRrhhHub } from '@/lib/rrhh/hrefSolicitudPersonal';

/** Última obra (módulo integral) usada en RRHH — menú inferior y deep-links. */
export const RRHH_PROYECTO_MODULO_STORAGE_KEY = 'ci-rrhh-proyecto-modulo-v1';

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function esUuidProyectoModulo(id: string | null | undefined): boolean {
  return Boolean(id && UUID_RE.test(id.trim()));
}

/** Extrae el id de `/proyectos/modulo/[id]` (no listado ni rutas hijas sin id). */
export function proyectoModuloIdDesdePathname(pathname: string): string | null {
  const m = pathname.match(/^\/proyectos\/modulo\/([^/]+)(?:\/|$)/);
  if (!m?.[1] || m[1] === 'nuevo') return null;
  const id = decodeURIComponent(m[1]).trim();
  return esUuidProyectoModulo(id) ? id : null;
}

export function leerProyectoRrhhContexto(): string | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(RRHH_PROYECTO_MODULO_STORAGE_KEY)?.trim() ?? '';
    return esUuidProyectoModulo(raw) ? raw : null;
  } catch {
    return null;
  }
}

export function guardarProyectoRrhhContexto(proyectoModuloId: string | null | undefined): void {
  if (typeof window === 'undefined') return;
  try {
    const id = (proyectoModuloId ?? '').trim();
    if (!esUuidProyectoModulo(id)) {
      localStorage.removeItem(RRHH_PROYECTO_MODULO_STORAGE_KEY);
      return;
    }
    localStorage.setItem(RRHH_PROYECTO_MODULO_STORAGE_KEY, id);
  } catch {
    /* ignore quota / private mode */
  }
}

/**
 * Destino del botón RRHH del menú inferior:
 * 1) obra de la URL actual (`/proyectos/modulo/[id]`),
 * 2) última obra guardada,
 * 3) hub RRHH sin filtro.
 */
export function hrefRrhhMenuInferior(pathname: string): string {
  const fromPath = proyectoModuloIdDesdePathname(pathname);
  if (fromPath) return hrefRrhhHub({ proyectoModuloId: fromPath });
  const stored = leerProyectoRrhhContexto();
  if (stored) return hrefRrhhHub({ proyectoModuloId: stored });
  return hrefRrhhHub();
}

/** ¿La ruta actual es el hub RRHH o el tab RRHH embebido en el proyecto? */
export function esRutaRrhhActiva(pathname: string, tabQuery?: string | null): boolean {
  if (pathname.startsWith('/rrhh')) return true;
  if (proyectoModuloIdDesdePathname(pathname) && (tabQuery ?? '').trim() === 'rrhh') {
    return true;
  }
  return false;
}
