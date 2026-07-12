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

/** Cuadro de solicitados (oficios + plazas) filtrado por proyecto módulo o todos. */
export function hrefGestionPersonalSolicitados(opts?: {
  proyectoModuloId?: string | null;
  proyectoModuloIds?: string[];
  entidadId?: string | null;
  todosLosProyectos?: boolean;
}): string {
  const params = new URLSearchParams({ solo: 'pendientes' });
  const mod = opts?.proyectoModuloId?.trim();
  const ent = opts?.entidadId?.trim();
  const ids = (opts?.proyectoModuloIds ?? []).map((s) => s.trim()).filter(Boolean);
  if (ent) params.set('entidad', ent);
  else if (opts?.todosLosProyectos) params.set('todos', '1');
  else if (ids.length > 1) params.set('proyecto_modulo_ids', ids.join(','));
  else if (mod) params.set('proyecto_modulo', mod);
  else if (ids.length === 1) params.set('proyecto_modulo', ids[0]!);
  return `/rrhh/gestion-personal?${params}#cuadro-solicitados`;
}
