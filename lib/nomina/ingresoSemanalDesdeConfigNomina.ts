import {
  ingresoSemanalConsolidadoUsdDesdeNivelGaceta,
  nivelGacetaDesdeCodigoOficio,
} from '@/lib/talento/ingresoSemanalUsdTabuladorConstruccion';

/**
 * Fila mínima de `ci_config_nomina` (tabulador) para cálculos de referencia semanal en formularios / contratos.
 * Alineado con `app/rrhh/oficios-salarios/page.tsx` y `cargarPropsContratoObreroPdfEstructurado`.
 */
export type ConfigNominaTabuladorLike = {
  id?: string;
  cargo_codigo?: string | null;
  /** 1–9; si existe, prevalece sobre la inferencia por `cargo_codigo`. */
  nivel_salarial?: number | null;
  salario_base_mensual: number;
  cestaticket_mensual: number;
};

const SEMANAS_POR_MES_REF = 4;

/** Nivel Gaceta 1–9: usa `nivel_salarial` si es válido; si no, infiere desde `cargo_codigo`. */
export function nivelEfectivoDesdeConfigNomina(cfg: ConfigNominaTabuladorLike): number | null {
  const ns = cfg.nivel_salarial;
  if (ns != null && Number.isFinite(Number(ns))) {
    const n = Math.round(Number(ns));
    if (n >= 1 && n <= 9) return n;
  }
  return nivelGacetaDesdeCodigoOficio(cfg.cargo_codigo);
}

/**
 * Equivalente semanal en bolívares del tabulador (misma base que el anexo: mensual ÷ 4 para salario y cesta).
 * Sustituye un campo ficticio `sueldo_semanal` que no existe en `ci_config_nomina`.
 */
export function sueldoSemanalReferenciaBolivares(cfg: ConfigNominaTabuladorLike | null): number {
  if (!cfg) return 0;
  const sm = Number(cfg.salario_base_mensual);
  const ce = Number(cfg.cestaticket_mensual);
  const sal = Number.isFinite(sm) && sm > 0 ? sm / SEMANAS_POR_MES_REF : 0;
  const cesta = Number.isFinite(ce) && ce >= 0 ? ce / SEMANAS_POR_MES_REF : 0;
  return Math.round((sal + cesta) * 100) / 100;
}

/**
 * Total semanal en Bs (referencia tabulador + bono complemento en Bs).
 * Si el bono está en USD, conviértelo a Bs con la tasa del día antes de sumar.
 */
export function ingresoSemanalTotalBolivares(sueldoSemanalTabuladorVes: number, bonoComplementoVes = 0): number {
  const a = Number.isFinite(sueldoSemanalTabuladorVes) ? sueldoSemanalTabuladorVes : 0;
  const b = Number.isFinite(bonoComplementoVes) ? bonoComplementoVes : 0;
  return Math.round((a + b) * 100) / 100;
}

/** Atajo: tabulador + bono en Bs → total semanal Bs. */
export function ingresoSemanalTotalDesdeConfigNomina(
  oficio: ConfigNominaTabuladorLike | null,
  bonoComplementoVes = 0,
): number {
  return ingresoSemanalTotalBolivares(sueldoSemanalReferenciaBolivares(oficio), bonoComplementoVes);
}

/**
 * Ingreso semanal consolidado en **USD** (salario por nivel Gaceta + parte semanal del cestaticket a tasa anexo),
 * igual criterio que el PDF estructurado (`ingresoSemanalConsolidadoUsdDesdeNivelGaceta`).
 */
export function ingresoSemanalConsolidadoUsdDesdeConfigNomina(
  cfg: ConfigNominaTabuladorLike | null,
): number | null {
  if (!cfg) return null;
  const nivel = nivelEfectivoDesdeConfigNomina(cfg);
  if (nivel == null) return null;
  return ingresoSemanalConsolidadoUsdDesdeNivelGaceta(nivel, cfg.cestaticket_mensual);
}
