import { SALARIO_BASICO_DIARIO_VES_POR_NIVEL } from '@/lib/nomina/tabuladorSalariosConstruccion2023';

/**
 * Días laborables de referencia para prorratear el bono mensual de asistencia puntual
 * (Convención GOE 6.752, **Cláusula 41**: bonificación equivalente a **seis (6) días de Salario Básico**
 * al cumplir asistencia puntual y perfecta en todos los días laborables del mes).
 *
 * Nota: En el texto homologado en GOE 6.752, la **Cláusula 34** trata Plan de vivienda;
 * el bono por asistencia es la Cl. 41 (mismo instrumento).
 */
export const DIAS_LABORABLES_MES_PRORRATEO_BONO_ASISTENCIA = 22;

/**
 * Cesta ticket (Ley del Cestaticket Socialista): monto en Bs **mensual** indexado;
 * para la proyección se usa el equivalente diario (÷ 30) salvo override por env público.
 */
export function cestaTicketDiarioVESPorDefecto(): number {
  const raw =
    typeof process !== 'undefined'
      ? process.env.NEXT_PUBLIC_NOMINA_CESTA_TICKET_MENSUAL_VES
      : undefined;
  const mensual = raw != null && raw !== '' ? Number(raw) : 17_450;
  if (!Number.isFinite(mensual) || mensual <= 0) return 0;
  return Math.round((mensual / 30) * 100) / 100;
}

/** Opcional: prima o bono adicional diario para nivel 9 (dirección de faena / responsabilidad en obra), desde env. */
export function primaResponsabilidadNivel9DiarioVES(): number {
  const raw =
    typeof process !== 'undefined'
      ? process.env.NEXT_PUBLIC_NOMINA_PRIMA_RESPONSABILIDAD_NIVEL9_DIARIO_VES
      : undefined;
  if (raw == null || raw === '') return 0;
  const n = Number(raw);
  return Number.isFinite(n) && n >= 0 ? Math.round(n * 100) / 100 : 0;
}

export interface ResultadoCompensacionDiaria {
  nivel: number;
  salarioBasicoDiarioVES: number;
  /** Prorrateo mensual Cl. 41: (6 × SB diario) / días laborables de referencia. */
  bonoAsistenciaDiarioVES: number;
  /** Solo nivel 9: suma tabulador + prima env si existe (la banda 9 ya es la máxima del tabulador). */
  beneficioResponsabilidadNivel9VES: number;
  totalDiarioVES: number;
  /** (totalDiario + cestaTicketDiario) × 30 */
  proyeccion30DiasConCestaTicketVES: number;
  cestaTicketDiarioVES: number;
  /** Texto breve para tooltip / auditoría. */
  fuenteNotas: string;
}

function clampNivel(n: number): number {
  if (!Number.isFinite(n)) return 1;
  return Math.min(9, Math.max(1, Math.floor(n)));
}

/**
 * Costo remuneración diaria de referencia (SB + bono asistencia prorrateado).
 * Los montos SB provienen del tabulador anexo 20-06-2023 (ver `tabuladorSalariosConstruccion2023.ts`).
 */
export function calcularCompensacionDiaria(
  nivelObrero: number,
  opciones?: {
    diasLaborablesMes?: number;
    cestaTicketDiarioVES?: number | null;
    incluirPrimaResponsabilidadNivel9?: boolean;
  },
): ResultadoCompensacionDiaria {
  const nivel = clampNivel(nivelObrero);
  const idx = nivel - 1;
  const salarioBasicoDiarioVES = SALARIO_BASICO_DIARIO_VES_POR_NIVEL[idx] ?? 0;
  const diasLab =
    opciones?.diasLaborablesMes != null && opciones.diasLaborablesMes > 0
      ? opciones.diasLaborablesMes
      : DIAS_LABORABLES_MES_PRORRATEO_BONO_ASISTENCIA;

  const bonoAsistenciaDiarioVES =
    Math.round(((6 * salarioBasicoDiarioVES) / diasLab) * 100) / 100;

  const incluirPrima =
    nivel === 9 && (opciones?.incluirPrimaResponsabilidadNivel9 !== false);
  const beneficioResponsabilidadNivel9VES =
    incluirPrima ? primaResponsabilidadNivel9DiarioVES() : 0;

  const totalDiarioVES =
    Math.round(
      (salarioBasicoDiarioVES + bonoAsistenciaDiarioVES + beneficioResponsabilidadNivel9VES) *
        100,
    ) / 100;

  const cestaTicketDiarioVES =
    opciones?.cestaTicketDiarioVES != null && opciones.cestaTicketDiarioVES >= 0
      ? Math.round(opciones.cestaTicketDiarioVES * 100) / 100
      : cestaTicketDiarioVESPorDefecto();

  const proyeccion30DiasConCestaTicketVES =
    Math.round((totalDiarioVES + cestaTicketDiarioVES) * 30 * 100) / 100;

  const fuenteNotas =
    'SB: tabulador anexo Conv. Construcción 20-06-2023 (Bs en tabla 90,72…145,17). ' +
    'Bono asistencia: Cl. 41 (6 días SB / mes ÷ días laborables). ' +
    'Cesta ticket: ley vigente; monto mensual por defecto configurable (NEXT_PUBLIC_NOMINA_CESTA_TICKET_MENSUAL_VES). ' +
    (nivel === 9
      ? 'Nivel 9: banda máxima tabulador (Maestro de obra, etc.); prima responsabilidad opcional vía NEXT_PUBLIC_NOMINA_PRIMA_RESPONSABILIDAD_NIVEL9_DIARIO_VES.'
      : '');

  return {
    nivel,
    salarioBasicoDiarioVES,
    bonoAsistenciaDiarioVES,
    beneficioResponsabilidadNivel9VES,
    totalDiarioVES,
    proyeccion30DiasConCestaTicketVES,
    cestaTicketDiarioVES,
    fuenteNotas,
  };
}

export function formatoVES(monto: number): string {
  return new Intl.NumberFormat('es-VE', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(monto);
}
