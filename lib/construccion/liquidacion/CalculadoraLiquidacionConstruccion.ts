import { SALARIO_BASICO_DIARIO_VES_POR_NIVEL } from '@/lib/nomina/tabuladorSalariosConstruccion2023';
import type {
  DesgloseMesServicio,
  LiquidacionConstruccionInput,
  ResultadoLiquidacionConstruccion,
} from '@/lib/construccion/liquidacion/types';

const MS_DIA = 86_400_000;

/** Tasa anual simulada para intereses sobre prestaciones (sin API BCV). Sustituir por tasa judicial vigente. */
export const TASA_INTERES_PRESTACIONES_ANUAL_SIMULADA = 15.0;

/** Días de salario básico por año considerados en la garantía de prestaciones (referencia LOTTT / práctica). */
const DIAS_SALARIO_PRESTACIONES_POR_ANO = 34;

/** Cl. 47 Conv. Construcción 2023: bloque anual de vacaciones + bono vacacional expresado en días de salario básico. */
const DIAS_SALARIO_VACACIONES_BONO_ANUAL = 80;

/** Cl. 48: mínimo de días de salario por utilidades en la vigencia (proporcional al tiempo). */
const DIAS_SALARIO_UTILIDADES_MINIMO_ANUAL = 100;

function parseFecha(s: string): Date | null {
  const d = new Date(s.trim());
  return Number.isNaN(d.getTime()) ? null : d;
}

function diasEntre(inicio: Date, fin: Date): number {
  const t0 = Date.UTC(inicio.getFullYear(), inicio.getMonth(), inicio.getDate());
  const t1 = Date.UTC(fin.getFullYear(), fin.getMonth(), fin.getDate());
  return Math.max(0, Math.floor((t1 - t0) / MS_DIA) + 1);
}

function clampNivel(n: number | undefined): number | undefined {
  if (n == null || !Number.isFinite(n)) return undefined;
  return Math.min(9, Math.max(1, Math.round(n)));
}

function salarioDiarioDesdeNivelOExplicito(
  nivel: number | undefined,
  explicito: number,
): { salario: number; nivelUsado?: number } {
  const n = clampNivel(nivel);
  if (explicito > 0) return { salario: explicito, nivelUsado: n };
  if (n != null) return { salario: SALARIO_BASICO_DIARIO_VES_POR_NIVEL[n - 1] ?? 0, nivelUsado: n };
  return { salario: 0 };
}

/**
 * Genera filas por mes natural entre dos fechas (días de servicio en cada mes).
 */
function desgloseMensual(ingreso: Date, egreso: Date, salarioDiario: number): DesgloseMesServicio[] {
  const filas: DesgloseMesServicio[] = [];
  const cur = new Date(Date.UTC(ingreso.getFullYear(), ingreso.getMonth(), 1));
  const finMesInicio = new Date(Date.UTC(egreso.getFullYear(), egreso.getMonth(), 1));

  while (cur <= finMesInicio) {
    const anio = cur.getUTCFullYear();
    const mes = cur.getUTCMonth();
    const ultimoDiaMes = new Date(Date.UTC(anio, mes + 1, 0)).getUTCDate();
    const inicioMes = new Date(Date.UTC(anio, mes, 1));
    const finMes = new Date(Date.UTC(anio, mes, ultimoDiaMes));
    const desde = ingreso > inicioMes ? ingreso : inicioMes;
    const hasta = egreso < finMes ? egreso : finMes;
    const dias = desde <= hasta ? diasEntre(desde, hasta) : 0;
    const diasAnio = 365;
    const aporte =
      dias > 0
        ? Math.round(
            salarioDiario * (DIAS_SALARIO_PRESTACIONES_POR_ANO / diasAnio) * dias * 100,
          ) / 100
        : 0;
    const etiquetaMes = `${anio}-${String(mes + 1).padStart(2, '0')}`;
    filas.push({ anio, mes: mes + 1, etiquetaMes, diasServicioEnMes: dias, aportePrestacionesReferenciaVES: aporte });
    cur.setUTCMonth(cur.getUTCMonth() + 1);
  }
  return filas;
}

function mesesEquivalentes(diasTotales: number): number {
  return Math.round((diasTotales / 30.44) * 1000) / 1000;
}

function indemnizacionSimulada(
  motivo: LiquidacionConstruccionInput['motivoRetiro'],
  salarioDiario: number,
  meses: number,
): { monto: number; texto: string } {
  switch (motivo) {
    case 'despido_injustificado':
      return {
        monto: Math.round(salarioDiario * Math.min(360, 30 * Math.max(1, Math.ceil(meses))) * 100) / 100,
        texto:
          'Simulación: indemnización sustitutiva / daño emergente según LOTTT y antigüedad (tope simplificado 360 jornales; revisar art. 139 y jurisprudencia).',
      };
    case 'despido_justificado':
      return { monto: 0, texto: 'Sin indemnización por despido con causa, salvo conceptos adeudados y prestaciones.' };
    case 'renuncia':
    case 'mutuo_acuerdo':
      return { monto: 0, texto: 'Sin indemnización por renuncia o mutuo acuerdo (salvo pago de causados y prestaciones).' };
    case 'transferencia':
      return {
        monto: 0,
        texto:
          'Cl. 13: gastos de traslado y mudanza no se modelan como “salario”; gestionar aparte. Sin indemnización LOTTT típica si hay continuidad laboral.',
      };
    case 'cierre_obra':
      return {
        monto: Math.round(salarioDiario * 30 * 100) / 100,
        texto: 'Simulación conservadora por cierre de obra (un mes de salario); validar cláusula de obra y LOTTT.',
      };
    default:
      return { monto: 0, texto: 'Motivo “otro”: sin indemnización automática en el modelo.' };
  }
}

/**
 * Servicio de simulación de liquidación final — **obligatorio validar con asesoría legal**.
 *
 * **Cl. 12 y 13** (GOE 6.752, texto disponible): labores de la misma índole según anexo de oficios;
 * y gastos de traslado/mudanza en transferencias fuera de residencia habitual.
 *
 * Prestaciones: desglose mensual de días + aporte referencial anualizado (34 días SB / año / 365 × días).
 * Vacaciones / utilidades: **Cl. 47** y **Cl. 48** de la misma convención (extracto Gaceta).
 */
export class CalculadoraLiquidacionConstruccion {
  static calcular(input: LiquidacionConstruccionInput): ResultadoLiquidacionConstruccion {
    const ing = parseFecha(input.fechaIngreso);
    const egr = parseFecha(input.fechaEgreso);
    if (!ing || !egr || egr < ing) {
      throw new Error('fechas_invalidas: fechaIngreso y fechaEgreso deben ser válidas y egreso ≥ ingreso.');
    }

    const { salario: salarioDiario, nivelUsado } = salarioDiarioDesdeNivelOExplicito(
      input.nivelSalario,
      input.ultimoSalarioBasicoDiarioVES,
    );
    if (salarioDiario <= 0) {
      throw new Error('salario_invalido: indique ultimoSalarioBasicoDiarioVES > 0 o nivelSalario 1–9.');
    }

    const diasTotales = diasEntre(ing, egr);
    const mesesEq = mesesEquivalentes(diasTotales);
    const desgloseMes = desgloseMensual(ing, egr, salarioDiario);
    const basePrestaciones = desgloseMes.reduce((a, r) => a + r.aportePrestacionesReferenciaVES, 0);

    const tasa = TASA_INTERES_PRESTACIONES_ANUAL_SIMULADA;
    const años = diasTotales / 365;
    const intereses =
      Math.round(basePrestaciones * (tasa / 100) * Math.min(años, 5) * 0.5 * 100) / 100;

    const proporcionAnual = Math.min(1, mesesEq / 12);
    const vacacionesMonto =
      Math.round(salarioDiario * DIAS_SALARIO_VACACIONES_BONO_ANUAL * proporcionAnual * 100) / 100;
    const utilidadesMonto =
      Math.round(salarioDiario * DIAS_SALARIO_UTILIDADES_MINIMO_ANUAL * proporcionAnual * 100) / 100;

    const ind = indemnizacionSimulada(input.motivoRetiro, salarioDiario, mesesEq);

    const cl12 =
      'Cl. 12: el trabajador no está obligado a desempeñar labores de índole distinta a las del anexo de oficios y tareas.';
    const cl13 =
      'Cl. 13: en transferencias fuera de la residencia habitual, el patrono asume traslado, mudanza de la familia y regreso al origen.';

    const transferencia = input.motivoRetiro === 'transferencia';

    const lineas: ResultadoLiquidacionConstruccion['resumenLineas'] = [
      { concepto: 'Prestaciones sociales (estimación acumulada)', montoVES: Math.round(basePrestaciones * 100) / 100 },
      { concepto: 'Intereses sobre prestaciones (simulación BCV)', montoVES: intereses },
      { concepto: 'Vacaciones y bono vacacional proporcional (Cl. 47)', montoVES: vacacionesMonto },
      { concepto: 'Utilidades proporcionales mínimo convencional (Cl. 48)', montoVES: utilidadesMonto },
      { concepto: 'Indemnización / severancia simulada', montoVES: ind.monto },
    ];

    const granTotal = Math.round(lineas.reduce((s, l) => s + l.montoVES, 0) * 100) / 100;

    return {
      meta: {
        convencionReferencia: 'Convención Colectiva Construcción homologada 20-06-2023 (GOE N° 6.752 Extraordinario).',
        clausulasContexto: { clausula12: cl12, clausula13: cl13 },
        vacacionesConvencion:
          'Cl. 47: 17 días hábiles de vacaciones con pago de 80 días de salario básico (incluye bono vacacional) por año causado en vigencia; aquí proporcional por tiempo.',
        utilidadesConvencion:
          'Cl. 48: participación en utilidades con mínimo equivalente a 100 días de salario por año causado en vigencia; aquí proporcional por meses.',
        advertenciaLegal:
          'Simulación orientativa. La liquidación definitiva requiere revisión legal, actualización normativa, histórico de pagos y tasas de interés aplicables.',
      },
      entrada: {
        fechaIngreso: input.fechaIngreso,
        fechaEgreso: input.fechaEgreso,
        diasTotalesServicio: diasTotales,
        mesesServicioEquivalente: mesesEq,
        ultimoSalarioBasicoDiarioVES: salarioDiario,
        nivelSalario: nivelUsado ?? input.nivelSalario,
        motivoRetiro: input.motivoRetiro,
      },
      prestacionesSociales: {
        descripcion:
          'Acumulación por días de servicio por mes natural; aporte mensual referido a fracción de 34 jornales de SB por año (referencia común en liquidaciones; ajustar según auditoría).',
        desglosePorMes: desgloseMes,
        diasAcumuladosConsiderados: diasTotales,
        baseCalculoVES: salarioDiario,
        montoPrestacionesSocialesVES: Math.round(basePrestaciones * 100) / 100,
      },
      interesesPrestaciones: {
        descripcion: 'Intereses sobre saldos de prestaciones: tasa anual simulada (sin conexión BCV en tiempo real).',
        tasaAnualSimuladaPorcentaje: tasa,
        formula: `intereses ≈ prestaciones × (${tasa}% / 100) × min(años_servicio, 5) × 0.5`,
        montoInteresesVES: intereses,
      },
      vacacionesYBonoVacacional: {
        descripcion:
          'Proporción del año laborado respecto al bloque de 80 días de salario básico (vacaciones + bono vacacional unificado en Cl. 47).',
        diasSalarioVacacionesAnualEquivalente: DIAS_SALARIO_VACACIONES_BONO_ANUAL,
        proporcionAnual: proporcionAnual,
        montoVES: vacacionesMonto,
      },
      utilidades: {
        descripcion: 'Proporción del mínimo de 100 días de salario por utilidades del año (Cl. 48).',
        diasSalarioUtilidadesMinimoAnual: DIAS_SALARIO_UTILIDADES_MINIMO_ANUAL,
        proporcionAnual,
        montoVES: utilidadesMonto,
      },
      indemnizacionYSeverancia: {
        descripcion: ind.texto,
        montoVES: ind.monto,
      },
      transferenciaClausula13: {
        descripcion: cl13,
        aplica: transferencia,
        nota: transferencia
          ? 'Liquidar aparte viáticos y mudanza según comprobantes y política; no incluido en el gran total salarial.'
          : 'No aplica transferencia según motivo informado.',
        montoEstimadoGastosTrasladoVES: 0,
      },
      granTotalVES: granTotal,
      resumenLineas: lineas,
    };
  }
}
