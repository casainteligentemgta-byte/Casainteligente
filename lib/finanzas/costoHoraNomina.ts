/** Horas mensuales legales de referencia (Ley Orgánica del Trabajo / práctica administrativa). */
export const HORAS_MES_LEGAL = 173.33;

/**
 * Costo hora total en la misma moneda que salario_base_mensual y cestaticket (típicamente VES).
 * Fórmula: ((Salario Base × Factor Prestacional) + Cestaticket) / 173.33
 */
export function calcularCostoHoraTotal(
  salarioBaseMensual: number,
  factorPrestacional: number,
  cestaticketMensual: number,
): number {
  const sb = Number(salarioBaseMensual);
  const f = Number(factorPrestacional);
  const c = Number(cestaticketMensual);
  if (!Number.isFinite(sb) || !Number.isFinite(f) || !Number.isFinite(c) || f <= 0) return 0;
  return (sb * f + c) / HORAS_MES_LEGAL;
}

export function normCargo(s: string | null | undefined): string {
  return (s ?? '').trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}
