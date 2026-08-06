/**
 * Compensación por culminación (cláusula SÉPTIMA):
 * 1 semana de bono especial por cada mes trabajado o fracción
 * → el monto mensual es el mismo del bono semanal.
 */

export function montoCompensacionCulminacionUsd(opts: {
  /** Override manual (si se fija explícitamente). */
  compensacionExplicitUsd?: number | null;
  /** Bono especial semanal (no salarial) del contrato. */
  bonoSemanalUsd?: number | null;
  /** Solo si no hay bono ni override (contratos viejos). */
  fallbackUsd?: number;
}): number {
  const bono =
    opts.bonoSemanalUsd != null && Number.isFinite(Number(opts.bonoSemanalUsd))
      ? Math.max(0, Number(opts.bonoSemanalUsd))
      : 0;
  if (bono > 0) return bono;

  const explicit =
    opts.compensacionExplicitUsd != null && Number.isFinite(Number(opts.compensacionExplicitUsd))
      ? Number(opts.compensacionExplicitUsd)
      : 0;
  if (explicit > 0) return explicit;

  const fb = opts.fallbackUsd;
  if (fb != null && Number.isFinite(Number(fb)) && Number(fb) > 0) return Number(fb);
  return 0;
}

export function fmtCompensacionCulminacionUsdPlano(n: number): string {
  if (!(n > 0)) return '________';
  return new Intl.NumberFormat('es-VE', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(n);
}
