/**
 * Mapa de navegación del módulo RRHH (fuente única).
 * Organizado por trabajo: Personal → Contratos → Nómina → Tabulador.
 * Fase 2: ítems filtrables por alcance entidad (Dirección) vs obra.
 */

import type { RrhhAlcanceMode, RrhhAlcanceState } from '@/lib/rrhh/rrhhAlcance';
import { queryRrhhAlcance } from '@/lib/rrhh/rrhhAlcance';

export const RRHH_HUB_HREF = '/rrhh/hojas-vida';

export type RrhhNavItem = {
  href: string;
  label: string;
  /** Prefijos adicionales que marcan el ítem activo. */
  matchPrefixes?: string[];
  /** Si true, solo activo en coincidencia exacta de pathname. */
  exact?: boolean;
  /**
   * Alcances donde el ítem es primario.
   * Si se omite → visible en ambos.
   */
  alcances?: RrhhAlcanceMode[];
};

export type RrhhNavSection = {
  id: string;
  label: string;
  items: RrhhNavItem[];
};

export const RRHH_NAV_SECTIONS: RrhhNavSection[] = [
  {
    id: 'inicio',
    label: 'Inicio',
    items: [
      {
        href: RRHH_HUB_HREF,
        label: 'Cuadro',
        exact: true,
      },
    ],
  },
  {
    id: 'personal',
    label: 'Personal',
    items: [
      { href: '/rrhh/solicitud-personal', label: 'Solicitud', alcances: ['obra'] },
      { href: '/rrhh/gestion-personal', label: 'Gestión', alcances: ['obra'] },
      { href: '/rrhh/banca', label: 'Banca', alcances: ['entidad'] },
      { href: '/rrhh/trabajadores', label: 'Trabajadores', alcances: ['entidad'] },
      {
        href: '/rrhh/hojas-vida/archivo',
        label: 'Expedientes',
        matchPrefixes: ['/rrhh/hojas-vida/archivo'],
        alcances: ['entidad', 'obra'],
      },
      { href: '/rrhh/reclutamiento', label: 'Reclutamiento', alcances: ['entidad'] },
    ],
  },
  {
    id: 'contratos',
    label: 'Contratos',
    items: [{ href: '/rrhh/express', label: 'Express', alcances: ['obra'] }],
  },
  {
    id: 'nomina',
    label: 'Nómina',
    items: [
      {
        href: '/rrhh/nomina',
        label: 'Periodos',
        matchPrefixes: ['/rrhh/nomina'],
        alcances: ['entidad'],
      },
      { href: '/rrhh/liquidaciones', label: 'Liquidaciones', alcances: ['entidad'] },
      { href: '/rrhh/parafiscales', label: 'Parafiscales', alcances: ['entidad'] },
    ],
  },
  {
    id: 'tabulador',
    label: 'Tabulador',
    items: [
      { href: '/rrhh/oficios-salarios', label: 'Oficios y salarios', alcances: ['entidad'] },
    ],
  },
];

/** Pasos del puente operativo (hub). */
export const RRHH_FLUJO_PASOS: {
  id: string;
  label: string;
  href: string;
  alcances: RrhhAlcanceMode[];
}[] = [
  { id: 'solicitud', label: '1. Solicitud', href: '/rrhh/solicitud-personal', alcances: ['obra'] },
  { id: 'express', label: '2. Express', href: '/rrhh/express', alcances: ['obra'] },
  {
    id: 'expediente',
    label: '3. Expediente',
    href: '/rrhh/hojas-vida/archivo',
    alcances: ['entidad', 'obra'],
  },
  { id: 'nomina', label: '4. Nómina', href: '/rrhh/nomina', alcances: ['entidad'] },
];

/** Rutas públicas o sin shell (alta rápida, etc.). */
export function rrhhPathSinShell(pathname: string): boolean {
  const p = pathname.trim();
  return p === '/rrhh/registro' || p.startsWith('/rrhh/registro/');
}

export function rrhhNavItemActivo(pathname: string, item: RrhhNavItem): boolean {
  const path = pathname.split('?')[0] ?? pathname;
  if (item.exact) {
    if (path === item.href) return true;
    if (item.href === RRHH_HUB_HREF) {
      return path === RRHH_HUB_HREF || path === '/rrhh';
    }
    return false;
  }
  if (path === item.href || path.startsWith(`${item.href}/`)) return true;
  return (item.matchPrefixes ?? []).some(
    (pref) => path === pref || path.startsWith(`${pref}/`),
  );
}

export function itemVisibleEnAlcance(
  item: { alcances?: RrhhAlcanceMode[] },
  mode: RrhhAlcanceMode,
): boolean {
  if (!item.alcances || item.alcances.length === 0) return true;
  return item.alcances.includes(mode);
}

export function filtrarNavPorAlcance(
  sections: RrhhNavSection[],
  mode: RrhhAlcanceMode,
): RrhhNavSection[] {
  return sections
    .map((s) => ({
      ...s,
      items: s.items.filter((it) => itemVisibleEnAlcance(it, mode)),
    }))
    .filter((s) => s.items.length > 0);
}

/**
 * Añade query de alcance / obra / entidad a un href RRHH.
 */
export function hrefRrhhConAlcance(
  href: string,
  alcance: RrhhAlcanceState,
): string {
  const base = href.split('?')[0] ?? href;
  const existing = href.includes('?') ? href.slice(href.indexOf('?') + 1) : '';
  const params = new URLSearchParams(existing);

  params.set('alcance', alcance.mode);

  if (alcance.entidadId) {
    params.set('entidad', alcance.entidadId);
  } else {
    params.delete('entidad');
  }

  if (alcance.mode === 'obra' && alcance.proyectoModuloId) {
    if (
      base.startsWith('/rrhh/express') ||
      base.startsWith('/rrhh/solicitud-personal') ||
      base.startsWith('/rrhh/gestion-personal') ||
      base.startsWith('/rrhh/hojas-vida')
    ) {
      const key = base.startsWith('/rrhh/express') ? 'proyecto' : 'proyecto_modulo';
      params.set(key, alcance.proyectoModuloId);
      if (key === 'proyecto') params.set('proyecto_modulo', alcance.proyectoModuloId);
      if (key === 'proyecto_modulo') params.set('proyecto', alcance.proyectoModuloId);
    }
  }

  const q = params.toString();
  return q ? `${base}?${q}` : base;
}

/** @deprecated Preferir `hrefRrhhConAlcance`. */
export function hrefRrhhConProyecto(href: string, proyectoModuloId?: string | null): string {
  return hrefRrhhConAlcance(href, {
    mode: 'obra',
    entidadId: null,
    proyectoModuloId: (proyectoModuloId ?? '').trim() || null,
  });
}

export function hrefHubConAlcance(alcance: RrhhAlcanceState): string {
  return `${RRHH_HUB_HREF}${queryRrhhAlcance(alcance)}`;
}
