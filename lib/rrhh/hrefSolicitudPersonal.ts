export type HrefSolicitudPersonalOpts = {
  proyectoModuloId?: string | null;
  proyectoObraId?: string | null;
};

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

/** Cuadro de solicitados (oficios + plazas) filtrado por proyecto módulo. */
export function hrefGestionPersonalSolicitados(opts?: { proyectoModuloId?: string | null }): string {
  const params = new URLSearchParams({ solo: 'pendientes' });
  const mod = opts?.proyectoModuloId?.trim();
  if (mod) params.set('proyecto_modulo', mod);
  return `/rrhh/gestion-personal?${params}#cuadro-solicitados`;
}
