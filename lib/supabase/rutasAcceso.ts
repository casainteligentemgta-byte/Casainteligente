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
  // Leen tablas que solo responden con sesión (migración 345): sin ella se va a /login
  // en vez de mostrar la página vacía.
  '/clientes',
  '/dashboard',
  '/flota',
  '/personas',
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

/**
 * APIs de almacén, compras y procuras. Sus rutas trabajan con service_role (no pasan
 * por las políticas de la base), así que la sesión se exige aquí: sin ella responden 401.
 * El bot de Telegram y los cron no usan estas rutas.
 */
export const APIS_CON_SESION = [
  '/api/almacen',
  '/api/compras',
  '/api/procuras',
  '/api/facturas-canal',
  '/api/contabilidad/compras',
  // Quién puede usar el bot: no debe poder leerse ni cambiarse sin sesión.
  // (El webhook del bot es /api/telegram y /api/webhooks/telegram: esos siguen abiertos.)
  '/api/telegram/whitelist',
];

/** ¿Esta ruta de API debe rechazar a quien llama sin sesión? */
export function apiRequiereSesion(pathname: string): boolean {
  return bajo(APIS_CON_SESION, pathname);
}

/** ¿Hay que mandar a /login a quien entra a esta ruta sin sesión? */
export function requiereSesion(pathname: string): boolean {
  return (esRutaProtegida(pathname) && !esRutaPublica(pathname)) || esRutaStaffBajoPublico(pathname);
}
