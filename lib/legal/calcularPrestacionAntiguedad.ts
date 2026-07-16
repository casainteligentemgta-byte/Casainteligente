/**
 * Cálculo de salario integral diario y garantía trimestral
 * según Art. 142 LOTTT (régimen de prestaciones sociales).
 *
 * Mínimos de ley por defecto:
 * - 30 días de utilidades
 * - 15 días de bono vacacional
 * - Garantía trimestral = 15 días de salario integral (literal a)
 */

export const PRESTACION_ANTIGUEDAD_REF = 'Art. 142 LOTTT';

export type AlicuotasConfig = {
  /** Días de utilidades al año (mínimo legal típico: 30). */
  diasUtilidades?: number;
  /** Días de bono vacacional al año (mínimo legal típico: 15). */
  diasBonoVacacional?: number;
  /** Base anual en días (360 en práctica laboral VE). */
  diasBaseAnual?: number;
  /** Días de garantía por trimestre (Art. 142 lit. a → 15). */
  diasGarantiaTrimestral?: number;
};

export type DesgloseSalarioIntegral = {
  salario_mensual: number;
  salario_diario_base: number;
  alicuota_utilidades: number;
  alicuota_bono_vacacional: number;
  salario_integral_diario: number;
  dias_utilidades: number;
  dias_bono_vacacional: number;
  dias_base_anual: number;
  referencia: string;
};

export type ResultadoGarantiaTrimestral = DesgloseSalarioIntegral & {
  garantia_trimestral: number;
  dias_garantia: number;
  /** Estimación anual = 4 depósitos trimestrales (sin intereses ni ajustes). */
  estimacion_anual_garantias: number;
};

function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

export function calcularSalarioIntegralDiario(
  salarioMensual: number,
  config?: AlicuotasConfig,
): DesgloseSalarioIntegral {
  if (!Number.isFinite(salarioMensual) || salarioMensual < 0) {
    throw new Error('salario_mensual debe ser un número >= 0');
  }

  const diasUtilidades = config?.diasUtilidades ?? 30;
  const diasBono = config?.diasBonoVacacional ?? 15;
  const diasBase = config?.diasBaseAnual ?? 360;

  const salarioDiarioBase = salarioMensual / 30;
  const alicuotaUtilidades = salarioDiarioBase * (diasUtilidades / diasBase);
  const alicuotaBono = salarioDiarioBase * (diasBono / diasBase);
  const salarioIntegralDiario = salarioDiarioBase + alicuotaUtilidades + alicuotaBono;

  return {
    salario_mensual: round2(salarioMensual),
    salario_diario_base: round2(salarioDiarioBase),
    alicuota_utilidades: round2(alicuotaUtilidades),
    alicuota_bono_vacacional: round2(alicuotaBono),
    salario_integral_diario: round2(salarioIntegralDiario),
    dias_utilidades: diasUtilidades,
    dias_bono_vacacional: diasBono,
    dias_base_anual: diasBase,
    referencia: PRESTACION_ANTIGUEDAD_REF,
  };
}

export function calcularGarantiaTrimestral(
  salarioMensual: number,
  config?: AlicuotasConfig,
): ResultadoGarantiaTrimestral {
  const desglose = calcularSalarioIntegralDiario(salarioMensual, config);
  const diasGarantia = config?.diasGarantiaTrimestral ?? 15;
  // Sin redondeo intermedio: usar integral exacto * 15, luego round2
  const salarioDiarioExacto =
    salarioMensual / 30 +
    (salarioMensual / 30) * ((config?.diasUtilidades ?? 30) / (config?.diasBaseAnual ?? 360)) +
    (salarioMensual / 30) * ((config?.diasBonoVacacional ?? 15) / (config?.diasBaseAnual ?? 360));
  const garantia = salarioDiarioExacto * diasGarantia;

  return {
    ...desglose,
    garantia_trimestral: round2(garantia),
    dias_garantia: diasGarantia,
    estimacion_anual_garantias: round2(garantia * 4),
  };
}
