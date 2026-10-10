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
  // Lista de obras y su rentabilidad: la tabla de obras solo responde con sesión.
  '/operaciones',
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
 * APIs del personal. Sus rutas trabajan con service_role (no pasan por las políticas de
 * la base), así que la sesión se exige aquí: sin ella responden 401.
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
  // RRHH, contratos, vacantes y configuración: todo lo que cuelga de estos prefijos pide
  // sesión, salvo las rutas del candidato listadas en APIS_DEL_CANDIDATO. Una ruta nueva
  // bajo estos prefijos nace cerrada.
  '/api/rrhh',
  '/api/talento',
  '/api/recruitment',
  '/api/reclutamiento',
  '/api/registro',
  '/api/admin',
];

/**
 * Rutas que usa el candidato o el trabajador SIN sesión, desde su enlace. Cada una valida
 * por su cuenta el enlace (token de invitación, identificador de la vacante o expediente
 * más cédula) y solo entrega o cambia lo de ese enlace. Antes de añadir una aquí,
 * comprobar que valida; si la usa el personal, no va aquí.
 */
export const APIS_DEL_CANDIDATO = [
  // Postulación (/registro, /reclutamiento?need=)
  '/api/reclutamiento/vacante',
  '/api/reclutamiento/captacion-meta',
  '/api/reclutamiento/captacion-completar',
  '/api/registro/finalizar',
  '/api/registro/subir-firma',
  // Entrevista guiada de la vacante
  '/api/recruitment/session',
  '/api/recruitment/session-cv',
  '/api/recruitment/turn',
  '/api/recruitment/events',
  // Planilla y firma con el token del expediente
  '/api/reclutamiento/patrono',
  '/api/reclutamiento/firma-resumen',
  '/api/talento/contratos/firmar',
  '/api/talento/hoja-legal/generar',
  '/api/registro/contrato-laboral',
  // Examen con el token de la invitación
  '/api/talento/examen',
];

/** ¿Esta ruta de API debe rechazar a quien llama sin sesión? */
export function apiRequiereSesion(pathname: string): boolean {
  return bajo(APIS_CON_SESION, pathname) && !bajo(APIS_DEL_CANDIDATO, pathname);
}

/** ¿Hay que mandar a /login a quien entra a esta ruta sin sesión? */
export function requiereSesion(pathname: string): boolean {
  return (esRutaProtegida(pathname) && !esRutaPublica(pathname)) || esRutaStaffBajoPublico(pathname);
}
