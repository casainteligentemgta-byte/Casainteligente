import { cargoPorCodigo } from '@/lib/constants/cargosObreros';
import {
  SALARIO_BASICO_DIARIO_USD_REF_POR_NIVEL,
  SALARIO_BASICO_DIARIO_VES_POR_NIVEL,
  TASA_BCV_VES_POR_USD_TABULADOR_2023_06_20,
} from '@/lib/nomina/tabuladorSalariosConstruccion2023';

/** Nivel salarial 1–9 a partir del código de oficio del tabulador Gaceta (ej. `5.1`, `3.2`). */
export function nivelGacetaDesdeCodigoOficio(codigo: string | null | undefined): number | null {
  const c = (codigo ?? '').trim();
  if (!c) return null;
  const n = cargoPorCodigo(c)?.nivel;
  return n != null && n >= 1 && n <= 9 ? n : null;
}

/**
 * Infiere el nivel del anexo GOE 6.752 a partir del salario básico diario oficial en Bs.
 * (útil cuando `cargo_codigo` no coincide con el catálogo, p. ej. códigos internos «MO»/«ALB»).
 */
export function nivelGacetaDesdeSalarioBasicoDiarioVes(diario: number | null | undefined): number | null {
  const d = diario != null && Number.isFinite(Number(diario)) && Number(diario) > 0 ? Number(diario) : null;
  if (d == null) return null;
  const tol = 0.06;
  for (let i = 0; i < SALARIO_BASICO_DIARIO_VES_POR_NIVEL.length; i++) {
    if (Math.abs(SALARIO_BASICO_DIARIO_VES_POR_NIVEL[i] - d) <= tol) return i + 1;
  }
  let best = 0;
  let bestDiff = Infinity;
  for (let i = 0; i < SALARIO_BASICO_DIARIO_VES_POR_NIVEL.length; i++) {
    const diff = Math.abs(SALARIO_BASICO_DIARIO_VES_POR_NIVEL[i] - d);
    if (diff < bestDiff) {
      bestDiff = diff;
      best = i;
    }
  }
  return bestDiff <= 2 ? best + 1 : null;
}

/**
 * Ingreso semanal consolidado en USD según anexo del tabulador (USD/día × 5) más la parte semanal
 * del cestaticket mensual convertida con la tasa de referencia del propio anexo (BCV 27,25 Bs/$ al 20-06-2023).
 */
export function ingresoSemanalConsolidadoUsdDesdeNivelGaceta(
  nivel: number,
  cestaticketMensualVes?: number | null,
): number | null {
  if (nivel < 1 || nivel > 9) return null;
  const usdDia = SALARIO_BASICO_DIARIO_USD_REF_POR_NIVEL[nivel - 1];
  if (usdDia == null || !Number.isFinite(usdDia)) return null;
  let total = 5 * usdDia;
  const cesta = cestaticketMensualVes != null && Number.isFinite(Number(cestaticketMensualVes)) ? Number(cestaticketMensualVes) : 0;
  if (cesta > 0 && TASA_BCV_VES_POR_USD_TABULADOR_2023_06_20 > 0) {
    const cestaSemanalVes = cesta / 4;
    total += cestaSemanalVes / TASA_BCV_VES_POR_USD_TABULADOR_2023_06_20;
  }
  return Math.round(total * 100) / 100;
}

export function formatearUsdContratoPdf(n: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(n);
}
