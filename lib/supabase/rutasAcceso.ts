/**
 * Qué rutas de la app piden sesión. Funciones puras (sin Next ni Supabase)
 * para poder probarlas; las usa el middleware.
 */

/** Se abren sin sesión (formularios públicos, enlace del cliente, login). */
export const RUTAS_PUBLICAS = [
  '/login',
  '/auth',
  '/rrhh/registro',
  '/registro',
  '/reclutamiento',
  '/onboarding',
  '/talento/examen',
  '/talento/evaluacion',
  '/talento/evaluacion-obrero',
  '/talento/evaluacion-color',
  '/nexus',
  '/abogado',
  // Vista previa del presupuesto: su demostración (?demo=1) no usa datos reales.
  '/ventas/preview',
];

/** Piden sesión: sin ella se redirige a /login. */
export const RUTAS_PROTEGIDAS = [
  '/contabilidad',
  '/almacen',
  // Catálogo (costos y precios) y presupuestos: solo personal con sesión.
  '/productos',
  '/ventas',
  '/configuracion',
  '/admin',
  '/proyectos',
  '/netvision',
  '/rrhh',
  '/procura',
  '/legal',
  '/agenda',
  '/pheme',
  '/metron',
  '/empleados',
  '/cambiar-password',
  '/obra-digital',
  '/entidades',
];

/** Rutas de personal que cuelgan de un prefijo público: siempre exigen sesión. */
export const RUTAS_STAFF_BAJO_PREFIJO_PUBLICO = ['/reclutamiento/hoja-de-vida/view'];

const bajo = (lista: readonly string[], pathname: string) =>
  lista.some((p) => pathname === p || pathname.startsWith(`${p}/`));

export function esRutaStaffBajoPublico(pathname: string): boolean {
  return bajo(RUTAS_STAFF_BAJO_PREFIJO_PUBLICO, pathname);
}

export function esRutaPublica(pathname: string): boolean {
  return bajo(RUTAS_PUBLICAS, pathname);
}

export function esRutaProtegida(pathname: string): boolean {
  return bajo(RUTAS_PROTEGIDAS, pathname);
}

/** ¿Hay que mandar a /login a quien entra a esta ruta sin sesión? */
export function requiereSesion(pathname: string): boolean {
  return (esRutaProtegida(pathname) && !esRutaPublica(pathname)) || esRutaStaffBajoPublico(pathname);
}
