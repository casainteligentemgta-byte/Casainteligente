/**
 * LaborCalculator — régimen de prestaciones sociales (Art. 142 LOTTT).
 *
 * - Literal a): garantía trimestral = 15 días de salario integral
 * - Literal f): retroactivo = 60 días × años (o fracción > 6 meses)
 *
 * Mínimos de ley por defecto: 30 días utilidades, 15 días bono vacacional.
 */

export const PRESTACION_ANTIGUEDAD_REF = 'Art. 142 LOTTT';

export type AlicuotasConfig = {
  diasUtilidades?: number;
  diasBonoVacacional?: number;
  diasBaseAnual?: number;
  diasGarantiaTrimestral?: number;
  diasRetroactivoPorAnio?: number;
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
  estimacion_anual_garantias: number;
};

export type ResultadoRetroactivo = DesgloseSalarioIntegral & {
  fecha_inicio: string;
  fecha_fin: string;
  anios_completos: number;
  meses_fraccion: number;
  anios_servicio: number;
  dias_retroactivo_por_anio: number;
  retroactivo: number;
  referencia_retroactivo: string;
};

export type ResultadoLaborCalculator = ResultadoGarantiaTrimestral & {
  retroactivo?: ResultadoRetroactivo | null;
  /** Art. 142 LOTTT — provisionar el monto mayor entre garantía y retroactivo. */
  monto_a_provisionar: number;
  criterio_provision: 'garantia_trimestral' | 'retroactivo' | 'empatados';
};

function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

function parseDateOnly(value: string | Date): Date {
  if (value instanceof Date) {
    return new Date(value.getFullYear(), value.getMonth(), value.getDate());
  }
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(value.trim());
  if (!m) throw new Error('fecha inválida (use YYYY-MM-DD)');
  return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
}

function toIsoDate(d: Date): string {
  const y = d.getFullYear();
  const mo = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${mo}-${day}`;
}

/** Diff calendar years/months/days (estilo relativedelta). */
export function relativedeltaYmd(
  inicio: Date,
  fin: Date,
): { years: number; months: number; days: number } {
  if (fin < inicio) {
    throw new Error('fecha_fin debe ser >= fecha_inicio');
  }
  let years = fin.getFullYear() - inicio.getFullYear();
  let months = fin.getMonth() - inicio.getMonth();
  let days = fin.getDate() - inicio.getDate();
  if (days < 0) {
    months -= 1;
    const prevMonth = new Date(fin.getFullYear(), fin.getMonth(), 0);
    days += prevMonth.getDate();
  }
  if (months < 0) {
    years -= 1;
    months += 12;
  }
  return { years, months, days };
}

export class LaborCalculator {
  salarioBaseMensual: number;
  diasUtilidades: number;
  diasBonoVacacional: number;
  diasBaseAnual: number;
  diasGarantiaTrimestral: number;
  diasRetroactivoPorAnio: number;

  constructor(
    salarioBaseMensual: number,
    diasUtilidades = 30,
    diasBonoVacacional = 15,
    opts?: {
      diasBaseAnual?: number;
      diasGarantiaTrimestral?: number;
      diasRetroactivoPorAnio?: number;
    },
  ) {
    if (!Number.isFinite(salarioBaseMensual) || salarioBaseMensual < 0) {
      throw new Error('salario_base_mensual debe ser un número >= 0');
    }
    this.salarioBaseMensual = salarioBaseMensual;
    this.diasUtilidades = diasUtilidades;
    this.diasBonoVacacional = diasBonoVacacional;
    this.diasBaseAnual = opts?.diasBaseAnual ?? 360;
    this.diasGarantiaTrimestral = opts?.diasGarantiaTrimestral ?? 15;
    this.diasRetroactivoPorAnio = opts?.diasRetroactivoPorAnio ?? 60;
  }

  /**
   * Salario integral diario base para prestaciones.
   * Salario normal + alícuotas de utilidades y bono vacacional.
   */
  getSalarioIntegralDiario(): number {
    const salarioDiarioNormal = this.salarioBaseMensual / 30;
    const alicuotaUtilidades =
      (salarioDiarioNormal * this.diasUtilidades) / this.diasBaseAnual;
    const alicuotaBono =
      (salarioDiarioNormal * this.diasBonoVacacional) / this.diasBaseAnual;
    return salarioDiarioNormal + alicuotaUtilidades + alicuotaBono;
  }

  getDesglose(): DesgloseSalarioIntegral {
    const salarioDiarioNormal = this.salarioBaseMensual / 30;
    const alicuotaUtilidades =
      (salarioDiarioNormal * this.diasUtilidades) / this.diasBaseAnual;
    const alicuotaBono =
      (salarioDiarioNormal * this.diasBonoVacacional) / this.diasBaseAnual;
    return {
      salario_mensual: round2(this.salarioBaseMensual),
      salario_diario_base: round2(salarioDiarioNormal),
      alicuota_utilidades: round2(alicuotaUtilidades),
      alicuota_bono_vacacional: round2(alicuotaBono),
      salario_integral_diario: round2(this.getSalarioIntegralDiario()),
      dias_utilidades: this.diasUtilidades,
      dias_bono_vacacional: this.diasBonoVacacional,
      dias_base_anual: this.diasBaseAnual,
      referencia: PRESTACION_ANTIGUEDAD_REF,
    };
  }

  /** Art. 142 literal a) — 15 días de salario integral. */
  calcularGarantiaTrimestral(): number {
    return this.getSalarioIntegralDiario() * this.diasGarantiaTrimestral;
  }

  /**
   * Art. 142 literal f) — 60 días por año (o fracción > 6 meses).
   */
  calcularRetroactivo(fechaInicio: string | Date, fechaFin: string | Date): number {
    const inicio = parseDateOnly(fechaInicio);
    const fin = parseDateOnly(fechaFin);
    const diff = relativedeltaYmd(inicio, fin);
    const aniosServicio = diff.years + (diff.months > 6 ? 1 : 0);
    return this.getSalarioIntegralDiario() * this.diasRetroactivoPorAnio * aniosServicio;
  }

  calcularTodo(
    fechaInicio?: string | Date | null,
    fechaFin?: string | Date | null,
  ): ResultadoLaborCalculator {
    const desglose = this.getDesglose();
    const garantia = this.calcularGarantiaTrimestral();
    let retroactivo: ResultadoRetroactivo | null = null;

    if (fechaInicio && fechaFin) {
      const inicio = parseDateOnly(fechaInicio);
      const fin = parseDateOnly(fechaFin);
      const diff = relativedeltaYmd(inicio, fin);
      const aniosServicio = diff.years + (diff.months > 6 ? 1 : 0);
      const monto = this.calcularRetroactivo(inicio, fin);
      retroactivo = {
        ...desglose,
        fecha_inicio: toIsoDate(inicio),
        fecha_fin: toIsoDate(fin),
        anios_completos: diff.years,
        meses_fraccion: diff.months,
        anios_servicio: aniosServicio,
        dias_retroactivo_por_anio: this.diasRetroactivoPorAnio,
        retroactivo: round2(monto),
        referencia_retroactivo: 'Art. 142 literal f) LOTTT',
      };
    }

    const retroMonto = retroactivo?.retroactivo ?? 0;
    const garantiaR = round2(garantia);
    const montoMayor = round2(Math.max(garantiaR, retroMonto));
    let criterio: ResultadoLaborCalculator['criterio_provision'] = 'garantia_trimestral';
    if (retroactivo) {
      if (garantiaR === retroMonto) criterio = 'empatados';
      else if (retroMonto > garantiaR) criterio = 'retroactivo';
    }

    return {
      ...desglose,
      garantia_trimestral: garantiaR,
      dias_garantia: this.diasGarantiaTrimestral,
      estimacion_anual_garantias: round2(garantia * 4),
      retroactivo,
      monto_a_provisionar: montoMayor,
      criterio_provision: criterio,
    };
  }
}

export function calcularSalarioIntegralDiario(
  salarioMensual: number,
  config?: AlicuotasConfig,
): DesgloseSalarioIntegral {
  return new LaborCalculator(
    salarioMensual,
    config?.diasUtilidades ?? 30,
    config?.diasBonoVacacional ?? 15,
    {
      diasBaseAnual: config?.diasBaseAnual,
      diasGarantiaTrimestral: config?.diasGarantiaTrimestral,
      diasRetroactivoPorAnio: config?.diasRetroactivoPorAnio,
    },
  ).getDesglose();
}

export function calcularGarantiaTrimestral(
  salarioMensual: number,
  config?: AlicuotasConfig,
): ResultadoGarantiaTrimestral {
  const calc = new LaborCalculator(
    salarioMensual,
    config?.diasUtilidades ?? 30,
    config?.diasBonoVacacional ?? 15,
    {
      diasBaseAnual: config?.diasBaseAnual,
      diasGarantiaTrimestral: config?.diasGarantiaTrimestral,
      diasRetroactivoPorAnio: config?.diasRetroactivoPorAnio,
    },
  );
  const { retroactivo: _r, monto_a_provisionar: _m, criterio_provision: _c, ...rest } =
    calc.calcularTodo();
  return rest;
}

export function calcularRetroactivo(
  salarioMensual: number,
  fechaInicio: string | Date,
  fechaFin: string | Date,
  config?: AlicuotasConfig,
): ResultadoRetroactivo {
  const calc = new LaborCalculator(
    salarioMensual,
    config?.diasUtilidades ?? 30,
    config?.diasBonoVacacional ?? 15,
    {
      diasBaseAnual: config?.diasBaseAnual,
      diasGarantiaTrimestral: config?.diasGarantiaTrimestral,
      diasRetroactivoPorAnio: config?.diasRetroactivoPorAnio,
    },
  );
  const all = calc.calcularTodo(fechaInicio, fechaFin);
  if (!all.retroactivo) {
    throw new Error('No se pudo calcular retroactivo');
  }
  return all.retroactivo;
}
