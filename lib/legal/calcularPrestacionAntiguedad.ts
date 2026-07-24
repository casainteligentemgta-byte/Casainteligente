/**
 * LaborCalculator — régimen de prestaciones sociales (Art. 142 LOTTT).
 *
 * Determinístico y auditable (no aprende de Excel ni IA):
 * - Literal a): garantía trimestral = 15 días de salario integral
 * - Literal f): retroactivo = 60 días × años (o fracción superior a 6 meses)
 * - Se provisiona el monto mayor entre garantía y retroactivo
 *
 * Mínimos de ley por defecto: 30 días utilidades (Art. 131), 15 días bono (Art. 190).
 */

export const PRESTACION_ANTIGUEDAD_REF = 'Art. 142 LOTTT';
export const UTILIDADES_REF = 'Art. 131 LOTTT';
export const BONO_VACACIONAL_REF = 'Art. 190 LOTTT';

/** Mínimos legales usados como default (pueden aumentarse por pacto/beneficio). */
export const LOTTT_MIN_DIAS_UTILIDADES = 30;
export const LOTTT_MIN_DIAS_BONO_VACACIONAL = 15;
export const LOTTT_DIAS_GARANTIA_TRIMESTRAL = 15;
export const LOTTT_DIAS_RETROACTIVO_POR_ANIO = 60;
export const LOTTT_DIAS_BASE_ANUAL = 360;
export const LOTTT_DIAS_MES_SALARIO = 30;

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

export type PasoAuditoriaCalculo = {
  paso: number;
  titulo: string;
  formula: string;
  valor: number;
  unidad?: string;
  referencia?: string;
  detalle?: string;
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
  dias_fraccion: number;
  fraccion_superior_seis_meses: boolean;
  anios_servicio: number;
  dias_retroactivo_por_anio: number;
  retroactivo: number;
  referencia_retroactivo: string;
};

export type AdvertenciaCalculo = {
  codigo: string;
  mensaje: string;
};

export type ResultadoLaborCalculator = ResultadoGarantiaTrimestral & {
  retroactivo?: ResultadoRetroactivo | null;
  /** Art. 142 LOTTT — provisionar el monto mayor entre garantía y retroactivo. */
  monto_a_provisionar: number;
  criterio_provision: 'garantia_trimestral' | 'retroactivo' | 'empatados';
  /** Pasos numerados para revisión legal / auditoría. */
  auditoria: PasoAuditoriaCalculo[];
  advertencias: AdvertenciaCalculo[];
  metodo: 'deterministico_lott_142';
  version_formula: '1.1.0';
};

function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

function parseDateOnly(value: string | Date): Date {
  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) throw new Error('fecha inválida');
    return new Date(value.getFullYear(), value.getMonth(), value.getDate());
  }
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(value.trim());
  if (!m) throw new Error('fecha inválida (use YYYY-MM-DD)');
  const y = Number(m[1]);
  const mo = Number(m[2]);
  const d = Number(m[3]);
  const dt = new Date(y, mo - 1, d);
  if (dt.getFullYear() !== y || dt.getMonth() !== mo - 1 || dt.getDate() !== d) {
    throw new Error(`fecha inválida: ${value}`);
  }
  return dt;
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

/**
 * Art. 142 lit. f): «año de servicio, o fracción superior a seis meses».
 * Cuenta el año adicional si hay más de 6 meses exactos (6 meses + ≥1 día).
 */
export function aniosServicioComputables(diff: {
  years: number;
  months: number;
  days: number;
}): { anios: number; fraccionSuperiorSeisMeses: boolean } {
  const fraccionSuperiorSeisMeses =
    diff.months > 6 || (diff.months === 6 && diff.days > 0);
  return {
    anios: diff.years + (fraccionSuperiorSeisMeses ? 1 : 0),
    fraccionSuperiorSeisMeses,
  };
}

function assertDiasNoNegativos(nombre: string, n: number): number {
  if (!Number.isFinite(n) || n < 0) {
    throw new Error(`${nombre} debe ser un número >= 0`);
  }
  return n;
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
    diasUtilidades = LOTTT_MIN_DIAS_UTILIDADES,
    diasBonoVacacional = LOTTT_MIN_DIAS_BONO_VACACIONAL,
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
    this.diasUtilidades = assertDiasNoNegativos('dias_utilidades', diasUtilidades);
    this.diasBonoVacacional = assertDiasNoNegativos(
      'dias_bono_vacacional',
      diasBonoVacacional,
    );
    this.diasBaseAnual = assertDiasNoNegativos(
      'dias_base_anual',
      opts?.diasBaseAnual ?? LOTTT_DIAS_BASE_ANUAL,
    );
    if (this.diasBaseAnual <= 0) {
      throw new Error('dias_base_anual debe ser > 0');
    }
    this.diasGarantiaTrimestral = assertDiasNoNegativos(
      'dias_garantia',
      opts?.diasGarantiaTrimestral ?? LOTTT_DIAS_GARANTIA_TRIMESTRAL,
    );
    this.diasRetroactivoPorAnio = assertDiasNoNegativos(
      'dias_retroactivo',
      opts?.diasRetroactivoPorAnio ?? LOTTT_DIAS_RETROACTIVO_POR_ANIO,
    );
  }

  private advertenciasBase(): AdvertenciaCalculo[] {
    const out: AdvertenciaCalculo[] = [];
    if (this.diasUtilidades < LOTTT_MIN_DIAS_UTILIDADES) {
      out.push({
        codigo: 'utilidades_bajo_minimo',
        mensaje: `Días de utilidades (${this.diasUtilidades}) por debajo del mínimo legal ${LOTTT_MIN_DIAS_UTILIDADES} (${UTILIDADES_REF}).`,
      });
    }
    if (this.diasBonoVacacional < LOTTT_MIN_DIAS_BONO_VACACIONAL) {
      out.push({
        codigo: 'bono_bajo_minimo',
        mensaje: `Días de bono vacacional (${this.diasBonoVacacional}) por debajo del mínimo legal ${LOTTT_MIN_DIAS_BONO_VACACIONAL} (${BONO_VACACIONAL_REF}).`,
      });
    }
    return out;
  }

  /**
   * Salario integral diario base para prestaciones.
   * Salario normal + alícuotas de utilidades y bono vacacional.
   */
  getSalarioIntegralDiario(): number {
    const salarioDiarioNormal = this.salarioBaseMensual / LOTTT_DIAS_MES_SALARIO;
    const alicuotaUtilidades =
      (salarioDiarioNormal * this.diasUtilidades) / this.diasBaseAnual;
    const alicuotaBono =
      (salarioDiarioNormal * this.diasBonoVacacional) / this.diasBaseAnual;
    return salarioDiarioNormal + alicuotaUtilidades + alicuotaBono;
  }

  getDesglose(): DesgloseSalarioIntegral {
    const salarioDiarioNormal = this.salarioBaseMensual / LOTTT_DIAS_MES_SALARIO;
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
   * Art. 142 literal f) — 60 días por año (o fracción superior a 6 meses).
   */
  calcularRetroactivo(fechaInicio: string | Date, fechaFin: string | Date): number {
    const inicio = parseDateOnly(fechaInicio);
    const fin = parseDateOnly(fechaFin);
    const diff = relativedeltaYmd(inicio, fin);
    const { anios } = aniosServicioComputables(diff);
    return this.getSalarioIntegralDiario() * this.diasRetroactivoPorAnio * anios;
  }

  calcularTodo(
    fechaInicio?: string | Date | null,
    fechaFin?: string | Date | null,
  ): ResultadoLaborCalculator {
    const desglose = this.getDesglose();
    const garantia = this.calcularGarantiaTrimestral();
    const advertencias = this.advertenciasBase();
    let retroactivo: ResultadoRetroactivo | null = null;

    const auditoria: PasoAuditoriaCalculo[] = [
      {
        paso: 1,
        titulo: 'Salario diario normal',
        formula: `salario_mensual ÷ ${LOTTT_DIAS_MES_SALARIO}`,
        valor: desglose.salario_diario_base,
        unidad: 'diario',
        detalle: `${desglose.salario_mensual} ÷ ${LOTTT_DIAS_MES_SALARIO}`,
      },
      {
        paso: 2,
        titulo: 'Alícuota utilidades',
        formula: `(salario_diario × días_utilidades) ÷ ${this.diasBaseAnual}`,
        valor: desglose.alicuota_utilidades,
        unidad: 'diario',
        referencia: UTILIDADES_REF,
        detalle: `(${desglose.salario_diario_base} × ${this.diasUtilidades}) ÷ ${this.diasBaseAnual}`,
      },
      {
        paso: 3,
        titulo: 'Alícuota bono vacacional',
        formula: `(salario_diario × días_bono) ÷ ${this.diasBaseAnual}`,
        valor: desglose.alicuota_bono_vacacional,
        unidad: 'diario',
        referencia: BONO_VACACIONAL_REF,
        detalle: `(${desglose.salario_diario_base} × ${this.diasBonoVacacional}) ÷ ${this.diasBaseAnual}`,
      },
      {
        paso: 4,
        titulo: 'Salario integral diario',
        formula: 'diario + alícuota_utilidades + alícuota_bono',
        valor: desglose.salario_integral_diario,
        unidad: 'diario',
        referencia: PRESTACION_ANTIGUEDAD_REF,
        detalle: `${desglose.salario_diario_base} + ${desglose.alicuota_utilidades} + ${desglose.alicuota_bono_vacacional}`,
      },
      {
        paso: 5,
        titulo: 'Garantía trimestral (lit. a)',
        formula: `integral_diario × ${this.diasGarantiaTrimestral} días`,
        valor: round2(garantia),
        unidad: 'monto',
        referencia: 'Art. 142 literal a) LOTTT',
        detalle: `${desglose.salario_integral_diario} × ${this.diasGarantiaTrimestral}`,
      },
    ];

    if (Boolean(fechaInicio) !== Boolean(fechaFin)) {
      throw new Error('Indique ambas fechas (inicio y fin) para el retroactivo, o ninguna.');
    }

    if (fechaInicio && fechaFin) {
      const inicio = parseDateOnly(fechaInicio);
      const fin = parseDateOnly(fechaFin);
      const diff = relativedeltaYmd(inicio, fin);
      const { anios: aniosServicio, fraccionSuperiorSeisMeses } =
        aniosServicioComputables(diff);
      const monto = this.calcularRetroactivo(inicio, fin);
      retroactivo = {
        ...desglose,
        fecha_inicio: toIsoDate(inicio),
        fecha_fin: toIsoDate(fin),
        anios_completos: diff.years,
        meses_fraccion: diff.months,
        dias_fraccion: diff.days,
        fraccion_superior_seis_meses: fraccionSuperiorSeisMeses,
        anios_servicio: aniosServicio,
        dias_retroactivo_por_anio: this.diasRetroactivoPorAnio,
        retroactivo: round2(monto),
        referencia_retroactivo: 'Art. 142 literal f) LOTTT',
      };
      auditoria.push({
        paso: 6,
        titulo: 'Antigüedad computable (lit. f)',
        formula: 'años + (1 si fracción > 6 meses)',
        valor: aniosServicio,
        unidad: 'años',
        referencia: 'Art. 142 literal f) LOTTT',
        detalle: `${diff.years} años + ${diff.months} meses + ${diff.days} días → fracción > 6 meses: ${
          fraccionSuperiorSeisMeses ? 'sí' : 'no'
        } → ${aniosServicio} año(s)`,
      });
      auditoria.push({
        paso: 7,
        titulo: 'Retroactivo acumulado (lit. f)',
        formula: `integral_diario × ${this.diasRetroactivoPorAnio} × años_servicio`,
        valor: round2(monto),
        unidad: 'monto',
        referencia: 'Art. 142 literal f) LOTTT',
        detalle: `${desglose.salario_integral_diario} × ${this.diasRetroactivoPorAnio} × ${aniosServicio}`,
      });
    } else {
      advertencias.push({
        codigo: 'sin_retroactivo',
        mensaje:
          'Sin fechas de servicio: solo se calcula la garantía trimestral. Indique inicio/fin para el retroactivo lit. f).',
      });
    }

    const retroMonto = retroactivo?.retroactivo ?? 0;
    const garantiaR = round2(garantia);
    const montoMayor = round2(Math.max(garantiaR, retroMonto));
    let criterio: ResultadoLaborCalculator['criterio_provision'] = 'garantia_trimestral';
    if (retroactivo) {
      if (garantiaR === retroMonto) criterio = 'empatados';
      else if (retroMonto > garantiaR) criterio = 'retroactivo';
    }

    auditoria.push({
      paso: auditoria.length + 1,
      titulo: 'Monto a provisionar (mayor)',
      formula: 'max(garantía_trimestral, retroactivo)',
      valor: montoMayor,
      unidad: 'monto',
      referencia: PRESTACION_ANTIGUEDAD_REF,
      detalle: `max(${garantiaR}, ${retroMonto}) → criterio: ${criterio}`,
    });

    return {
      ...desglose,
      garantia_trimestral: garantiaR,
      dias_garantia: this.diasGarantiaTrimestral,
      estimacion_anual_garantias: round2(garantia * 4),
      retroactivo,
      monto_a_provisionar: montoMayor,
      criterio_provision: criterio,
      auditoria,
      advertencias,
      metodo: 'deterministico_lott_142',
      version_formula: '1.1.0',
    };
  }
}

export function calcularSalarioIntegralDiario(
  salarioMensual: number,
  config?: AlicuotasConfig,
): DesgloseSalarioIntegral {
  return new LaborCalculator(
    salarioMensual,
    config?.diasUtilidades ?? LOTTT_MIN_DIAS_UTILIDADES,
    config?.diasBonoVacacional ?? LOTTT_MIN_DIAS_BONO_VACACIONAL,
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
    config?.diasUtilidades ?? LOTTT_MIN_DIAS_UTILIDADES,
    config?.diasBonoVacacional ?? LOTTT_MIN_DIAS_BONO_VACACIONAL,
    {
      diasBaseAnual: config?.diasBaseAnual,
      diasGarantiaTrimestral: config?.diasGarantiaTrimestral,
      diasRetroactivoPorAnio: config?.diasRetroactivoPorAnio,
    },
  );
  const {
    retroactivo: _r,
    monto_a_provisionar: _m,
    criterio_provision: _c,
    auditoria: _a,
    advertencias: _adv,
    metodo: _met,
    version_formula: _v,
    ...rest
  } = calc.calcularTodo();
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
    config?.diasUtilidades ?? LOTTT_MIN_DIAS_UTILIDADES,
    config?.diasBonoVacacional ?? LOTTT_MIN_DIAS_BONO_VACACIONAL,
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
