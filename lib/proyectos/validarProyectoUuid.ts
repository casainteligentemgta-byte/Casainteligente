const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const PLACEHOLDER_IDS = new Set(['{id}', '{proyectoid}', '%7bid%7d', 'id', 'proyectoid']);

/** Decodifica `%7Bid%7D` → `{id}` (máx. 2 pasos por doble codificación). */
export function normalizarProyectoIdCandidato(value: string | null | undefined): string {
  let t = String(value ?? '').trim();
  for (let i = 0; i < 2; i++) {
    if (!t.includes('%')) break;
    try {
      const decoded = decodeURIComponent(t);
      if (decoded === t) break;
      t = decoded.trim();
    } catch {
      break;
    }
  }
  return t;
}

/** UUID v4 de proyecto (Supabase). Rechaza placeholders tipo `{id}` de la documentación. */
export function isValidProyectoUuid(value: string | null | undefined): boolean {
  const t = normalizarProyectoIdCandidato(value);
  if (!t) return false;
  if (PLACEHOLDER_IDS.has(t.toLowerCase())) return false;
  if (t.includes('{') || t.includes('}')) return false;
  return UUID_RE.test(t);
}

export function resolveProyectoId(
  propId?: string | null,
  routeId?: string | string[] | null,
): string {
  const fromRoute = Array.isArray(routeId) ? routeId[0] : routeId;
  const candidates = [
    normalizarProyectoIdCandidato(propId),
    normalizarProyectoIdCandidato(fromRoute),
  ];
  for (const c of candidates) {
    if (isValidProyectoUuid(c)) return c;
  }
  return candidates.find(Boolean) ?? '';
}

export function mensajeProyectoIdInvalido(recibido?: string): string {
  const t = normalizarProyectoIdCandidato(recibido);
  if (t === '{id}' || t.includes('{')) {
    return 'Abre el proyecto desde Proyectos → Abrir gestión (no uses la URL de ejemplo con {id}).';
  }
  if (!t) return 'Falta el ID del proyecto en la URL.';
  return `ID de proyecto no válido: «${t}». Entra desde la lista de proyectos.`;
}
