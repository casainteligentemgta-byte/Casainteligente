import { cargoPorCodigo } from '@/lib/constants/cargosObreros';
import {
  ALIMENTACION_MENSUAL_VES_HOMOLOGADA_2026,
  alimentacionSemanalVes,
  salarioDiarioHomologado,
  FECHA_FIRMA_ACUERDO_2026,
  TASA_BCV_FIRMA_ACUERDO_2026,
  TABULADOR_HOMOLOGADO_2026_REFERENCIA,
} from '@/lib/nomina/tabuladorHomologado2026';

/**
 * Arreglo de pago por defecto (cesta ticket incluida). Es el monto preestablecido:
 * cada contrato puede pactar otro (ver `lib/nomina/arregloPago.ts`).
 */
export const SOBRE_AYUDANTE_USD = 90;
export const SOBRE_CLASIFICADO_USD = 115;

/** Oficio del recibo legal: ayudante = 2.1; clasificado = de 1ra (nivel 5) salvo oficio de nivel mayor. */
export const OFICIO_AYUDANTE_CODIGO = '2.1';
export const OFICIO_AYUDANTE_NOMBRE = 'AYUDANTE';
export const OFICIO_CLASIFICADO_DEFAULT_CODIGO = '5.1';
export const OFICIO_CLASIFICADO_DEFAULT_NOMBRE = 'ALBAÑIL DE 1ra.';

export const DIAS_JORNADA_SEMANA = 5;
/** Cl. 8: descansos (sáb y dom) si prestó al menos 3 jornadas completas. */
export const MIN_JORNADAS_PARA_DESCANSO = 3;
export const DIAS_DESCANSO_SEMANA = 2;

/** Cada 4 semanas trabajadas se paga una quinta (adelanto de prestaciones + conceptos CCT). */
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
  'Solicito que la compensación de la Cláusula SÉPTIMA de mi contrato de trabajo, correspondiente a estas cuatro semanas trabajadas, se impute en la parte que corresponda como anticipo de mis prestaciones sociales, conforme al artículo 144 de la LOTTT.';

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
