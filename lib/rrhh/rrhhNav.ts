/**
 * Mapa de navegación del módulo RRHH (fuente única).
 * Organizado por trabajo: Personal → Contratos → Nómina → Tabulador.
 */

export const RRHH_HUB_HREF = '/rrhh/hojas-vida';

export type RrhhNavItem = {
  href: string;
  label: string;
  /** Prefijos adicionales que marcan el ítem activo. */
  matchPrefixes?: string[];
  /** Si true, solo activo en coincidencia exacta de pathname. */
  exact?: boolean;
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
        label: 'Cuadro obra',
        exact: true,
      },
    ],
  },
  {
    id: 'personal',
    label: 'Personal',
    items: [
      { href: '/rrhh/solicitud-personal', label: 'Solicitud' },
      { href: '/rrhh/gestion-personal', label: 'Gestión' },
      { href: '/rrhh/banca', label: 'Banca' },
      { href: '/rrhh/trabajadores', label: 'Trabajadores' },
      {
        href: '/rrhh/hojas-vida/archivo',
        label: 'Expedientes',
        matchPrefixes: ['/rrhh/hojas-vida/archivo'],
      },
      { href: '/rrhh/reclutamiento', label: 'Reclutamiento' },
    ],
  },
  {
    id: 'contratos',
    label: 'Contratos',
    items: [{ href: '/rrhh/express', label: 'Express' }],
  },
  {
    id: 'nomina',
    label: 'Nómina',
    items: [
      { href: '/rrhh/nomina', label: 'Periodos', matchPrefixes: ['/rrhh/nomina'] },
      { href: '/rrhh/liquidaciones', label: 'Liquidaciones' },
      { href: '/rrhh/parafiscales', label: 'Parafiscales' },
    ],
  },
  {
    id: 'tabulador',
    label: 'Tabulador',
    items: [{ href: '/rrhh/oficios-salarios', label: 'Oficios y salarios' }],
  },
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
    // Hub: `/rrhh` redirige aquí; no marcar activo en `/rrhh/hojas-vida/archivo`
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

/** Añade `?proyecto=` si hay módulo de obra en contexto. */
export function hrefRrhhConProyecto(href: string, proyectoModuloId?: string | null): string {
  const id = (proyectoModuloId ?? '').trim();
  if (!id) return href;
  // Solo rutas que ya consumen el query de obra
  if (
    href.startsWith('/rrhh/express') ||
    href.startsWith('/rrhh/solicitud-personal') ||
    href.startsWith('/rrhh/gestion-personal')
  ) {
    const sep = href.includes('?') ? '&' : '?';
    const key = href.startsWith('/rrhh/express') ? 'proyecto' : 'proyecto_modulo';
    return `${href}${sep}${key}=${encodeURIComponent(id)}`;
  }
  return href;
}
