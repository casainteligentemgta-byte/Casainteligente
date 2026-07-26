import { isValidProyectoUuid } from '@/lib/proyectos/validarProyectoUuid';

/**
 * Normaliza `plano_archivo_id` para Metron.
 * - vacío → null
 * - UUID válido → uuid
 * - basura (p. ej. "1") → null (el caller decide si es error o se ignora)
 */
export function normalizarPlanoArchivoId(
  value: string | null | undefined,
): { ok: true; id: string | null } | { ok: false; recibido: string } {
  const raw = String(value ?? '').trim();
  if (!raw) return { ok: true, id: null };
  if (isValidProyectoUuid(raw)) return { ok: true, id: raw };
  return { ok: false, recibido: raw };
}
