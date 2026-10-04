import { SALARIO_BASICO_DIARIO_VES_POR_NIVEL } from '@/lib/nomina/tabuladorSalariosConstruccion2023';

/**
 * Tabulador de Oficios y Salarios vigente — Convención Colectiva de la Construcción (GOE 6.752).
 *
 * Acuerdo de la Comisión de Avenimiento del 17/08/2026, homologado por auto N° 2026-021
 * de la Dirección de Inspectoría Nacional y Otros Asuntos Colectivos del Trabajo del Sector Privado
 * (19/08/2026): aumento del 100% sobre el tabulador vigente desde el 26/03/2026.
 *
 * Salario básico DIARIO en bolívares, índice = nivel 1…9.
 */
export const SALARIO_BASICO_DIARIO_VES_HOMOLOGADO_2026: readonly number[] = [
  2079.06, 2256.84, 2346.7, 2525.62, 2771.26, 2792.24, 2940.68, 3237.72, 3326.76,
];

export const TABULADOR_HOMOLOGADO_2026_VIGENCIA = '2026-08-19';
export const TABULADOR_HOMOLOGADO_2026_REFERENCIA =
  'acuerdo de la Comisión de Avenimiento de fecha 17 de agosto de 2026, homologado por auto N° 2026-021 de fecha 19 de agosto de 2026';

/** Beneficio de alimentación mensual (Bs.) fijado en el mismo acuerdo homologado. No salarial. */
export const ALIMENTACION_MENSUAL_VES_HOMOLOGADA_2026 = 135188;

/** Proporción semanal de la alimentación mensual: mensual × 12 ÷ 52. */
export function alimentacionSemanalVes(mensual: number = ALIMENTACION_MENSUAL_VES_HOMOLOGADA_2026): number {
  return Math.round(((mensual * 12) / 52) * 100) / 100;
}

/** Nivel 1–9 a partir del código del oficio («5.1», «5,1», «5»). */
export function nivelDesdeCodigoOficio(codigo: string | null | undefined): number | null {
  const m = /^\s*(\d)\s*(?:[.,]\s*\d{1,2})?\s*$/.exec(String(codigo ?? ''));
  if (!m) return null;
  const n = Number(m[1]);
  return n >= 1 && n <= 9 ? n : null;
}

/** Nivel 1–9 a partir de un salario diario del tabulador 2023 (datos viejos de ci_config_nomina). */
export function nivelDesdeSalarioDiario2023(diario: number | null | undefined): number | null {
  if (diario == null || !Number.isFinite(Number(diario))) return null;
  const d = Number(diario);
  const idx = SALARIO_BASICO_DIARIO_VES_POR_NIVEL.findIndex((v) => Math.abs(v - d) < 0.05);
  return idx >= 0 ? idx + 1 : null;
}

/** Salario básico diario homologado para un nivel, o null. */
export function salarioDiarioHomologado(nivel: number | null | undefined): number | null {
  if (nivel == null || nivel < 1 || nivel > 9) return null;
  return SALARIO_BASICO_DIARIO_VES_HOMOLOGADO_2026[nivel - 1] ?? null;
}
