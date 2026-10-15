import { cargoPorCodigo } from '@/lib/constants/cargosObreros';
import {
  ALIMENTACION_MENSUAL_VES_HOMOLOGADA_2026,
  alimentacionSemanalVes,
  salarioDiarioHomologado,
  FECHA_FIRMA_ACUERDO_2026,
  TASA_BCV_FIRMA_ACUERDO_2026,
  TABULADOR_HOMOLOGADO_2026_REFERENCIA,
} from '@/lib/nomina/tabuladorHomologado2026';
import { lunesDeSemanaIso } from '@/lib/nomina/semanaIsoNomina';

/**
 * Cl. SÉPTIMA: semana adicional de monto fijo por clase (USD). El derecho nace cada 4
 * semanas seguidas trabajadas y se paga al terminar la relación (finiquito), no en la nómina semanal.
 */
export const SOBRE_AYUDANTE_USD = 90;
export const SOBRE_CLASIFICADO_USD = 115;
/** @deprecated Preferir `semanaAdicionalFijaUsd(clase)`. */
export const SEMANA_ADICIONAL_FIJA_USD = SOBRE_AYUDANTE_USD;

/**
 * Cl. SEXTA c): complemento del beneficio de alimentación, USD por semana.
 * Cantidad fija, igual para todos los oficios; no depende de productividad ni asistencia.
 */
export const COMPLEMENTO_ALIMENTACION_SEMANAL_USD = 33;
export const COMPLEMENTO_ALIMENTACION_RECIBO =
  'Complemento del beneficio de alimentación';

/** Oficio del recibo legal: ayudante = 2.1; clasificado = de 1ra (nivel 5) salvo oficio de nivel mayor. */
export const OFICIO_AYUDANTE_CODIGO = '2.1';
export const OFICIO_AYUDANTE_NOMBRE = 'AYUDANTE';
export const OFICIO_CLASIFICADO_DEFAULT_CODIGO = '5.1';
export const OFICIO_CLASIFICADO_DEFAULT_NOMBRE = 'ALBAÑIL DE 1ra.';

export const DIAS_JORNADA_SEMANA = 5;
/** Cl. 8: descansos (sáb y dom) si prestó al menos 3 jornadas completas. */
export const MIN_JORNADAS_PARA_DESCANSO = 3;
export const DIAS_DESCANSO_SEMANA = 2;

/** Cada 4 semanas seguidas trabajadas se causa una semana adicional (pago al finiquito). */
export const SEMANAS_TRABAJADAS_PARA_ADELANTO = 4;
/** Cl. 50: 6 días de salario básico por mes / ciclo de 4 semanas. */
export const DIAS_GARANTIA_PRESTACIONES_POR_CICLO = 6;
/** Art. 144 LOTTT: el anticipo de prestaciones no puede pasar del 75% de lo acreditado. */
export const TOPE_ANTICIPO_PRESTACIONES = 0.75;
/** Cl. 48: 100 días de utilidades al año; un ciclo de 4 semanas es 1/13 del año. */
export const DIAS_UTILIDADES_ANUALES_CCT = 100;
export const CICLOS_CUATRO_SEMANAS_POR_ANIO = 13;

/**
 * Solicitud escrita del trabajador para que la parte de la compensación de la Cláusula SÉPTIMA
 * imputada a prestaciones sociales cuente como anticipo (art. 144 LOTTT exige la solicitud).
 */
export const SOLICITUD_ANTICIPO_SEPTIMA_TEXTO =
  'Declaro que la semana adicional de la Cláusula SÉPTIMA de mi contrato, causada por cada cuatro semanas trabajadas, se pagará al terminar la relación de trabajo e imputará a prestaciones sociales, vacaciones, utilidades y demás conceptos, conforme a la LOTTT y a la Convención Colectiva.';

export const CESTA_MENSUAL_VES_ACTA = ALIMENTACION_MENSUAL_VES_HOMOLOGADA_2026;
export const FECHA_ANCLAJE_CESTA_ISO = FECHA_FIRMA_ACUERDO_2026;
/** Tasa fija de anclaje del cesta ticket (BCV del día de la firma del acuerdo). */
export const TASA_ANCLA_CESTA_BCV = TASA_BCV_FIRMA_ACUERDO_2026;
export const REFERENCIA_ACTA_HOMOLOGACION = TABULADOR_HOMOLOGADO_2026_REFERENCIA;

export type ClasePagoObra = 'ayudante' | 'clasificado';
export type TipoItemNomina = 'semanal' | 'adelanto_prestaciones';

export type OficioReciboLegal = {
  codigo: string;
  denominacion: string;
  nivel: number;
  diarioVes: number;
};

export function round2(n: number): number {
  if (!Number.isFinite(n)) return 0;
  return Math.round(n * 100) / 100;
}

export function cestaSemanalVesActa(mensual = CESTA_MENSUAL_VES_ACTA): number {
  return alimentacionSemanalVes(mensual);
}

/** Cesta anclada al dólar: Bs. semanales del acta ÷ tasa BCV de la homologación. */
export function cestaSemanalUsdAnclada(tasaAnclaBcv: number, mensual = CESTA_MENSUAL_VES_ACTA): number {
  if (!Number.isFinite(tasaAnclaBcv) || tasaAnclaBcv <= 0) return 0;
  return round2(cestaSemanalVesActa(mensual) / tasaAnclaBcv);
}

export function esClasePagoObra(v: string): v is ClasePagoObra {
  return v === 'ayudante' || v === 'clasificado';
}

/**
 * Inferencia de clase de patio. Niveles 1–2 y textos «ayudante» → ayudante;
 * el resto → clasificado (recibo de 1ra).
 */
export function inferirClasePagoObra(
  cargoCodigo?: string | null,
  cargoNombre?: string | null,
): ClasePagoObra {
  const nom = (cargoNombre ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  if (nom.includes('ayudante')) return 'ayudante';
  const raw = (cargoCodigo ?? '').trim().replace(',', '.');
  const m = /^(\d)(?:\.\d{1,2})?$/.exec(raw);
  if (m) {
    const nivel = Number(m[1]);
    if (nivel >= 1 && nivel <= 2) return 'ayudante';
  }
  return 'clasificado';
}

export function oficioReciboLegal(
  clase: ClasePagoObra,
  cargoCodigo?: string | null,
  cargoNombre?: string | null,
): OficioReciboLegal {
  if (clase === 'ayudante') {
    const diario = salarioDiarioHomologado(2) ?? 2256.84;
    return {
      codigo: OFICIO_AYUDANTE_CODIGO,
      denominacion: OFICIO_AYUDANTE_NOMBRE,
      nivel: 2,
      diarioVes: diario,
    };
  }
  const cargo = cargoPorCodigo((cargoCodigo ?? '').trim().replace(',', '.'));
  if (cargo && cargo.nivel >= 5) {
    const diario = salarioDiarioHomologado(cargo.nivel);
    if (diario != null) {
      return {
        codigo: cargo.codigo,
        denominacion: cargo.nombre,
        nivel: cargo.nivel,
        diarioVes: diario,
      };
    }
  }
  const nom = (cargoNombre ?? '').trim();
  const diarioN5 = salarioDiarioHomologado(5) ?? 2771.26;
  return {
    codigo: cargo?.codigo && cargo.nivel === 5 ? cargo.codigo : OFICIO_CLASIFICADO_DEFAULT_CODIGO,
    denominacion: nom && cargo?.nivel === 5 ? cargo.nombre : OFICIO_CLASIFICADO_DEFAULT_NOMBRE,
    nivel: 5,
    diarioVes: diarioN5,
  };
}

export function sobreUsdDeClase(clase: ClasePagoObra): number {
  return clase === 'ayudante' ? SOBRE_AYUDANTE_USD : SOBRE_CLASIFICADO_USD;
}

/** Cl. SÉPTIMA: 90 USD ayudante / 115 USD clasificado, por cada 4 semanas seguidas. */
export function semanaAdicionalFijaUsd(clase: ClasePagoObra): number {
  return sobreUsdDeClase(clase);
}

/**
 * Días pagados según Cl. 8: 2 descansos si hay al menos 3 jornadas completas.
 * Faltar más de 2 días en la semana quita los descansos (mismo umbral).
 */
export function diasPagadosClausula8(diasLaborados: number): number {
  const d = Math.max(0, Math.min(DIAS_JORNADA_SEMANA, Math.floor(Number(diasLaborados) || 0)));
  if (d >= MIN_JORNADAS_PARA_DESCANSO) return d + DIAS_DESCANSO_SEMANA;
  return d;
}

export function semanaCuentaComoTrabajada(diasLaborados: number): boolean {
  return Math.floor(Number(diasLaborados) || 0) >= MIN_JORNADAS_PARA_DESCANSO;
}

/** Tras esta semana, ¿toca la quinta (adelanto)? `previas` = semanas trabajadas ya pagadas. */
export function tocaAdelantoTrasSemana(semanasTrabajadasPrevias: number, estaSemanaCuenta: boolean): boolean {
  if (!estaSemanaCuenta) return false;
  const n = Math.max(0, Math.floor(semanasTrabajadasPrevias)) + 1;
  return n > 0 && n % SEMANAS_TRABAJADAS_PARA_ADELANTO === 0;
}

/** Una semana de un trabajador en una obra: lunes ISO y días laborados. */
export type SemanaDelTrabajador = { semanaInicio: string; dias: number };

export type RachaQuinta = {
  /** Semanas seguidas trabajadas que lleva, contando esta (0 si esta no cuenta). */
  racha: number;
  /** Semanas que le faltan para la próxima quinta (1 a 4). */
  faltan: number;
  /** Esta semana completa un bloque de 4 seguidas: se causa una quinta. */
  tocaEstaSemana: boolean;
  /** Quintas causadas desde su primera semana registrada hasta esta (incluida). */
  quintasAcumuladas: number;
};

function sumarDiasIso(iso: string, dias: number): string {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(Date.UTC(y!, m! - 1, d! + dias)).toISOString().slice(0, 10);
}

/**
 * Cl. SÉPTIMA por trabajador: cada 4 semanas seguidas trabajadas se causa una quinta, y así
 * cada cuatro (4, 8, 12…). Una semana que no cuenta como trabajada (menos de 3 jornadas,
 * la misma regla de los descansos de la Cl. 8) o en la que no aparece en la nómina corta la
 * racha y la cuenta vuelve a cero; las quintas ya causadas se conservan.
 *
 * `historial` son sus semanas ya guardadas en cualquier obra (los días de una misma semana en
 * obras distintas se suman, hasta 5). `diasActual` son los días de esta semana en la obra que
 * se está calculando (se suman a los de otras obras esa misma semana).
 */
export function rachaQuintaSemana(
  historial: readonly SemanaDelTrabajador[],
  semanaActual: string,
  diasActual: number | null,
): RachaQuinta {
  const actual = lunesDeSemanaIso(semanaActual);
  const porSemana: Record<string, number> = {};
  for (const s of historial) {
    const k = lunesDeSemanaIso(s.semanaInicio);
    if (k > actual) continue;
    porSemana[k] = (porSemana[k] ?? 0) + Math.max(0, Number(s.dias) || 0);
  }
  if (diasActual != null) porSemana[actual] = (porSemana[actual] ?? 0) + Math.max(0, Number(diasActual) || 0);
  const semanas = Object.keys(porSemana).sort();
  let racha = 0;
  let quintas = 0;
  let toca = false;
  if (semanas.length > 0) {
    for (let w = semanas[0]!, vueltas = 0; w <= actual && vueltas < 1100; w = sumarDiasIso(w, 7), vueltas++) {
      if (semanaCuentaComoTrabajada(Math.min(DIAS_JORNADA_SEMANA, porSemana[w] ?? 0))) {
        racha += 1;
        toca = racha % SEMANAS_TRABAJADAS_PARA_ADELANTO === 0;
        if (toca) quintas += 1;
      } else {
        racha = 0;
        toca = false;
      }
    }
  }
  return {
    racha,
    faltan: SEMANAS_TRABAJADAS_PARA_ADELANTO - (racha % SEMANAS_TRABAJADAS_PARA_ADELANTO),
    tocaEstaSemana: toca,
    quintasAcumuladas: quintas,
  };
}
