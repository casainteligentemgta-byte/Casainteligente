import type { Permiso, RolEmpresa } from '@/lib/auth/permisosCatalogo';
import { normalizarRolEmpresa } from '@/lib/auth/permisosCatalogo';

/** Identificadores de módulos visibles en la nav inferior. */
export type ModuloNavId =
  | 'inicio'
  | 'clientes'
  | 'presupuestos'
  | 'ventas'
  | 'productos'
  | 'proyectos'
  | 'domotica'
  | 'entidades'
  | 'rrhh'
  | 'almacen'
  | 'contabilidad'
  | 'cco'
  | 'equipo'
  | 'legal';

export type ModuloNavDef = {
  id: ModuloNavId;
  href: string;
  label: string;
};

/** Orden y rutas del dock (alineado a IOSNavBar). */
export const MODULOS_NAV: ModuloNavDef[] = [
  { id: 'inicio', href: '/', label: 'Inicio' },
  { id: 'domotica', href: '/nexus/vision', label: 'CCTV · NetVision' },
  { id: 'clientes', href: '/clientes', label: 'Clientes' },
  { id: 'presupuestos', href: '/presupuestos', label: 'Presupuestos' },
  { id: 'ventas', href: '/ventas', label: 'Ventas' },
  { id: 'productos', href: '/productos', label: 'Productos' },
  { id: 'proyectos', href: '/proyectos/modulo', label: 'Proyectos' },
  { id: 'entidades', href: '/configuracion/entidades', label: 'Entidades' },
  { id: 'equipo', href: '/configuracion/equipo', label: 'Equipo' },
  { id: 'legal', href: '/legal', label: 'Legal' },
  { id: 'rrhh', href: '/rrhh/hojas-vida', label: 'RRHH' },
  { id: 'almacen', href: '/almacen', label: 'Almacenes' },
  { id: 'contabilidad', href: '/contabilidad', label: 'Conta' },
  { id: 'cco', href: '/contabilidad/cco', label: 'CCO' },
];

const MODULOS_POR_ROL: Record<RolEmpresa, ModuloNavId[]> = {
  admin: [
    'inicio',
    'clientes',
    'presupuestos',
    'ventas',
    'productos',
    'proyectos',
    'domotica',
    'entidades',
    'equipo',
    'rrhh',
    'almacen',
    'contabilidad',
  ],
  pm_obra: [
    'inicio',
    'clientes',
    'presupuestos',
    'proyectos',
    'domotica',
    'almacen',
    'contabilidad',
  ],
  contador: ['inicio', 'proyectos', 'contabilidad'],
  comprador: ['inicio', 'proyectos', 'almacen', 'contabilidad'],
  almacen_central: ['inicio', 'almacen', 'contabilidad'],
  rrhh: ['inicio', 'rrhh', 'proyectos', 'equipo'],
  solo_lectura: ['inicio', 'proyectos', 'domotica', 'contabilidad', 'almacen'],
  /** Suegro / invitado: solo Control Contable de Obra (lectura). */
  cco_lectura: ['inicio', 'cco'],
};

/** Si no hay rol: solo inicio (evita menú completo a invitados sin asignar). */
const MODULOS_SIN_ROL: ModuloNavId[] = ['inicio'];

export function modulosParaRolesEmpresa(roles: string[]): Set<ModuloNavId> {
  const out = new Set<ModuloNavId>();
  let alguno = false;
  for (const raw of roles) {
    const norm = normalizarRolEmpresa(raw);
    if (!norm) continue;
    alguno = true;
    for (const m of MODULOS_POR_ROL[norm]) out.add(m);
  }
  if (!alguno) {
    for (const m of MODULOS_SIN_ROL) out.add(m);
  }
  return out;
}

/** Refuerzo por permiso (si el catálogo de acciones otorga acceso adicional). */
export function ampliarModulosPorPermisos(
  modulos: Set<ModuloNavId>,
  permisos: Iterable<string>,
): Set<ModuloNavId> {
  const set = new Set(modulos);
  const ps = new Set(permisos as Iterable<Permiso | string>);
  if (ps.has('admin.config') || ps.has('equipo.gestionar')) {
    set.add('entidades');
    set.add('equipo');
  }
  if (
    ps.has('compra.registrar') ||
    ps.has('compra.confirmar') ||
    ps.has('compra.verificar_fecha')
  ) {
    set.add('contabilidad');
  }
  if (ps.has('almacen.ingreso') || ps.has('almacen.despacho') || ps.has('almacen.cuarentena')) {
    set.add('almacen');
  }
  if (ps.has('procura.aprobar') || ps.has('procura.ejecutar_compra')) {
    set.add('contabilidad');
    set.add('proyectos');
  }
  if (ps.has('cco.ver') || ps.has('cco.editar')) {
    if (!set.has('contabilidad')) set.add('cco');
  }
  return set;
}

function esRutaCco(pathname: string): boolean {
  return (
    pathname === '/contabilidad/cco' ||
    pathname.startsWith('/contabilidad/cco/') ||
    pathname === '/contabilidad/vista-previa-cco' ||
    pathname.startsWith('/contabilidad/vista-previa-cco/')
  );
}

/** Prefijos de app cuyo acceso exige el módulo indicado (resto de rutas no se bloquea). */
const GATES_POR_RUTA: Array<{ modulo: ModuloNavId; match: (pathname: string) => boolean }> = [
  { modulo: 'clientes', match: (p) => p === '/clientes' || p.startsWith('/clientes/') },
  { modulo: 'presupuestos', match: (p) => p === '/presupuestos' || p.startsWith('/presupuestos/') },
  { modulo: 'ventas', match: (p) => p === '/ventas' || p.startsWith('/ventas/') },
  { modulo: 'productos', match: (p) => p === '/productos' || p.startsWith('/productos/') },
  {
    modulo: 'proyectos',
    match: (p) => p === '/proyectos' || p.startsWith('/proyectos/'),
  },
  {
    modulo: 'entidades',
    match: (p) =>
      p.startsWith('/configuracion/entidades') || p === '/entidades' || p.startsWith('/entidades/'),
  },
  {
    modulo: 'equipo',
    match: (p) =>
      p.startsWith('/configuracion/equipo') ||
      p.startsWith('/configuracion/telegram') ||
      p === '/configuracion',
  },
  {
    modulo: 'rrhh',
    match: (p) =>
      (p === '/rrhh' || p.startsWith('/rrhh/')) && !p.includes('reclutamiento') && !p.startsWith('/rrhh/registro'),
  },
  { modulo: 'almacen', match: (p) => p === '/almacen' || p.startsWith('/almacen/') },
  {
    modulo: 'contabilidad',
    match: (p) =>
      !esRutaCco(p) &&
      (p === '/contabilidad' || p.startsWith('/contabilidad/') || p.startsWith('/procura')),
  },
  { modulo: 'cco', match: (p) => esRutaCco(p) },
  { modulo: 'legal', match: (p) => p === '/legal' || p.startsWith('/legal/') },
];

/**
 * true = la ruta está permitida.
 * Rutas fuera del menú (admin, nexus, registro…) no se bloquean.
 */
export function hrefPermitidoPorModulos(pathname: string, modulos: Set<ModuloNavId>): boolean {
  if (
    pathname === '/' ||
    pathname.startsWith('/login') ||
    pathname.startsWith('/auth') ||
    pathname.startsWith('/nexus') ||
    pathname.startsWith('/registro')
  ) {
    return true;
  }

  // CCO: módulo dedicado o contabilidad completa.
  if (esRutaCco(pathname)) {
    return modulos.has('cco') || modulos.has('contabilidad');
  }

  for (const gate of GATES_POR_RUTA) {
    if (!gate.match(pathname)) continue;
    return modulos.has(gate.modulo);
  }
  return true;
}
