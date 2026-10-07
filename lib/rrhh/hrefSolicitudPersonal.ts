export type HrefSolicitudPersonalOpts = {
  proyectoModuloId?: string | null;
  proyectoObraId?: string | null;
};

/** RRHH unificado (menú inferior + obra): vacantes, cuadro, reclutamiento y nómina. */
export function hrefRrhhHub(opts?: { proyectoModuloId?: string | null }): string {
  const mod = opts?.proyectoModuloId?.trim();
  if (mod) return `/rrhh/hojas-vida?proyecto_modulo=${encodeURIComponent(mod)}`;
  return '/rrhh/hojas-vida';
}

/** Formulario de solicitud de personal obrero (oficio + cantidad, tabulador GOE). */
export function hrefSolicitudPersonalObrero(opts?: HrefSolicitudPersonalOpts): string {
  const params = new URLSearchParams();
  const mod = opts?.proyectoModuloId?.trim();
  const obra = opts?.proyectoObraId?.trim();
  if (mod) params.set('proyecto_modulo', mod);
  if (obra) params.set('proyecto', obra);
  const q = params.toString();
  return q ? `/rrhh/solicitud-personal?${q}` : '/rrhh/solicitud-personal';
}

/**
 * Antes llevaba al «cuadro de solicitados» de Gestión laboral. Las solicitudes viven ahora
 * en una sola pantalla, así que apunta a ella (con la obra, cuando es una sola).
 */
export function hrefGestionPersonalSolicitados(opts?: {
  proyectoModuloId?: string | null;
  proyectoModuloIds?: string[];
  entidadId?: string | null;
  todosLosProyectos?: boolean;
}): string {
  const ids = (opts?.proyectoModuloIds ?? []).map((s) => s.trim()).filter(Boolean);
  const mod = opts?.proyectoModuloId?.trim() || (ids.length === 1 ? ids[0]! : '');
  const variasObras = Boolean(opts?.entidadId?.trim()) || Boolean(opts?.todosLosProyectos) || ids.length > 1;
  return hrefSolicitudPersonalObrero({ proyectoModuloId: variasObras ? null : mod });
}
