/**
 * Compensación por culminación (cláusula SÉPTIMA):
 * 1 semana de remuneración semanal (USD) por cada mes trabajado o fracción
 * → el monto mensual es siempre igual a la remuneración semanal en dólares
 *   (misma cifra que BONO ESPECIAL / columna Excel / edición).
 */

/**
 * Resuelve la remuneración semanal USD en contratos express.
 * - Nuevo: `bono_manual_usd` guarda la remuneración del Excel/edición.
 * - Legacy: se guardó el complemento (rem − tabulador); se reconstruye rem = base + complemento.
 */
export function remuneracionSemanalUsdExpress(opts: {
  /** Valor en `bono_manual_usd` (remuneración o, en datos viejos, complemento). */
  storedUsd: number | null | undefined;
  /** Ingreso semanal del tabulador Gaceta (USD), si se conoce. */
  ingresoTabuladorSemanalUsd?: number | null;
}): number {
  const stored =
    opts.storedUsd != null && Number.isFinite(Number(opts.storedUsd))
      ? Math.max(0, Number(opts.storedUsd))
      : 0;
  const base =
    opts.ingresoTabuladorSemanalUsd != null && Number.isFinite(Number(opts.ingresoTabuladorSemanalUsd))
      ? Math.max(0, Number(opts.ingresoTabuladorSemanalUsd))
      : null;

  if (stored <= 0) {
    return base != null && base > 0 ? Math.round(base * 100) / 100 : 0;
  }
  // Complemento legacy: menor que la base del tabulador → rem = base + complemento.
  if (base != null && base > 0 && stored + 0.005 < base) {
    return Math.round((base + stored) * 100) / 100;
  }
  return Math.round(stored * 100) / 100;
}

export function montoCompensacionCulminacionUsd(opts: {
  /** Override manual (si se fija explícitamente). */
  compensacionExplicitUsd?: number | null;
  /**
   * Remuneración semanal USD (misma cifra que BONO ESPECIAL).
   * La compensación por mes = esta cifra.
   */
  bonoSemanalUsd?: number | null;
  /** Alias explícito de remuneración semanal (tiene prioridad sobre bonoSemanalUsd). */
  remuneracionSemanalUsd?: number | null;
  /** Solo si no hay remuneración ni override (contratos viejos). */
  fallbackUsd?: number;
}): number {
  const remRaw =
    opts.remuneracionSemanalUsd != null && Number.isFinite(Number(opts.remuneracionSemanalUsd))
      ? Number(opts.remuneracionSemanalUsd)
      : opts.bonoSemanalUsd != null && Number.isFinite(Number(opts.bonoSemanalUsd))
        ? Number(opts.bonoSemanalUsd)
        : 0;
  const rem = Math.max(0, remRaw);
  if (rem > 0) return rem;

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
