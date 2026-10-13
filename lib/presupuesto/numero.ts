/**
 * Número de presupuesto (P-500, P-501, …). Fijo una vez asignado por la BD
 * (`numero_correlativo`); no se edita en la app.
 */

export function correlativoDesdeValor(raw: unknown): number | null {
  if (typeof raw === 'number' && Number.isFinite(raw)) return Math.trunc(raw);
  if (typeof raw === 'string' && raw.trim()) {
    const n = Number(raw.trim());
    if (Number.isFinite(n)) return Math.trunc(n);
  }
  return null;
}

/** Etiqueta estable `P-N`. Sin correlativo: borrador o id corto solo como último recurso. */
export function etiquetaNumeroPresupuesto(
  row: { numero_correlativo?: unknown; id?: string | null },
  opts?: { fallback?: number | null; borrador?: boolean },
): string {
  const n = correlativoDesdeValor(row.numero_correlativo);
  if (n != null) return `P-${n}`;
  if (opts?.fallback != null && Number.isFinite(opts.fallback)) return `P-${Math.trunc(opts.fallback)}`;
  if (opts?.borrador) return 'P—(borrador)';
  const id = typeof row.id === 'string' ? row.id.trim() : '';
  if (id.length >= 8) return `P-${id.slice(0, 8).toUpperCase()}`;
  return 'P—';
}
