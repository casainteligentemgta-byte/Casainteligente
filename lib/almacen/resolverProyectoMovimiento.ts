export type ProyectoRef = { id: string; nombre: string };

type FilaProyectoMovimiento = {
  proyecto_id: string | null;
  proyecto_nombre: string | null;
  destino: string | null;
  origen: string | null;
};

function normEtiqueta(s: string): string {
  return s.trim().toLowerCase().replace(/\s+/g, ' ');
}

/** Coincide etiqueta de ubicación/obra (p. ej. «RANCHO FLAMBOYANT»). */
export function etiquetaCoincideNombreObra(etiqueta: string, nombreObra: string): boolean {
  const e = normEtiqueta(etiqueta);
  const n = normEtiqueta(nombreObra);
  if (!e || !n) return false;
  return e === n || e.includes(n) || n.includes(e);
}

export function resolverProyectoDesdeEtiquetas(
  etiquetas: readonly (string | null | undefined)[],
  proyectos: readonly ProyectoRef[],
  proyectoIdsScope?: ReadonlySet<string>,
): ProyectoRef | null {
  const candidatos = proyectoIdsScope?.size
    ? proyectos.filter((p) => proyectoIdsScope.has(p.id))
    : proyectos;
  for (const et of etiquetas) {
    const t = String(et ?? '').trim();
    if (!t) continue;
    for (const p of candidatos) {
      if (etiquetaCoincideNombreObra(t, p.nombre)) return p;
    }
  }
  return null;
}

export function proyectoDesdeId(
  proyectoId: string | null | undefined,
  proyectos: readonly ProyectoRef[],
): ProyectoRef | null {
  const id = String(proyectoId ?? '').trim();
  if (!id) return null;
  return proyectos.find((p) => p.id === id) ?? null;
}

type UbicacionProyectoRow = {
  nombre?: string | null;
  ci_proyecto_id?: string | null;
  proyecto?: unknown;
};

function nombreProyJoin(raw: unknown): ProyectoRef | null {
  const p = Array.isArray(raw) ? raw[0] : raw;
  if (!p || typeof p !== 'object') return null;
  const o = p as { id?: string; nombre?: string };
  const id = String(o.id ?? '').trim();
  if (!id) return null;
  return { id, nombre: String(o.nombre ?? '').trim() || id };
}

/** Obra desde fila inv_ubicaciones (join, ci_proyecto_id o nombre del almacén). */
export function proyectoDesdeUbicacionRow(
  raw: unknown,
  proyectos: readonly ProyectoRef[],
): ProyectoRef | null {
  const u = Array.isArray(raw) ? raw[0] : raw;
  if (!u || typeof u !== 'object') return null;
  const row = u as UbicacionProyectoRow;

  const fromJoin = nombreProyJoin(row.proyecto);
  if (fromJoin) return fromJoin;

  const fromId = proyectoDesdeId(row.ci_proyecto_id, proyectos);
  if (fromId) return fromId;

  const nombreUbi = String(row.nombre ?? '').trim();
  return resolverProyectoDesdeEtiquetas([nombreUbi], proyectos);
}

type MaterialProyectoRow = {
  proyecto_id?: string | null;
  proyecto?: unknown;
};

export function proyectoDesdeMaterialRow(
  raw: unknown,
  proyectos: readonly ProyectoRef[],
): ProyectoRef | null {
  const m = Array.isArray(raw) ? raw[0] : raw;
  if (!m || typeof m !== 'object') return null;
  const row = m as MaterialProyectoRow;
  const fromJoin = nombreProyJoin(row.proyecto);
  if (fromJoin) return fromJoin;
  return proyectoDesdeId(row.proyecto_id, proyectos);
}

export function enriquecerProyectoFila<T extends FilaProyectoMovimiento>(
  fila: T,
  proyectos: readonly ProyectoRef[],
  extras?: {
    ubicacion?: unknown;
    material?: unknown;
  },
): T {
  if (fila.proyecto_id?.trim()) {
    if (!fila.proyecto_nombre?.trim()) {
      const p = proyectoDesdeId(fila.proyecto_id, proyectos);
      if (p) return { ...fila, proyecto_nombre: p.nombre };
    }
    return fila;
  }

  let proy =
    proyectoDesdeUbicacionRow(extras?.ubicacion, proyectos) ??
    proyectoDesdeMaterialRow(extras?.material, proyectos) ??
    resolverProyectoDesdeEtiquetas(
      [fila.destino, fila.origen, fila.proyecto_nombre],
      proyectos,
    );

  if (!proy) return fila;
  return {
    ...fila,
    proyecto_id: proy.id,
    proyecto_nombre: proy.nombre,
  };
}

export function enriquecerFilasProyecto<T extends FilaProyectoMovimiento>(
  filas: T[],
  proyectos: readonly ProyectoRef[],
): T[] {
  return filas.map((f) => enriquecerProyectoFila(f, proyectos));
}

export function filaCoincideProyectosEntidad(
  fila: FilaProyectoMovimiento,
  proyectoIds: readonly string[],
  proyectos: readonly ProyectoRef[],
): boolean {
  if (!proyectoIds.length) return true;
  const scope = new Set(proyectoIds);
  if (fila.proyecto_id && scope.has(fila.proyecto_id)) return true;

  const nombres = proyectoIds
    .map((id) => proyectos.find((p) => p.id === id)?.nombre)
    .filter((n): n is string => Boolean(n?.trim()));
  if (!nombres.length) return false;

  for (const nombre of nombres) {
    if (etiquetaCoincideNombreObra(fila.destino ?? '', nombre)) return true;
    if (etiquetaCoincideNombreObra(fila.origen ?? '', nombre)) return true;
    if (etiquetaCoincideNombreObra(fila.proyecto_nombre ?? '', nombre)) return true;
  }
  return false;
}
