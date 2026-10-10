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
  // Presupuestos, contratos, evaluaciones y ajustes: pantallas del personal.
  '/presupuestos',
  '/contratos',
  '/evaluaciones',
  '/ajustes',
];

/** Rutas de personal que cuelgan de un prefijo público: siempre exigen sesión. */
export const RUTAS_STAFF_BAJO_PREFIJO_PUBLICO = [
  '/reclutamiento/hoja-de-vida/view',
  // Constructor de presupuestos y directorios de Nexus (el plano compartido con el
  // cliente, /nexus/vision/cliente, sigue abierto).
  '/nexus/builder',
  '/nexus/clientes',
  '/nexus/proyectos',
];

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
 * APIs: TODAS piden sesión, salvo las listadas aquí abajo. Muchas rutas trabajan con
 * service_role (no pasan por las políticas de la base), así que la sesión se exige en el
 * middleware: sin ella responden 401. Una ruta nueva nace cerrada.
 *
 * Quedan abiertas solo las que por diseño no pueden traer sesión, y cada una tiene su
 * propio control (clave, token o enlace) o no entrega datos:
 */
export const APIS_SIN_SESION = [
  // Telegram y WhatsApp llaman aquí; los protege su clave (lib/telegram/claveWebhook.ts).
  '/api/webhooks',
  '/api/webhook-logs',
  '/api/telegram/registrar-webhook',
  // Tareas programadas de Vercel: exigen CRON_SECRET.
  '/api/cron',
  // Aviso de la base de datos (exige ALERTS_WEBHOOK_SECRET) y del servidor de recorridos 3D
  // (exige el token del trabajo).
  '/api/alerts/telegram-exception',
  '/api/proyectos/tours/worker-callback',
  // Inicio de sesión y permisos: comprueban la sesión ellas mismas y deben responder
  // también a quien todavía no entró.
  '/api/auth',
  // Diagnóstico: solo dicen si el servidor responde.
  '/api/health',
  // Bot de ensayo: solo existe en las vistas previas (en producción responde 404).
  '/api/pruebas',
  // Expediente del candidato por token.
  '/api/expediente',
  // Plano compartido con el cliente por enlace (token).
  '/api/netvision/compartido',
];

/** Abiertas solo en esa dirección exacta (lo que cuelga de ellas sí pide sesión). */
export const APIS_SIN_SESION_EXACTAS = [
  // Webhook del bot (alias de /api/webhooks/telegram). /api/telegram/whitelist pide sesión.
  '/api/telegram',
  // Solicitud de acceso del portal de abogados (formulario público). Aprobar o listar
  // solicitudes (/api/legal/solicitudes/…) pide sesión.
  '/api/legal/solicitudes',
  // Tasa oficial del día: dato público.
  '/api/finanzas/bcv-tasa',
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
  if (pathname !== '/api' && !pathname.startsWith('/api/')) return false;
  if (APIS_SIN_SESION_EXACTAS.includes(pathname)) return false;
  if (bajo(APIS_SIN_SESION, pathname)) return false;
  if (bajo(APIS_DEL_CANDIDATO, pathname)) return false;
  return true;
}

/** ¿Hay que mandar a /login a quien entra a esta ruta sin sesión? */
export function requiereSesion(pathname: string): boolean {
  return (esRutaProtegida(pathname) && !esRutaPublica(pathname)) || esRutaStaffBajoPublico(pathname);
}
