/**
 * Catálogo central de roles y permisos (empresa + obra).
 * Fuente de verdad en código; los roles en BD deben usar estos slugs o alias legacy.
 */

export const PERMISOS = [
  'procura.solicitar',
  'procura.aprobar',
  'procura.ejecutar_compra',
  'procura.usar_almacen',
  'compra.registrar',
  'compra.verificar_fecha',
  'compra.confirmar',
  'almacen.ingreso',
  'almacen.despacho',
  'almacen.cuarentena',
  'admin.config',
  'equipo.gestionar',
] as const;

export type Permiso = (typeof PERMISOS)[number];

export const ROLES_EMPRESA = [
  { value: 'admin', label: 'Administrador' },
  { value: 'pm_obra', label: 'Project manager / coordinador' },
  { value: 'contador', label: 'Contador / contabilidad' },
  { value: 'comprador', label: 'Comprador / procura' },
  { value: 'almacen_central', label: 'Almacén central / logística' },
  { value: 'rrhh', label: 'RRHH' },
  { value: 'solo_lectura', label: 'Solo lectura' },
] as const;

export type RolEmpresa = (typeof ROLES_EMPRESA)[number]['value'];

/** Alias históricos en ci_usuarios_roles.rol */
export const ALIAS_ROL_EMPRESA: Record<string, RolEmpresa | 'solo_lectura'> = {
  admin: 'admin',
  administrador: 'admin',
  /** Rol enum en BD legacy (permisos absolutos). */
  super_admin: 'admin',
  pm_obra: 'pm_obra',
  proyectos: 'pm_obra',
  project_manager: 'pm_obra',
  contabilidad: 'contador',
  contador: 'contador',
  compras: 'comprador',
  comprador: 'comprador',
  procura: 'comprador',
  almacen: 'almacen_central',
  almacen_central: 'almacen_central',
  logistica: 'almacen_central',
  rrhh: 'rrhh',
  solo_lectura: 'solo_lectura',
  lectura: 'solo_lectura',
};

const TODOS: Permiso[] = [...PERMISOS];

const POR_ROL_EMPRESA: Record<RolEmpresa | 'solo_lectura', Permiso[]> = {
  admin: TODOS,
  pm_obra: [
    'procura.solicitar',
    'procura.aprobar',
    'procura.usar_almacen',
    'compra.registrar',
    'almacen.despacho',
    'equipo.gestionar',
  ],
  contador: [
    'compra.registrar',
    'compra.verificar_fecha',
    'compra.confirmar',
    'procura.solicitar',
  ],
  comprador: [
    'procura.solicitar',
    'procura.ejecutar_compra',
    'procura.usar_almacen',
    'compra.registrar',
    'compra.confirmar',
    'almacen.ingreso',
  ],
  almacen_central: [
    'procura.usar_almacen',
    'almacen.ingreso',
    'almacen.despacho',
    'almacen.cuarentena',
    'compra.registrar',
  ],
  rrhh: ['equipo.gestionar'],
  solo_lectura: [],
};

/** Roles de ci_proyecto_nomina.rol → permisos de campo / Telegram. */
export const PERMISOS_POR_ROL_OBRA: Record<string, Permiso[]> = {
  ingeniero_residente: ['procura.solicitar', 'almacen.despacho'],
  depositario: [
    'procura.solicitar',
    'procura.usar_almacen',
    'almacen.ingreso',
    'almacen.despacho',
    'almacen.cuarentena',
  ],
  supervisor: ['procura.solicitar', 'almacen.despacho'],
  maestro_obra: ['procura.solicitar', 'almacen.despacho'],
  coordinador: ['procura.solicitar', 'procura.aprobar', 'almacen.despacho'],
  logistica: ['procura.usar_almacen', 'almacen.ingreso', 'almacen.despacho', 'almacen.cuarentena'],
  residente_calidad: ['almacen.cuarentena'],
  administrativo: ['procura.solicitar'],
  oficial: ['procura.solicitar'],
  ayudante: [],
  peon: [],
};

export function normalizarRolEmpresa(rol: string): RolEmpresa | 'solo_lectura' | null {
  const k = rol.trim().toLowerCase().replace(/\s+/g, '_');
  return ALIAS_ROL_EMPRESA[k] ?? null;
}

export function permisosDeRolesEmpresa(roles: string[]): Set<Permiso> {
  const out = new Set<Permiso>();
  for (const raw of roles) {
    const norm = normalizarRolEmpresa(raw);
    if (!norm) continue;
    for (const p of POR_ROL_EMPRESA[norm]) out.add(p);
  }
  return out;
}

export function permisosDeRolesObra(rolesObra: string[]): Set<Permiso> {
  const out = new Set<Permiso>();
  for (const raw of rolesObra) {
    const k = raw.trim().toLowerCase();
    for (const p of PERMISOS_POR_ROL_OBRA[k] ?? []) out.add(p);
  }
  return out;
}

export function permisoRequeridoParaEstadoProcura(estado: string): Permiso {
  if (estado === 'aprobada') return 'procura.usar_almacen';
  if (estado === 'en_compra') return 'procura.ejecutar_compra';
  if (estado === 'rechazada' || estado === 'cancelada') return 'procura.aprobar';
  return 'procura.aprobar';
}
